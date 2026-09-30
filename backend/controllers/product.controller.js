const Product = require('../models/Product');
const Inventory = require('../models/Inventory');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getProducts = async (req, res, next) => {
  try {
    const { search, category, supplier, minPrice, maxPrice, lowStock } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const query = { isActive: true };
    if (search && String(search).trim()) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { sku: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    if (supplier) query.supplier = supplier;

    const hasMinPrice = minPrice !== undefined && minPrice !== '' && !Number.isNaN(Number(minPrice));
    const hasMaxPrice = maxPrice !== undefined && maxPrice !== '' && !Number.isNaN(Number(maxPrice));
    if (hasMinPrice || hasMaxPrice) {
      query.price = {};
      if (hasMinPrice) query.price.$gte = Number(minPrice);
      if (hasMaxPrice) query.price.$lte = Number(maxPrice);
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
      .limit(limit);

    res.json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      page,
      products,
    });
  } catch (err) {
    next(err);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('supplier', 'name company');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    if (req.file) {
      req.body.image = `/uploads/${req.file.filename}`;
    }
    if (
      req.body.supplier === '' ||
      req.body.supplier === 'null' ||
      req.body.supplier === 'undefined' ||
      !req.body.supplier
    ) {
      req.body.supplier = null;
    }

    if (req.body.sku) {
      req.body.sku = String(req.body.sku).trim();
      const escapedSku = escapeRegex(req.body.sku);
      const deletedMatch = await Product.findOne({
        sku: { $regex: `^${escapedSku}$`, $options: 'i' },
        isActive: false,
      });
      if (deletedMatch) {
        deletedMatch.sku = `${deletedMatch.sku}-deleted-${Date.now()}`;
        await deletedMatch.save({ validateBeforeSave: false });
      }
    }

    const product = await Product.create(req.body);

    try {
      await Inventory.create({
        product: product._id,
        supplier: product.supplier || null,
        type: 'opening_stock',
        quantity: product.stock,
        previousStock: 0,
        currentStock: product.stock,
        reference: `OPN-${product.sku}`,
        notes: product.stock > 0 ? 'Initial opening stock balance' : 'Initial zero-stock baseline registration',
        performedBy: req.user.id,
      });
    } catch (invErr) {
      await Product.findByIdAndDelete(product._id);
      throw invErr;
    }

    if (product.stock <= product.minimumStock) {
      await Notification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${product.name} is low in stock (${product.stock} remaining)`,
        referenceId: product._id,
      });
    }

    await ActivityLog.create({
      user: req.user.id,
      action: 'Created',
      entity: 'Product',
      entityId: product._id,
      details: `Added product: ${product.name}`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    await product.populate([
      { path: 'category', select: 'name' },
      { path: 'supplier', select: 'name company' },
    ]);

    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    if (req.file) {
      req.body.image = `/uploads/${req.file.filename}`;
    }
    if (
      req.body.supplier === '' ||
      req.body.supplier === 'null' ||
      req.body.supplier === 'undefined'
    ) {
      req.body.supplier = null;
    }

    // Strict audit lock: Stock cannot be modified directly via product update endpoint
    delete req.body.stock;

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('category', 'name')
      .populate('supplier', 'name company');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (product.stock <= product.minimumStock) {
      const existingUnread = await Notification.findOne({
        type: 'low_stock',
        referenceId: product._id,
        isRead: false,
      });
      if (!existingUnread) {
        await Notification.create({
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${product.name} is low in stock (${product.stock} remaining)`,
          referenceId: product._id,
        });
      }
    }

    await ActivityLog.create({
      user: req.user.id,
      action: 'Updated',
      entity: 'Product',
      entityId: product._id,
      details: `Updated product: ${product.name}`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

    if (existing.stock > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete product with active inventory (${existing.stock} units on hand). Reconcile or write off stock first.`,
      });
    }

    existing.isActive = false;
    await existing.save();

    await ActivityLog.create({
      user: req.user.id,
      action: 'Deleted',
      entity: 'Product',
      entityId: existing._id,
      details: `Deactivated product: ${existing.name}`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) {
    next(err);
  }
};

exports.getLowStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$minimumStock'] },
    })
      .populate('category', 'name')
      .populate('supplier', 'name company')
      .sort('stock');
    res.json({ success: true, count: products.length, products });
  } catch (err) {
    next(err);
  }
};

