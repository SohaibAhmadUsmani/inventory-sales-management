const crypto = require('crypto');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const parseEndDate = (endDate) => {
  const str = String(endDate).trim();
  return new Date(str.includes('T') ? str : `${str}T23:59:59.999Z`);
};

const generateOrderNumber = () => {
  const prefix = 'PO';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const normalizePurchaseStatus = (status) => {
  const normalized = status?.toLowerCase();
  if (['ordered', 'received', 'cancelled'].includes(normalized)) return normalized;
  return null;
};

const VALID_PAYMENT_STATUSES = ['paid', 'pending', 'partial'];
const normalizePaymentStatus = (paymentStatus) => {
  const normalized = String(paymentStatus || '').toLowerCase();
  if (VALID_PAYMENT_STATUSES.includes(normalized)) return normalized;
  return null;
};

const applyPurchaseStockIncrease = async (purchase, userId) => {
  const appliedSnapshots = [];
  try {
    for (const item of purchase.items) {
      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product not found: ${item.product}`);
      }

      const previousStock = product.stock;
      const previousCost = product.cost || 0;
      const previousSupplier = product.supplier || null;
      const itemCost = Number(item.cost);
      const itemQty = Number(item.quantity);

      // Recalculate Weighted Average Cost (AVCO) when itemCost >= 0
      if (Number.isFinite(itemCost) && itemCost >= 0) {
        if (previousStock <= 0) {
          if (itemCost > 0) {
            product.cost = round2(itemCost);
          }
        } else {
          const currentTotalCost = previousStock * previousCost;
          const inboundTotalCost = itemQty * itemCost;
          const newAverageCost = (currentTotalCost + inboundTotalCost) / (previousStock + itemQty);
          product.cost = round2(newAverageCost);
        }
      }

      if (!product.supplier && purchase.supplier) {
        product.supplier = purchase.supplier;
      }

      product.stock += itemQty;
      await product.save();
      appliedSnapshots.push({
        productId: product._id,
        previousStock,
        previousCost,
        previousSupplier,
      });

      await Inventory.create({
        product: item.product,
        supplier: purchase.supplier || null,
        type: 'purchase',
        quantity: itemQty,
        unitCost: Number.isFinite(itemCost) && itemCost >= 0 ? itemCost : (product.cost || 0),
        previousStock,
        currentStock: product.stock,
        reference: purchase.orderNumber,
        referenceId: purchase._id,
        referenceModel: 'Purchase',
        reason: 'Purchase Order Received',
        notes: `Received purchase order ${purchase.orderNumber}`,
        performedBy: userId,
      });
    }
  } catch (err) {
    for (const snap of appliedSnapshots) {
      await Product.findByIdAndUpdate(snap.productId, {
        $set: {
          stock: snap.previousStock,
          cost: snap.previousCost,
          supplier: snap.previousSupplier,
        },
      }).catch(() => {});
    }
    throw err;
  }
};

exports.getPurchases = async (req, res, next) => {
  try {
    const { search, supplier, status, paymentStatus, startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};
    if (search && String(search).trim()) {
      query.orderNumber = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
    }
    if (supplier) query.supplier = supplier;
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!Number.isNaN(s.getTime())) query.purchaseDate.$gte = s;
      }
      if (endDate) {
        const e = parseEndDate(endDate);
        if (!Number.isNaN(e.getTime())) query.purchaseDate.$lte = e;
      }
      if (Object.keys(query.purchaseDate).length === 0) delete query.purchaseDate;
    }

    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name company')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      count: purchases.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      page: pageNum,
      purchases,
    });
  } catch (err) { next(err); }
};

exports.getPurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id)
      .populate('supplier', 'name company phone email')
      .populate('createdBy', 'name');
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
    res.json({ success: true, purchase });
  } catch (err) { next(err); }
};

exports.createPurchase = async (req, res, next) => {
  try {
    const { supplierId, items, purchaseDate, paymentStatus, notes, status } = req.body;

    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'Supplier is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in purchase' });
    }

    const normalizedStatus = normalizePurchaseStatus(status || 'ordered');
    if (!normalizedStatus) {
      return res.status(400).json({ success: false, message: 'Invalid purchase status' });
    }

    const normalizedPaymentStatus = paymentStatus ? normalizePaymentStatus(paymentStatus) : 'pending';
    if (!normalizedPaymentStatus) {
      return res.status(400).json({ success: false, message: 'Invalid payment status. Must be paid, pending, or partial' });
    }

    const supplier = await Supplier.findOne({ _id: supplierId, isActive: true });
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found or inactive' });
    }

    let totalCost = 0;
    const purchaseItems = [];

    for (const item of items) {
      const productId = item.productId || item.product;
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Each purchase item must include a product' });
      }

      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${productId}` });
      }

      const quantity = Number(item.quantity);
      const rawCost = Number(item.cost ?? product.cost);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, message: `Invalid quantity for product ${product.name}. Must be an integer >= 1` });
      }

      if (!Number.isFinite(rawCost) || rawCost < 0) {
        return res.status(400).json({ success: false, message: `Invalid cost for product ${product.name}` });
      }

      const cost = round2(rawCost);
      const total = round2(cost * quantity);
      totalCost = round2(totalCost + total);

      purchaseItems.push({
        product: product._id,
        name: product.name,
        quantity,
        cost,
        total,
      });
    }

    const purchase = await Purchase.create({
      orderNumber: generateOrderNumber(),
      supplier: supplierId,
      items: purchaseItems,
      totalCost,
      purchaseDate: purchaseDate || new Date(),
      paymentStatus: normalizedPaymentStatus,
      status: normalizedStatus === 'received' ? 'ordered' : normalizedStatus,
      notes: notes || '',
      createdBy: req.user.id,
    });

    if (normalizedStatus === 'received') {
      try {
        await applyPurchaseStockIncrease(purchase, req.user.id);
        await Supplier.findByIdAndUpdate(purchase.supplier, { $inc: { totalPurchases: purchase.totalCost } });
        purchase.status = 'received';
        purchase.inventoryApplied = true;
        await purchase.save();
      } catch (receiveErr) {
        await Purchase.findByIdAndDelete(purchase._id).catch(() => {});
        throw receiveErr;
      }
    }

    await Notification.create({
      type: normalizedStatus === 'received' ? 'purchase_received' : 'purchase_ordered',
      title: normalizedStatus === 'received' ? 'Purchase Received' : 'Purchase Order Created',
      message: `Purchase order ${purchase.orderNumber} created for $${totalCost.toFixed(2)}`,
      referenceId: purchase._id,
    });

    await ActivityLog.create({
      user: req.user.id,
      action: 'Created',
      entity: 'Purchase',
      entityId: purchase._id,
      details: `Created purchase order ${purchase.orderNumber} - $${totalCost.toFixed(2)} (${purchase.status}, ${purchase.paymentStatus})`,
      ipAddress: req.ip || '',
    });

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate('supplier', 'name company')
      .populate('createdBy', 'name');

    res.status(201).json({ success: true, purchase: populatedPurchase });
  } catch (err) { next(err); }
};

