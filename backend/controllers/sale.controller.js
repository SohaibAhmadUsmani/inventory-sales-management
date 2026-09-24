const crypto = require('crypto');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { generateInvoicePDF } = require('../utils/pdfExport');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const parseEndDate = (endDate) => {
  const str = String(endDate).trim();
  return new Date(str.includes('T') ? str : `${str}T23:59:59.999Z`);
};

const generateInvoiceNumber = () => {
  const prefix = 'INV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

exports.getSales = async (req, res, next) => {
  try {
    const { search, customer, paymentMethod, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};
    if (search && String(search).trim()) {
      query.invoiceNumber = { $regex: escapeRegex(String(search).trim()), $options: 'i' };
    }
    if (customer) query.customer = customer;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        if (!Number.isNaN(s.getTime())) query.createdAt.$gte = s;
      }
      if (endDate) {
        const e = parseEndDate(endDate);
        if (!Number.isNaN(e.getTime())) query.createdAt.$lte = e;
      }
      if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
    }

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      count: sales.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      page: pageNum,
      sales,
    });
  } catch (err) { next(err); }
};

exports.getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'name phone email address')
      .populate('createdBy', 'name');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, sale });
  } catch (err) { next(err); }
};

exports.getSaleInvoice = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'name phone email address')
      .populate('createdBy', 'name');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    generateInvoicePDF(sale, res);
  } catch (err) { next(err); }
};

exports.createSale = async (req, res, next) => {
  try {
    const { customerId, items, discount, tax, paymentMethod, paymentStatus, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in sale' });
    }

    if (customerId) {
      const customerDoc = await Customer.findOne({ _id: customerId, isActive: true });
      if (!customerDoc) {
        return res.status(404).json({ success: false, message: 'Customer not found or inactive' });
      }
    }

    // Merge duplicate productId entries into a single line per product
    const mergedItemsMap = new Map();
    for (const item of items) {
      const productId = String(item?.productId || item?.product || '').trim();
      if (!productId) {
        return res.status(400).json({ success: false, message: 'Each sale item must include a valid productId' });
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${productId}. Quantity must be an integer >= 1`,
        });
      }
      mergedItemsMap.set(productId, (mergedItemsMap.get(productId) || 0) + quantity);
    }

    // Validate active products and calculate totals
    let subtotal = 0;
    const saleItems = [];
    for (const [productId, quantity] of mergedItemsMap.entries()) {
      const product = await Product.findOne({ _id: productId, isActive: true });
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${productId}` });
      }
      if (product.stock < quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }
      const lineTotal = round2(product.price * quantity);
      subtotal = round2(subtotal + lineTotal);
      saleItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        cost: product.cost || 0,
        quantity,
        total: lineTotal,
      });
    }

    const discountAmount = round2(discount ?? 0);
    const taxAmount = round2(tax ?? 0);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return res.status(400).json({ success: false, message: 'Discount must be a non-negative number' });
    }
    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      return res.status(400).json({ success: false, message: 'Tax must be a non-negative number' });
    }
    if (discountAmount > subtotal) {
      return res.status(400).json({ success: false, message: 'Discount cannot exceed subtotal' });
    }
    const total = round2(subtotal - discountAmount + taxAmount);

    // Perform atomic stock deductions BEFORE creating the Sale document
    const deductedItems = [];
    try {
      for (const item of saleItems) {
        const updatedProduct = await Product.findOneAndUpdate(
          { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );

        if (!updatedProduct) {
          for (const prev of deductedItems) {
            await Product.findByIdAndUpdate(prev.item.product, { $inc: { stock: prev.item.quantity } });
          }
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.name} during checkout.`,
          });
        }

        deductedItems.push({ item, updatedProduct });
      }
    } catch (deductErr) {
      for (const prev of deductedItems) {
        await Product.findByIdAndUpdate(prev.item.product, { $inc: { stock: prev.item.quantity } }).catch(() => {});
      }
      throw deductErr;
    }

    let sale;
    try {
      sale = await Sale.create({
        invoiceNumber: generateInvoiceNumber(),
        customer: customerId || null,
        items: saleItems,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        paymentMethod,
        paymentStatus: paymentStatus || 'paid',
        notes,
        createdBy: req.user.id,
      });
    } catch (saleErr) {
      for (const prev of deductedItems) {
        await Product.findByIdAndUpdate(prev.item.product, { $inc: { stock: prev.item.quantity } }).catch(() => {});
      }
      throw saleErr;
    }

    for (const { item, updatedProduct } of deductedItems) {
      const previousStock = updatedProduct.stock + item.quantity;
      const currentStock = updatedProduct.stock;

      await Inventory.create({
        product: item.product,
        supplier: updatedProduct.supplier || null,
        type: 'sale',
        quantity: item.quantity,
        unitCost: item.cost || 0,
        previousStock,
        currentStock,
        performedBy: req.user.id,
        reference: sale.invoiceNumber,
        referenceId: sale._id,
        referenceModel: 'Sale',
        reason: 'POS Sale Checkout',
        notes: `Sale completed via ${paymentMethod || 'cash'} (Invoice: ${sale.invoiceNumber})`,
      });

      if (currentStock <= updatedProduct.minimumStock) {
        await Notification.create({
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${updatedProduct.name} is low in stock (${currentStock} remaining)`,
          referenceId: updatedProduct._id,
        });
      }
    }

    // Update customer stats
    if (customerId) {
      await Customer.findByIdAndUpdate(customerId, {
        $inc: { totalSpending: total, totalOrders: 1 },
      });
    }

    await Notification.create({
      type: 'sale_completed',
      title: 'Sale Completed',
      message: `Sale ${sale.invoiceNumber} completed for $${total.toFixed(2)}`,
      referenceId: sale._id,
    });
    await ActivityLog.create({
      user: req.user.id,
      action: 'Created',
      entity: 'Sale',
      entityId: sale._id,
      details: `Created sale ${sale.invoiceNumber} - $${total.toFixed(2)}`,
      ipAddress: req.ip || '',
    });

    res.status(201).json({ success: true, sale });
  } catch (err) { next(err); }
};

