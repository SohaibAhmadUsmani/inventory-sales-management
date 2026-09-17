const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

const generateTrxId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${num}`;
};

/**
 * GET /api/inventory/stats
 * Aggregates high-level inventory KPIs for the 4 stat cards + audit status
 */
exports.getInventoryStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [productMetrics] = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalStockItems: { $sum: '$stock' },
          totalProductCount: { $sum: 1 },
          totalPortfolioCost: { $sum: { $multiply: ['$stock', '$cost'] } },
          totalPortfolioRetail: { $sum: { $multiply: ['$stock', '$price'] } },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$stock', '$minimumStock'] }, 1, 0],
            },
          },
          outOfStockCount: {
            $sum: {
              $cond: [{ $eq: ['$stock', 0] }, 1, 0],
            },
          },
        },
      },
    ]) || [{
      totalStockItems: 0,
      totalProductCount: 0,
      totalPortfolioCost: 0,
      totalPortfolioRetail: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    }];

    const [todayMetrics] = await Inventory.aggregate([
      { $match: { createdAt: { $gte: today } } },
      {
        $group: {
          _id: null,
          movementsToday: { $sum: 1 },
          unitsMovedToday: { $sum: '$quantity' },
        },
      },
    ]) || [{ movementsToday: 0, unitsMovedToday: 0 }];

    const totalProds = productMetrics?.totalProductCount || 0;
    const lowStock = productMetrics?.lowStockCount || 0;
    const accuracyRate = totalProds > 0 ? Math.round(((totalProds - lowStock) / totalProds) * 1000) / 10 : 100;

    res.json({
      success: true,
      stats: {
        totalStockedItems: productMetrics?.totalStockItems || 0,
        totalProductCount: totalProds,
        criticalLowStock: lowStock,
        outOfStockCount: productMetrics?.outOfStockCount || 0,
        movementsToday: todayMetrics?.movementsToday || 0,
        unitsMovedToday: todayMetrics?.unitsMovedToday || 0,
        totalPortfolioValue: Math.round((productMetrics?.totalPortfolioCost || 0) * 100) / 100,
        totalRetailValue: Math.round((productMetrics?.totalPortfolioRetail || 0) * 100) / 100,
        accuracyRate,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory
 * Retrieves paginated, forensic movement ledger with rich search & filters
 */
exports.getInventory = async (req, res, next) => {
  try {
    const { product, type, search, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query = {};

    if (type && type !== 'all') {
      if (type === 'inbound') {
        query.type = { $in: ['stock_in', 'purchase'] };
      } else if (type === 'outbound') {
        query.type = { $in: ['stock_out', 'sale'] };
      } else {
        query.type = type;
      }
    }

    if (product) {
      query.product = product;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search && search.trim()) {
      const matchingProducts = await Product.find({
        $or: [
          { name: { $regex: search.trim(), $options: 'i' } },
          { sku: { $regex: search.trim(), $options: 'i' } },
        ],
      }).select('_id');

      const productIds = matchingProducts.map((p) => p._id);

      query.$or = [
        { product: { $in: productIds } },
        { reference: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const total = await Inventory.countDocuments(query);
    const records = await Inventory.find(query)
      .populate({
        path: 'product',
        select: 'name sku image price cost stock minimumStock',
        populate: { path: 'category', select: 'name' },
      })
      .populate('performedBy', 'name role')
      .sort('-createdAt')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const formattedRecords = records.map((r) => {
      const doc = r.toObject();
      let differential = doc.quantity;
      if (['stock_out', 'damaged', 'sale'].includes(doc.type)) {
        differential = -Math.abs(doc.quantity);
      } else if (doc.type === 'adjustment') {
        differential = doc.currentStock - doc.previousStock;
      } else {
        differential = Math.abs(doc.quantity);
      }

      const refCode = doc.reference && doc.reference.startsWith('TRX-')
        ? doc.reference
        : `TRX-${doc._id.toString().slice(-4).toUpperCase()}`;

      return {
        ...doc,
        differential,
        trxCode: refCode,
        status: 'completed',
      };
    });

    res.json({
      success: true,
      count: formattedRecords.length,
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1,
      page: Number(page),
      records: formattedRecords,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/current-stock
 * Catalog stock view with low-stock status and valuation
 */
exports.getCurrentStock = async (req, res, next) => {
  try {
    const { category, search, status, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };

    if (category) query.category = category;
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { sku: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (status === 'critical' || status === 'low_stock') {
      query.$expr = { $lte: ['$stock', '$minimumStock'] };
    } else if (status === 'out_of_stock') {
      query.stock = 0;
    } else if (status === 'in_stock') {
      query.$expr = { $gt: ['$stock', '$minimumStock'] };
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('supplier', 'name company')
      .sort('name')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const enriched = products.map((p) => {
      const doc = p.toObject();
      const isCritical = doc.stock === 0;
      const isLow = doc.stock <= doc.minimumStock;
      return {
        ...doc,
        stockStatus: isCritical ? 'critical' : isLow ? 'low_stock' : 'in_stock',
        stockValue: Math.round(doc.stock * doc.cost * 100) / 100,
        retailValue: Math.round(doc.stock * doc.price * 100) / 100,
      };
    });

    res.json({
      success: true,
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1,
      page: Number(page),
      products: enriched,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/low-stock
 * Dedicated endpoint for items requiring replenishment
 */
exports.getLowStockAlerts = async (req, res, next) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$minimumStock'] },
    })
      .populate('category', 'name')
      .populate('supplier', 'name company phone')
      .sort({ stock: 1 });

    const alerts = products.map((p) => {
      const deficit = Math.max(0, p.minimumStock - p.stock);
      return {
        _id: p._id,
        name: p.name,
        sku: p.sku,
        image: p.image,
        category: p.category?.name || 'General',
        stock: p.stock,
        minimumStock: p.minimumStock,
        deficit,
        isOutOfStock: p.stock === 0,
        supplier: p.supplier?.name || null,
      };
    });

    res.json({ success: true, count: alerts.length, alerts });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/export-csv
 * Exports movement logs as downloadable CSV
 */
exports.exportLedgerCsv = async (req, res, next) => {
  try {
    const { type, search, startDate, endDate } = req.query;
    const query = {};

    if (type && type !== 'all') {
      if (type === 'inbound') query.type = { $in: ['stock_in', 'purchase'] };
      else if (type === 'outbound') query.type = { $in: ['stock_out', 'sale'] };
      else query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search && search.trim()) {
      const matchingProducts = await Product.find({
        $or: [
          { name: { $regex: search.trim(), $options: 'i' } },
          { sku: { $regex: search.trim(), $options: 'i' } },
        ],
      }).select('_id');
      const productIds = matchingProducts.map((p) => p._id);
      query.$or = [
        { product: { $in: productIds } },
        { reference: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const records = await Inventory.find(query)
      .populate('product', 'name sku')
      .populate('performedBy', 'name')
      .sort('-createdAt')
      .limit(1000);

    const headers = ['Reference ID,Date & Time,Product Name,SKU,Vector Type,Quantity Change,Previous Stock,Current Stock,Reason / Note,Authorized By\n'];
    const rows = records.map((r) => {
      let diff = r.quantity;
      if (['stock_out', 'damaged', 'sale'].includes(r.type)) diff = -Math.abs(r.quantity);
      else if (r.type === 'adjustment') diff = r.currentStock - r.previousStock;
      else diff = Math.abs(r.quantity);

      const ref = r.reference || `TRX-${r._id.toString().slice(-4).toUpperCase()}`;
      const dateStr = new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19);
      const prodName = `"${(r.product?.name || 'N/A').replace(/"/g, '""')}"`;
      const sku = `"${(r.product?.sku || 'N/A').replace(/"/g, '""')}"`;
      const notes = `"${(r.notes || r.reference || '').replace(/"/g, '""')}"`;
      const userName = `"${(r.performedBy?.name || 'System').replace(/"/g, '""')}"`;

      return `${ref},${dateStr},${prodName},${sku},${r.type},${diff > 0 ? '+' + diff : diff},${r.previousStock},${r.currentStock},${notes},${userName}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-ledger-${Date.now()}.csv"`);
    res.status(200).send(headers.concat(rows).join(''));
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/stock-in
 * Manual stock intake with atomic increment and humanized activity logging
 */
