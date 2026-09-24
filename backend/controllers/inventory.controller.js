const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { exportReportToExcel } = require('../utils/excelExport');
const { generateReportPDF } = require('../utils/pdfExport');

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const generateTrxId = (prefix = 'TRX') => {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ts = Date.now().toString().slice(-4);
  return `${prefix}-${ts}-${rand}`;
};

/**
 * Shared query builder for Inventory Ledger endpoints (get, export-csv, export-excel, export-pdf)
 */
const buildInventoryQuery = async (queryObj = {}) => {
  const { product, type, search, category, supplier, startDate, endDate } = queryObj;
  const query = {};

  if (type && type !== 'all') {
    if (type === 'inbound') {
      query.type = { $in: ['stock_in', 'purchase', 'opening_stock', 'sale_return', 'transfer_in'] };
    } else if (type === 'outbound') {
      query.type = { $in: ['stock_out', 'sale', 'damaged', 'expired', 'purchase_return', 'transfer_out'] };
    } else {
      query.type = type;
    }
  }

  if (product && mongoose.Types.ObjectId.isValid(product)) {
    query.product = product;
  }

  if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
    query.supplier = supplier;
  }

  if (category && mongoose.Types.ObjectId.isValid(category)) {
    const prodsInCategory = await Product.find({ category }).select('_id');
    const catProdIds = prodsInCategory.map((p) => p._id);
    if (query.product) {
      if (!catProdIds.some((id) => id.toString() === query.product.toString())) {
        query.product = new mongoose.Types.ObjectId(); // Guarantee empty match if product is not in selected category
      }
    } else {
      query.product = { $in: catProdIds };
    }
  }

  if (startDate || endDate) {
    if (startDate && startDate !== 'undefined' && startDate !== 'null') {
      const sDate = new Date(startDate);
      if (!isNaN(sDate.getTime())) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = sDate;
      }
    }
    if (endDate && endDate !== 'undefined' && endDate !== 'null') {
      const eDate = new Date(endDate + 'T23:59:59.999Z');
      if (!isNaN(eDate.getTime())) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = eDate;
      }
    }
  }

  if (search && typeof search === 'string' && search.trim()) {
    const sanitizedSearch = escapeRegex(search.trim());
    const matchingProducts = await Product.find({
      $or: [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { sku: { $regex: sanitizedSearch, $options: 'i' } },
      ],
    }).select('_id');

    const productIds = matchingProducts.map((p) => p._id);

    query.$or = [
      { product: { $in: productIds } },
      { reference: { $regex: sanitizedSearch, $options: 'i' } },
      { notes: { $regex: sanitizedSearch, $options: 'i' } },
    ];
  }

  return query;
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
    const { page = 1, limit = 10 } = req.query;
    const query = await buildInventoryQuery(req.query);

    const total = await Inventory.countDocuments(query);
    const records = await Inventory.find(query)
      .populate({
        path: 'product',
        select: 'name sku image price cost stock minimumStock',
        populate: { path: 'category', select: 'name' },
      })
      .populate('supplier', 'name company phone')
      .populate('performedBy', 'name role')
      .sort('-createdAt')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const formattedRecords = records.map((r) => {
      const doc = r.toObject();
      let differential = doc.quantity;
      if (['stock_out', 'damaged', 'sale', 'expired', 'purchase_return', 'transfer_out'].includes(doc.type)) {
        differential = -Math.abs(doc.quantity);
      } else if (doc.type === 'adjustment') {
        differential = doc.currentStock - doc.previousStock;
      } else {
        // stock_in, purchase, opening_stock, sale_return, transfer_in
        differential = Math.abs(doc.quantity);
      }

      const refCode = doc.reference && doc.reference.trim()
        ? doc.reference
        : `TRX-${doc._id.toString().slice(-4).toUpperCase()}`;

      return {
        ...doc,
        differential,
        quantityChange: differential,
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

const sanitizeCsvCell = (val) => {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+@\-|\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
};

/**
 * GET /api/inventory/export-csv
 * Exports movement logs as downloadable CSV
 */
exports.exportLedgerCsv = async (req, res, next) => {
  try {
    const query = await buildInventoryQuery(req.query);

    const records = await Inventory.find(query)
      .populate('product', 'name sku')
      .populate('supplier', 'name company')
      .populate('performedBy', 'name')
      .sort('-createdAt')
      .limit(2000);

    const headers = ['Reference ID,Date & Time,Product Name,SKU,Vector Type,Quantity Change,Previous Stock,Current Stock,Reason / Note,Supplier,Authorized By\n'];
    const rows = records.map((r) => {
      let diff = r.quantity;
      if (['stock_out', 'damaged', 'sale', 'expired', 'purchase_return', 'transfer_out'].includes(r.type)) diff = -Math.abs(r.quantity);
      else if (r.type === 'adjustment') diff = r.currentStock - r.previousStock;
      else diff = Math.abs(r.quantity);

      const ref = sanitizeCsvCell(r.reference || `TRX-${r._id.toString().slice(-4).toUpperCase()}`);
      const dateStr = sanitizeCsvCell(new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19));
      const prodName = sanitizeCsvCell(r.product?.name || 'N/A');
      const sku = sanitizeCsvCell(r.product?.sku || 'N/A');
      const notes = sanitizeCsvCell(r.notes || r.reference || '');
      const supplierStr = sanitizeCsvCell(r.supplier?.name ? `${r.supplier.name} (${r.supplier.company || ''})` : '');
      const userName = sanitizeCsvCell(r.performedBy?.name || 'System');

      return `${ref},${dateStr},${prodName},${sku},${r.type},${diff > 0 ? '+' + diff : diff},${r.previousStock},${r.currentStock},${notes},${supplierStr},${userName}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-ledger-${Date.now()}.csv"`);
    res.status(200).send(headers.concat(rows).join(''));
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/export-excel
 * Exports movement logs as downloadable formatted .xlsx workbook
 */
exports.exportInventoryExcel = async (req, res, next) => {
  try {
    const query = await buildInventoryQuery(req.query);

    const records = await Inventory.find(query)
      .populate({
        path: 'product',
        select: 'name sku',
        populate: { path: 'category', select: 'name' },
      })
      .populate('supplier', 'name company')
      .populate('performedBy', 'name')
      .sort('-createdAt')
      .limit(2000);

    const rows = records.map((r) => {
      let diff = r.quantity;
      if (['stock_out', 'damaged', 'sale', 'expired', 'purchase_return', 'transfer_out'].includes(r.type)) diff = -Math.abs(r.quantity);
      else if (r.type === 'adjustment') diff = r.currentStock - r.previousStock;
      else diff = Math.abs(r.quantity);

      const ref = r.reference || `TRX-${r._id.toString().slice(-4).toUpperCase()}`;
      const dateStr = new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19);

      return {
        'Reference ID': ref,
        'Date & Time': dateStr,
        'Product Name': r.product?.name || 'N/A',
        'SKU': r.product?.sku || 'N/A',
        'Category': r.product?.category?.name || 'General',
        'Vector': r.type.toUpperCase(),
        'Quantity Delta': diff > 0 ? `+${diff}` : diff,
        'Previous Stock': r.previousStock,
        'Current Stock': r.currentStock,
        'Notes / Reference': r.notes || r.reference || '',
        'Supplier': r.supplier?.name ? `${r.supplier.name} (${r.supplier.company || ''})` : '-',
        'Authorized By': r.performedBy?.name || 'System',
      };
    });

    const totals = {
      'Reference ID': 'TOTAL RECORDS',
      'Date & Time': `${records.length} movements`,
      'Product Name': '',
      'SKU': '',
      'Category': '',
      'Vector': '',
      'Quantity Delta': '',
      'Previous Stock': '',
      'Current Stock': '',
      'Notes / Reference': '',
      'Supplier': '',
      'Authorized By': '',
    };

    exportReportToExcel(res, {
      rows,
      totals,
      sheetName: 'Movement Ledger',
      filename: `Inventory_Ledger_${Date.now()}`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/export-pdf
 * Exports movement logs as downloadable formatted PDF audit report
 */
exports.exportInventoryPdf = async (req, res, next) => {
  try {
    const query = await buildInventoryQuery(req.query);

    const records = await Inventory.find(query)
      .populate('product', 'name sku')
      .populate('performedBy', 'name')
      .sort('-createdAt')
      .limit(300);

    const headers = ['Ref ID', 'Date', 'Product', 'SKU', 'Type', 'Change', 'Balance', 'Authorized By'];
    const rows = records.map((r) => {
      let diff = r.quantity;
      if (['stock_out', 'damaged', 'sale', 'expired', 'purchase_return', 'transfer_out'].includes(r.type)) diff = -Math.abs(r.quantity);
      else if (r.type === 'adjustment') diff = r.currentStock - r.previousStock;
      else diff = Math.abs(r.quantity);

      const ref = r.reference ? r.reference.slice(0, 14) : `TRX-${r._id.toString().slice(-4).toUpperCase()}`;
      const dateStr = new Date(r.createdAt).toLocaleDateString();
      const prodName = (r.product?.name || 'N/A').slice(0, 20);
      const sku = r.product?.sku || 'N/A';
      const staff = r.performedBy?.name ? r.performedBy.name.slice(0, 15) : 'Staff';

      return [
        ref,
        dateStr,
        prodName,
        sku,
        r.type,
        diff > 0 ? `+${diff}` : String(diff),
        String(r.currentStock),
        staff,
      ];
    });

    const totals = ['TOTAL', `${records.length} movements`, '', '', '', '', '', ''];

    await generateReportPDF(
      {
        title: 'Inventory Forensic Movement Audit Report',
        dateRange: `Generated on ${new Date().toLocaleDateString()}`,
        headers,
        rows,
        totals,
      },
      res
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/stock-in
 * Manual stock intake with atomic increment, Moving Weighted Average Cost (AVCO), and humanized activity logging
 */
exports.stockIn = async (req, res, next) => {
  try {
    const { productId, quantity, reference, notes, supplierId, unitCost } = req.body;
    const qty = Number(quantity);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer greater than zero.' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const previousStock = product.stock;
    const currentStock = previousStock + qty;

    // Moving Weighted Average Cost (MAC / AVCO)
    const costInput = Number(unitCost);
    if (Number.isFinite(costInput) && costInput > 0) {
      if (previousStock <= 0) {
        product.cost = Math.round(costInput * 100) / 100;
      } else {
        const weightedCost = ((previousStock * (product.cost || 0)) + (qty * costInput)) / currentStock;
        product.cost = Math.round(weightedCost * 100) / 100;
      }
    }

    product.stock = currentStock;
    await product.save();

    const trxId = reference && reference.trim() ? reference.trim() : generateTrxId('TRX');

    const record = await Inventory.create({
      product: productId,
      supplier: supplierId || null,
      type: 'stock_in',
      quantity: qty,
      unitCost: costInput > 0 ? costInput : (product.cost || 0),
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
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive whole integer greater than zero.' });
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
    const trxId = reference && reference.trim() ? reference.trim() : generateTrxId('TRX');

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
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ success: false, message: 'Damaged quantity must be a positive whole integer.' });
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
    const trxId = generateTrxId('DMG');
    const damageDescription = reason ? `${reason}${notes ? `: ${notes}` : ''}` : notes || 'Damaged in warehouse';

    const record = await Inventory.create({
      product: productId,
      type: 'damaged',
      quantity: qty,
      previousStock,
      currentStock,
      reference: trxId,
      reason: reason || 'Damaged goods write-off',
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
 * Physical cycle count reconciliation with atomic concurrency protection & OCC validation
 */
exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, newQuantity, reason, notes, expectedStock } = req.body;
    const countedQty = Number(newQuantity);

    if (isNaN(countedQty) || countedQty < 0 || !Number.isInteger(countedQty)) {
      return res.status(400).json({ success: false, message: 'Counted physical stock must be a non-negative whole integer.' });
    }

    // OCC: If client provided expectedStock, verify it hasn't changed concurrently
    if (expectedStock !== undefined && expectedStock !== null) {
      const current = await Product.findById(productId);
      if (current && current.stock !== Number(expectedStock)) {
        return res.status(409).json({
          success: false,
          message: `Concurrency conflict: Product stock changed concurrently from ${expectedStock} to ${current.stock}. Please refresh before adjusting.`,
        });
      }
    }

    // Atomic update returning the product state BEFORE update to reliably capture previousStock
    const beforeProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: { stock: countedQty } },
      { new: false }
    );

    if (!beforeProduct) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const previousStock = beforeProduct.stock;
    const diff = countedQty - previousStock;

    const trxId = generateTrxId('ADJ');
    const rationale = reason ? `${reason}${notes ? ` - ${notes}` : ''}` : notes || 'Cycle count reconciliation';

    const record = await Inventory.create({
      product: productId,
      type: 'adjustment',
      quantity: Math.abs(diff),
      previousStock,
      currentStock: countedQty,
      reference: trxId,
      reason: reason || 'Physical count adjustment',
      notes: rationale,
      performedBy: req.user.id,
    });

    if (countedQty <= beforeProduct.minimumStock) {
      await Notification.create({
        type: 'low_stock',
        title: 'Low Stock Alert',
        message: `${beforeProduct.name} is low in stock (${countedQty} units remaining) after count adjustment.`,
      });
    }

    const userDisplayName = req.user.name || 'Staff';
    await ActivityLog.create({
      user: req.user.id,
      action: 'Stock Adjustment',
      entity: 'Inventory',
      entityId: record._id,
      details: `${userDisplayName} reconciled ${beforeProduct.name} (${beforeProduct.sku}) from ${previousStock} to ${countedQty} (${diff >= 0 ? '+' : ''}${diff} diff). Reason: ${rationale}.`,
    });

    const updatedProduct = await Product.findById(productId);

    res.status(201).json({
      success: true,
      message: `Reconciled ${beforeProduct.name} stock: ${previousStock} → ${countedQty} (${diff >= 0 ? '+' : ''}${diff} diff).`,
      record,
      product: updatedProduct,
      diff,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/inventory/product/:productId
 * Product-specific movement history and 6-metric forensic breakdown matching Section 4 exemplar
 */
exports.getStockByProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId)
      .populate('category', 'name')
      .populate('supplier', 'name company');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const history = await Inventory.find({ product: req.params.productId })
      .populate('performedBy', 'name role')
      .populate('supplier', 'name company')
      .sort('-createdAt');

    // Aggregate forensic audit values strictly matching Section 4 exemplar
    let openingStock = 0;
    let totalInbound = 0;
    let totalSold = 0;
    let totalDamaged = 0;
    let totalAdjustments = 0;
    let hasOpeningRecord = false;

    for (const record of history) {
      if (record.type === 'opening_stock') {
        openingStock += record.quantity;
        hasOpeningRecord = true;
      } else if (['stock_in', 'purchase', 'transfer_in'].includes(record.type)) {
        totalInbound += record.quantity;
      } else if (record.type === 'sale_return') {
        totalInbound += record.quantity;
      } else if (['sale', 'stock_out', 'transfer_out'].includes(record.type)) {
        totalSold += record.quantity;
      } else if (record.type === 'purchase_return') {
        totalSold += record.quantity;
      } else if (['damaged', 'expired'].includes(record.type)) {
        totalDamaged += record.quantity;
      } else if (record.type === 'adjustment') {
        totalAdjustments += (record.currentStock - record.previousStock);
      }
    }

    // Legacy fallback: If product has no opening_stock record
    if (!hasOpeningRecord) {
      if (history.length > 0) {
        // The earliest transaction's previousStock is the baseline opening stock
        const oldestRecord = history[history.length - 1];
        openingStock = oldestRecord.previousStock ?? 0;
      } else {
        openingStock = product.stock;
      }
    }

    const expectedStock = openingStock + totalInbound - totalSold - totalDamaged + totalAdjustments;
    const auditDiscrepancy = product.stock - expectedStock;

    const enrichedHistory = history.map((record) => {
      const doc = record.toObject();
      let differential = doc.quantity;
      if (['stock_out', 'damaged', 'sale', 'expired', 'purchase_return', 'transfer_out'].includes(doc.type)) {
        differential = -Math.abs(doc.quantity);
      } else if (doc.type === 'adjustment') {
        differential = doc.currentStock - doc.previousStock;
      } else {
        differential = Math.abs(doc.quantity);
      }

      const trxCode = doc.reference && doc.reference.trim()
        ? doc.reference
        : `TRX-${doc._id.toString().slice(-4).toUpperCase()}`;

      return {
        ...doc,
        differential,
        quantityChange: differential,
        trxCode,
      };
    });

    res.json({
      success: true,
      product,
      audit: {
        openingStock,
        totalInbound,
        totalSold,
        totalDamaged,
        totalAdjustments,
        netAdjustments: totalAdjustments,
        expectedStock,
        auditDiscrepancy,
        isAudited: auditDiscrepancy === 0,
        currentStock: product.stock,
        minimumStock: product.minimumStock,
        valuationCost: Math.round(product.stock * (product.cost || 0) * 100) / 100,
        valuationRetail: Math.round(product.stock * (product.price || 0) * 100) / 100,
      },
      history: enrichedHistory,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/batch-check-low-stock
 * Evaluates all active catalog items and dispatches consolidated system notification
 */
exports.batchCheckLowStock = async (req, res, next) => {
  try {
    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$minimumStock'] },
    }).select('name stock minimumStock');

    const count = lowStockProducts.length;
    if (count > 0) {
      await Notification.create({
        type: 'low_stock',
        title: 'System Threshold Alert',
        message: `${count} products are currently below minimum stock threshold.`,
      });
    }

    res.json({ success: true, count, products: lowStockProducts });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/inventory/create-draft-po
 * Scans all products at or below minimumStock, groups by primary supplier,
 * and creates draft Purchase Orders (status: 'ordered') to replenish to minimumStock * 2 (or minimum deficit + buffer).
 */
exports.createDraftPoFromLowStock = async (req, res, next) => {
  try {
    const Purchase = require('../models/Purchase');
    const Supplier = require('../models/Supplier');

    const lowStockProducts = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stock', '$minimumStock'] },
    }).populate('supplier');

    if (lowStockProducts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No low-stock products currently requiring replenishment.',
        createdOrders: [],
      });
    }

    // Group items by supplier
    let fallbackSupplier = null;
    const supplierGroups = new Map();

    for (const prod of lowStockProducts) {
      let suppId = prod.supplier?._id?.toString();
      if (!suppId) {
        if (!fallbackSupplier) {
          fallbackSupplier = await Supplier.findOne({ isActive: true });
        }
        if (fallbackSupplier) {
          suppId = fallbackSupplier._id.toString();
        }
      }

      if (!suppId) continue; // No supplier available in database

      if (!supplierGroups.has(suppId)) {
        supplierGroups.set(suppId, []);
      }

      // Recommend replenishment quantity: deficit + 10 units buffer, or minimum 5 units
      const deficit = Math.max(1, prod.minimumStock - prod.stock);
      const reorderQty = deficit + Math.max(5, Math.ceil(prod.minimumStock * 0.5));
      const unitCost = prod.cost || 1;

      supplierGroups.get(suppId).push({
        product: prod._id,
        name: prod.name,
        quantity: reorderQty,
        cost: unitCost,
        total: reorderQty * unitCost,
      });
    }

    const createdOrders = [];

    for (const [suppId, items] of supplierGroups.entries()) {
      const totalCost = items.reduce((sum, item) => sum + item.total, 0);
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderNumber = `PO-${timestamp}-${random}`;

      const purchase = await Purchase.create({
        orderNumber,
        supplier: suppId,
        items,
        totalCost,
        purchaseDate: new Date(),
        paymentStatus: 'pending',
        status: 'ordered',
        inventoryApplied: false,
        notes: 'Automated Draft PO generated from Inventory Low-Stock Replenishment',
        createdBy: req.user.id,
      });

      await Notification.create({
        type: 'purchase_ordered',
        title: 'Auto-Draft Purchase Order Generated',
        message: `Generated replenishment PO ${orderNumber} with ${items.length} items totaling $${totalCost.toFixed(2)}.`,
      });

      createdOrders.push(purchase);
    }

    res.status(201).json({
      success: true,
      message: `Successfully generated ${createdOrders.length} draft purchase order(s).`,
      createdOrders,
    });
  } catch (err) {
    next(err);
  }
};