/**
 * PUT /api/sales/:id/cancel
 * Atomically cancels a completed sale and restores deducted stock back to the inventory ledger
 */
exports.cancelSale = async (req, res, next) => {
  try {
    const sale = await Sale.findOneAndUpdate(
      { _id: req.params.id, status: 'completed' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );

    if (!sale) {
      const existingSale = await Sale.findById(req.params.id);
      if (!existingSale) {
        return res.status(404).json({ success: false, message: 'Sale not found' });
      }
      return res.status(400).json({
        success: false,
        message: existingSale.status === 'cancelled'
          ? 'Sale is already cancelled'
          : 'Only completed sales can be cancelled',
      });
    }

    // Revert inventory stock
    for (const item of sale.items) {
      const updatedProduct = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (updatedProduct) {
        const previousStock = updatedProduct.stock - item.quantity;
        await Inventory.create({
          product: item.product,
          supplier: updatedProduct?.supplier || null,
          type: 'sale_return',
          quantity: item.quantity,
          unitCost: item.cost || (updatedProduct.cost || 0),
          previousStock,
          currentStock: updatedProduct.stock,
          performedBy: req.user.id,
          reference: `VOID-${sale.invoiceNumber}`,
          referenceId: sale._id,
          referenceModel: 'Sale',
          reason: 'Sale Cancelled',
          notes: `Sale voided / cancelled: ${sale.invoiceNumber}`,
        });
      }
    }

    // Adjust customer spending and orders, clamping at 0
    if (sale.customer) {
      const customerDoc = await Customer.findById(sale.customer);
      if (customerDoc) {
        customerDoc.totalSpending = round2(Math.max(0, (customerDoc.totalSpending || 0) - sale.total));
        customerDoc.totalOrders = Math.max(0, (customerDoc.totalOrders || 0) - 1);
        await customerDoc.save();
      }
    }

    await Notification.create({
      type: 'sale_cancelled',
      title: 'Sale Cancelled',
      message: `Sale ${sale.invoiceNumber} was cancelled. Stock restored to inventory.`,
      referenceId: sale._id,
    });

    await ActivityLog.create({
      user: req.user.id,
      action: 'Cancelled',
      entity: 'Sale',
      entityId: sale._id,
      details: `Cancelled sale ${sale.invoiceNumber} by ${req.user.name || req.user.id} (${req.user.role || 'staff'}) and returned items to inventory.`,
      ipAddress: req.ip || '',
    });

    await sale.populate([
      { path: 'customer', select: 'name phone' },
      { path: 'createdBy', select: 'name' },
    ]);

    res.json({ success: true, message: `Sale ${sale.invoiceNumber} cancelled successfully`, sale });
  } catch (err) {
    next(err);
  }
};

exports.getDailySales = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { status: 'completed', createdAt: {} };
    if (startDate) {
      const s = new Date(startDate);
      if (!Number.isNaN(s.getTime())) match.createdAt.$gte = s;
    }
    if (endDate) {
      const e = parseEndDate(endDate);
      if (!Number.isNaN(e.getTime())) match.createdAt.$lte = e;
    }
    if (!match.createdAt.$gte && !match.createdAt.$lte) {
      match.createdAt.$gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    const sales = await Sale.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalSales: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, sales });
  } catch (err) { next(err); }
};

