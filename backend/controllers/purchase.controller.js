const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

const generateOrderNumber = () => {
  const prefix = 'PO';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

exports.getPurchases = async (req, res, next) => {
  try {
    const { supplier, status, paymentStatus, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (supplier) query.supplier = supplier;
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) query.purchaseDate.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'name company')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, count: purchases.length, total, totalPages: Math.ceil(total / limit), page: Number(page), purchases });
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
    const { supplierId, items, purchaseDate, paymentStatus, notes } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'No items in purchase' });

    let totalCost = 0;
    const purchaseItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
      const total = item.cost * item.quantity;
      totalCost += total;
      purchaseItems.push({ product: product._id, name: product.name, quantity: item.quantity, cost: item.cost, total });
    }

    const purchase = await Purchase.create({
      orderNumber: generateOrderNumber(),
      supplier: supplierId,
      items: purchaseItems,
      totalCost,
      purchaseDate: purchaseDate || new Date(),
      paymentStatus: paymentStatus || 'pending',
      notes,
      createdBy: req.user.id,
    });

    // Update stock for each product
    for (const item of purchaseItems) {
      const product = await Product.findById(item.product);
      const previousStock = product.stock;
      product.stock += item.quantity;
      await product.save();
      await Inventory.create({
        product: item.product, type: 'purchase', quantity: item.quantity,
        previousStock, currentStock: product.stock, performedBy: req.user.id,
        reference: 'Purchase', referenceId: purchase._id,
      });
    }

    // Update supplier total purchases
    await Supplier.findByIdAndUpdate(supplierId, { $inc: { totalPurchases: totalCost } });

    await Notification.create({ type: 'purchase_received', title: 'Purchase Order Created', message: `Purchase order ${purchase.orderNumber} created for $${totalCost.toFixed(2)}` });
    await ActivityLog.create({ user: req.user.id, action: 'Created', entity: 'Purchase', entityId: purchase._id, details: `Created purchase order ${purchase.orderNumber} - $${totalCost.toFixed(2)}` });

    res.status(201).json({ success: true, purchase });
  } catch (err) { next(err); }
};

exports.updatePurchaseStatus = async (req, res, next) => {
  try {
    const purchase = await Purchase.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found' });
    res.json({ success: true, purchase });
  } catch (err) { next(err); }
};