exports.stockIn = async (req, res, next) => {
  try {
    const { productId, quantity, reference, notes } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer greater than zero.' });
    }

    // Atomically increment stock and return the updated product document
    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: qty } },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const currentStock = product.stock;
    const previousStock = currentStock - qty;
    const trxId = reference && reference.trim() ? reference.trim() : generateTrxId();

    const record = await Inventory.create({
      product: productId,
      type: 'stock_in',
      quantity: qty,
      previousStock,
      currentStock,
      reference: trxId,
      notes: notes || 'Manual Stock Inbound',
      performedBy: req.user.id,
    });

    if (currentStock <= product.minimumStock) {
      await Notification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${product.name} is currently low in stock (${currentStock} units remaining).`,
      });
    }

    const userDisplayName = req.user.name || 'Staff';
    await ActivityLog.create({
      user: req.user.id,
      action: 'Stock In',
      entity: 'Inventory',
      entityId: record._id,
      details: `${userDisplayName} logged stock intake of +${qty} units for ${product.name} (${product.sku}). Balance updated to ${currentStock}.`,
    });

    res.status(201).json({
      success: true,
      message: `Successfully received ${qty} units of ${product.name}.`,
      record,
      product,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/stock-out
 * Manual stock dispatch with atomic deduction and negative balance protection
 */
exports.stockOut = async (req, res, next) => {
  try {
    const { productId, quantity, reference, notes } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer greater than zero.' });
    }

    // Atomic deduction: only updates if current stock is at least qty
    const product = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );

    if (!product) {
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${existingProduct.name}. Available on hand: ${existingProduct.stock} units, requested: ${qty} units.`,
      });
    }

    const currentStock = product.stock;
    const previousStock = currentStock + qty;
    const trxId = reference && reference.trim() ? reference.trim() : generateTrxId();

    const record = await Inventory.create({
      product: productId,
      type: 'stock_out',
      quantity: qty,
      previousStock,
      currentStock,
      reference: trxId,
      notes: notes || 'Manual Stock Outbound',
      performedBy: req.user.id,
    });

    if (currentStock <= product.minimumStock) {
      await Notification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${product.name} is low in stock (${currentStock} units remaining).`,
      });
    }

    const userDisplayName = req.user.name || 'Staff';
    await ActivityLog.create({
      user: req.user.id,
      action: 'Stock Out',
      entity: 'Inventory',
      entityId: record._id,
      details: `${userDisplayName} dispatched -${qty} units of ${product.name} (${product.sku}). Remaining balance: ${currentStock}.`,
    });

    res.status(201).json({
      success: true,
      message: `Successfully dispatched ${qty} units of ${product.name}.`,
      record,
      product,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/damaged
 * Records broken/expired goods with atomic deduction
 */
exports.damagedStock = async (req, res, next) => {
  try {
    const { productId, quantity, reason, notes } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Damaged quantity must be a positive number.' });
    }

    // Atomic deduction: only updates if stock >= qty
    const product = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true }
    );

    if (!product) {
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.status(400).json({
        success: false,
        message: `Cannot write off ${qty} units of ${existingProduct.name}. Available on hand: ${existingProduct.stock} units.`,
      });
    }

    const currentStock = product.stock;
    const previousStock = currentStock + qty;
    const trxId = generateTrxId();
    const damageDescription = reason ? `${reason}${notes ? `: ${notes}` : ''}` : notes || 'Damaged in warehouse';

    const record = await Inventory.create({
      product: productId,
      type: 'damaged',
      quantity: qty,
      previousStock,
      currentStock,
      reference: trxId,
      notes: damageDescription,
      performedBy: req.user.id,
    });

    if (currentStock <= product.minimumStock) {
      await Notification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${product.name} is now low in stock (${currentStock} units) following damage write-off.`,
      });
    }

    const userDisplayName = req.user.name || 'Staff';
    await ActivityLog.create({
      user: req.user.id,
      action: 'Damaged Stock',
      entity: 'Inventory',
      entityId: record._id,
      details: `${userDisplayName} logged ${qty} damaged units of ${product.name} (${product.sku}). Rationale: ${damageDescription}.`,
    });

    res.status(201).json({
      success: true,
      message: `Recorded ${qty} damaged units for ${product.name}.`,
      record,
      product,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/adjust
 * Physical cycle count reconciliation with differential tracking
 */
exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, newQuantity, reason, notes } = req.body;
    const countedQty = Number(newQuantity);

    if (isNaN(countedQty) || countedQty < 0) {
      return res.status(400).json({ success: false, message: 'Counted physical stock must be a non-negative number.' });
    }

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const previousStock = existingProduct.stock;
    const diff = countedQty - previousStock;

    existingProduct.stock = countedQty;
    await existingProduct.save();

    const trxId = generateTrxId();
    const rationale = reason ? `${reason}${notes ? ` - ${notes}` : ''}` : notes || 'Cycle count reconciliation';

    const record = await Inventory.create({
      product: productId,
      type: 'adjustment',
      quantity: Math.abs(diff),
      previousStock,
      currentStock: countedQty,
      reference: trxId,
      notes: rationale,
      performedBy: req.user.id,
    });

    if (countedQty <= existingProduct.minimumStock) {
      await Notification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${existingProduct.name} is low in stock (${countedQty} units remaining) after count adjustment.`,
      });
    }

    const userDisplayName = req.user.name || 'Staff';
    await ActivityLog.create({
      user: req.user.id,
      action: 'Stock Adjustment',
      entity: 'Inventory',
      entityId: record._id,
      details: `${userDisplayName} reconciled ${existingProduct.name} (${existingProduct.sku}) from ${previousStock} to ${countedQty} (${diff >= 0 ? '+' : ''}${diff} diff). Reason: ${rationale}.`,
    });

    res.status(201).json({
      success: true,
      message: `Reconciled ${existingProduct.name} stock: ${previousStock} → ${countedQty} (${diff >= 0 ? '+' : ''}${diff} diff).`,
      record,
      product: existingProduct,
      diff,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/product/:productId
 * Product-specific movement history
 */
exports.getStockByProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId).populate('category', 'name');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const history = await Inventory.find({ product: req.params.productId })
      .populate('performedBy', 'name role')
      .sort('-createdAt');

    res.json({ success: true, product, history });
  } catch (err) {
    next(err);
  }
};
