const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Inventory = require('../models/Inventory');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { generateInvoicePDF } = require('../utils/pdfExport');

const generateInvoiceNumber = () => {
  const prefix = 'INV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

exports.getSales = async (req, res, next) => {
  try {
    const { search, customer, paymentMethod, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) query.invoiceNumber = { $regex: search, $options: 'i' };
    if (customer) query.customer = customer;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, count: sales.length, total, totalPages: Math.ceil(total / limit), page: Number(page), sales });
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
      .populate('customer', 'name');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    generateInvoicePDF(sale, res);
  } catch (err) { next(err); }
};

exports.createSale = async (req, res, next) => {
  try {
    const { customerId, items, discount, tax, paymentMethod, paymentStatus, notes } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'No items in sale' });

    // Validate stock and calculate totals
    let subtotal = 0;
    const saleItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
      if (product.stock < item.quantity) return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      const total = product.price * item.quantity;
      subtotal += total;
      saleItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        cost: product.cost || 0,
        quantity: item.quantity,
        total,
      });
    }

    const discountAmount = Number(discount) || 0;
    const taxAmount = Number(tax) || 0;
    const total = subtotal - discountAmount + taxAmount;

    const sale = await Sale.create({
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

    // Atomic conditional stock deduction to eliminate concurrency race conditions
    for (const item of saleItems) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        const p = await Product.findById(item.product);
        throw new Error(`Insufficient stock for ${p ? p.name : 'product'} during checkout.`);
      }

      const previousStock = updatedProduct.stock + item.quantity;
      const currentStock = updatedProduct.stock;

      await Inventory.create({
        product: item.product,
        type: 'sale',
        quantity: item.quantity,
        unitCost: item.cost || 0,
        previousStock,
        currentStock,
        performedBy: req.user.id,
        reference: sale.invoiceNumber,
        referenceId: sale._id,
        notes: `Sale completed via ${paymentMethod || 'cash'} (Invoice: ${sale.invoiceNumber})`,
      });

      if (currentStock <= updatedProduct.minimumStock) {
        await Notification.create({
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${updatedProduct.name} is low in stock (${currentStock} remaining)`,
        });
      }
    }

    // Update customer stats
    if (customerId) {
      await Customer.findByIdAndUpdate(customerId, {
        $inc: { totalSpending: total, totalOrders: 1 },
      });
    }

    await Notification.create({ type: 'sale_completed', title: 'Sale Completed', message: `Sale ${sale.invoiceNumber} completed for $${total.toFixed(2)}` });
    await ActivityLog.create({ user: req.user.id, action: 'Created', entity: 'Sale', entityId: sale._id, details: `Created sale ${sale.invoiceNumber} - $${total.toFixed(2)}` });

    res.status(201).json({ success: true, sale });
  } catch (err) { next(err); }
};

/**
 * PUT /api/sales/:id/cancel
 * Cancels a sale and restores deducted stock back to the inventory ledger
 */
exports.cancelSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });
    if (sale.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Sale is already cancelled' });
    }

    sale.status = 'cancelled';
    await sale.save();

    // Revert inventory stock
    for (const item of sale.items) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      if (product) {
        const previousStock = product.stock - item.quantity;
        await Inventory.create({
          product: item.product,
          type: 'sale_return',
          quantity: item.quantity,
          unitCost: item.cost || (product.cost || 0),
          previousStock,
          currentStock: product.stock,
          performedBy: req.user.id,
          reference: `VOID-${sale.invoiceNumber}`,
          referenceId: sale._id,
          notes: `Sale voided / cancelled: ${sale.invoiceNumber}`,
        });
      }
    }

    // Adjust customer spending
    if (sale.customer) {
      await Customer.findByIdAndUpdate(sale.customer, {
        $inc: { totalSpending: -sale.total, totalOrders: -1 },
      });
    }

    await Notification.create({
      type: 'sale_cancelled',
      title: 'Sale Cancelled',
      message: `Sale ${sale.invoiceNumber} was cancelled. Stock restored to inventory.`,
    });

    await ActivityLog.create({
      user: req.user.id,
      action: 'Cancelled',
      entity: 'Sale',
      entityId: sale._id,
      details: `Cancelled sale ${sale.invoiceNumber} and returned items to inventory.`,
    });

    res.json({ success: true, message: `Sale ${sale.invoiceNumber} cancelled successfully`, sale });
  } catch (err) {
    next(err);
  }
};

exports.getDailySales = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { status: 'completed' };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
    const sales = await Sale.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalSales: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, sales });
  } catch (err) { next(err); }
};
