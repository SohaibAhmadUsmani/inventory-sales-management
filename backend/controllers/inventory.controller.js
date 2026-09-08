const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

exports.getInventory = async (req, res, next) => {
  try {
    const { product, type, page = 1, limit = 20 } = req.query;
    const query = {};
    if (product) query.product = product;
    if (type) query.type = type;
    const total = await Inventory.countDocuments(query);
    const records = await Inventory.find(query)
      .populate('product', 'name sku')
      .populate('performedBy', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, count: records.length, total, totalPages: Math.ceil(total / limit), page: Number(page), records });
  } catch (err) { next(err); }
};

exports.stockIn = async (req, res, next) => {
  try {
    const { productId, quantity, notes } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const previousStock = product.stock;
    product.stock += Number(quantity);
    await product.save();
    const record = await Inventory.create({
      product: productId, type: 'stock_in', quantity: Number(quantity),
      previousStock, currentStock: product.stock, notes, performedBy: req.user.id, reference: 'Manual Stock In',
    });
    if (product.stock <= product.minimumStock) {
      await Notification.create({ type: 'low_stock', title: 'Low Stock Alert', message: `${product.name} is low in stock (${product.stock} remaining)` });
    }
    await ActivityLog.create({ user: req.user.id, action: 'Stock In', entity: 'Inventory', entityId: record._id, details: `Stocked in ${quantity} of ${product.name}` });
    res.status(201).json({ success: true, record, product });
  } catch (err) { next(err); }
};

exports.stockOut = async (req, res, next) => {
  try {
    const { productId, quantity, notes } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ success: false, message: 'Insufficient stock' });
    const previousStock = product.stock;
    product.stock -= Number(quantity);
    await product.save();
    const record = await Inventory.create({
      product: productId, type: 'stock_out', quantity: Number(quantity),
      previousStock, currentStock: product.stock, notes, performedBy: req.user.id, reference: 'Manual Stock Out',
    });
    if (product.stock <= product.minimumStock) {
      await Notification.create({ type: 'low_stock', title: 'Low Stock Alert', message: `${product.name} is low in stock (${product.stock} remaining)` });
    }
    await ActivityLog.create({ user: req.user.id, action: 'Stock Out', entity: 'Inventory', entityId: record._id, details: `Stocked out ${quantity} of ${product.name}` });
    res.status(201).json({ success: true, record, product });
  } catch (err) { next(err); }
};

exports.damagedStock = async (req, res, next) => {
  try {
    const { productId, quantity, notes } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ success: false, message: 'Insufficient stock' });
    const previousStock = product.stock;
    product.stock -= Number(quantity);
    await product.save();
    const record = await Inventory.create({
      product: productId, type: 'damaged', quantity: Number(quantity),
      previousStock, currentStock: product.stock, notes, performedBy: req.user.id, reference: 'Damaged Stock',
    });
    await ActivityLog.create({ user: req.user.id, action: 'Damaged Stock', entity: 'Inventory', entityId: record._id, details: `${quantity} of ${product.name} marked as damaged` });
    res.status(201).json({ success: true, record, product });
  } catch (err) { next(err); }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, newQuantity, notes } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const previousStock = product.stock;
    const diff = Number(newQuantity) - previousStock;
    product.stock = Number(newQuantity);
    await product.save();
    const record = await Inventory.create({
      product: productId, type: 'adjustment', quantity: Math.abs(diff),
      previousStock, currentStock: product.stock, notes, performedBy: req.user.id, reference: 'Stock Adjustment',
    });
    await ActivityLog.create({ user: req.user.id, action: 'Stock Adjustment', entity: 'Inventory', entityId: record._id, details: `${product.name} stock adjusted from ${previousStock} to ${product.stock}` });
    res.status(201).json({ success: true, record, product });
  } catch (err) { next(err); }
};

exports.getStockByProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId).populate('category', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const history = await Inventory.find({ product: req.params.productId }).populate('performedBy', 'name').sort('-createdAt');
    res.json({ success: true, product, history });
  } catch (err) { next(err); }
};