exports.updatePurchaseStatus = async (req, res, next) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    const nextStatus = normalizePurchaseStatus(req.body.status || purchase.status);
    if (!nextStatus) {
      return res.status(400).json({ success: false, message: 'Invalid purchase status' });
    }

    let nextPaymentStatus = purchase.paymentStatus;
    if (req.body.paymentStatus !== undefined) {
      const validatedPayment = normalizePaymentStatus(req.body.paymentStatus);
      if (!validatedPayment) {
        return res.status(400).json({ success: false, message: 'Invalid payment status. Must be paid, pending, or partial' });
      }
      nextPaymentStatus = validatedPayment;
    }

    if (purchase.status === 'received' && nextStatus !== 'received') {
      return res.status(400).json({ success: false, message: 'A received purchase cannot be cancelled or reverted' });
    }

    if (purchase.status === 'cancelled' && nextStatus !== 'cancelled') {
      return res.status(400).json({ success: false, message: 'A cancelled purchase order cannot be reopened or received' });
    }

    const statusChangedToReceived = nextStatus === 'received' && purchase.status !== 'received' && !purchase.inventoryApplied;
    let targetPurchase = purchase;

    if (statusChangedToReceived) {
      const claimedPurchase = await Purchase.findOneAndUpdate(
        { _id: req.params.id, inventoryApplied: false },
        { $set: { inventoryApplied: true, status: 'received' } },
        { new: true }
      );
      if (!claimedPurchase) {
        return res.status(409).json({
          success: false,
          message: 'Purchase order has already been received',
        });
      }
      targetPurchase = claimedPurchase;

      try {
        await applyPurchaseStockIncrease(targetPurchase, req.user.id);
        await Supplier.findByIdAndUpdate(targetPurchase.supplier, { $inc: { totalPurchases: targetPurchase.totalCost } });
      } catch (applyErr) {
        await Purchase.findByIdAndUpdate(req.params.id, {
          $set: { inventoryApplied: false, status: purchase.status },
        }).catch(() => {});
        throw applyErr;
      }
    }

    targetPurchase.status = nextStatus;
    targetPurchase.paymentStatus = nextPaymentStatus;

    if (req.body.notes !== undefined) {
      targetPurchase.notes = req.body.notes;
    }

    await targetPurchase.save();

    if (statusChangedToReceived) {
      await Notification.create({
        type: 'purchase_received',
        title: 'Purchase Received',
        message: `Purchase order ${targetPurchase.orderNumber} marked as received`,
        referenceId: targetPurchase._id,
      });
    }

    await ActivityLog.create({
      user: req.user.id,
      action: 'Updated',
      entity: 'Purchase',
      entityId: targetPurchase._id,
      details: `Updated purchase order ${targetPurchase.orderNumber} (status: ${targetPurchase.status}, payment: ${targetPurchase.paymentStatus})`,
      ipAddress: req.ip || '',
    });

    const populatedPurchase = await Purchase.findById(targetPurchase._id)
      .populate('supplier', 'name company')
      .populate('createdBy', 'name');

    res.json({ success: true, purchase: populatedPurchase });
  } catch (err) { next(err); }
};

