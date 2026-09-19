const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');

exports.getProducts = async (req, res, next) => {
  try {
    const { search, category, supplier, minPrice, maxPrice, lowStock, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    if (category) query.category = category;
    if (supplier) query.supplier = supplier;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock', '$minimumStock'] };
    }
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('supplier', 'name company')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, count: products.length, total, totalPages: Math.ceil(total / limit), page: Number(page), products });
  } catch (err) { next(err); }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name').populate('supplier', 'name company');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    if (req.file) req.body.image = req.file.path;
    const product = await Product.create(req.body);

    if (product.stock > 0) {
      await Inventory.create({
        product: product._id,
        supplier: product.supplier || null,
        type: 'opening_stock',
        quantity: product.stock,
        previousStock: 0,
        currentStock: product.stock,
        reference: `OPN-${product.sku}`,
        notes: 'Initial opening stock balance',
        performedBy: req.user.id,
      });
    }

    if (product.stock <= product.minimumStock) {
      await Notification.create({ type: 'low_stock', title: 'Low Stock Alert', message: `${product.name} is low in stock (${product.stock} remaining)` });
    }
    await ActivityLog.create({ user: req.user.id, action: 'Created', entity: 'Product', entityId: product._id, details: `Added product: ${product.name}` });
    res.status(201).json({ success: true, product });
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    if (req.file) req.body.image = req.file.path;
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (product.stock <= product.minimumStock) {
      await Notification.create({ type: 'low_stock', title: 'Low Stock Alert', message: `${product.name} is low in stock (${product.stock} remaining)` });
    }
    await ActivityLog.create({ user: req.user.id, action: 'Updated', entity: 'Product', entityId: product._id, details: `Updated product: ${product.name}` });
    res.json({ success: true, product });
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    await ActivityLog.create({ user: req.user.id, action: 'Deleted', entity: 'Product', entityId: product._id, details: `Deleted product: ${product.name}` });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
};

exports.getLowStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true, $expr: { $lte: ['$stock', '$minimumStock'] } })
      .populate('category', 'name')
      .sort('stock');
    res.json({ success: true, count: products.length, products });
  } catch (err) { next(err); }
};
