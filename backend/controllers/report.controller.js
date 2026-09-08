const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

const buildDateMatch = (startDate, endDate, field = 'createdAt') => {
  const match = {};
  if (startDate || endDate) {
    match[field] = {};
    if (startDate) match[field].$gte = new Date(startDate);
    if (endDate) match[field].$lte = new Date(endDate + 'T23:59:59.999Z');
  }
  return match;
};

exports.salesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const match = { status: 'completed', ...buildDateMatch(startDate, endDate) };
    const dateFormat = groupBy === 'month' ? '%Y-%m' : groupBy === 'week' ? '%Y-W%V' : '%Y-%m-%d';
    const sales = await Sale.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, totalSales: { $sum: '$total' }, count: { $sum: 1 }, avgSale: { $avg: '$total' } } },
      { $sort: { _id: 1 } },
    ]);
    const summary = await Sale.aggregate([{ $match: match }, { $group: { _id: null, totalRevenue: { $sum: '$total' }, totalSales: { $sum: 1 }, avgSale: { $avg: '$total' } } }]);
    res.json({ success: true, sales, summary: summary[0] || { totalRevenue: 0, totalSales: 0, avgSale: 0 } });
  } catch (err) { next(err); }
};

exports.productSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { status: 'completed', ...buildDateMatch(startDate, endDate) };
    const productSales = await Sale.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.total' }, sku: { $first: '$items.sku' } } },
      { $sort: { totalRevenue: -1 } },
    ]);
    res.json({ success: true, productSales });
  } catch (err) { next(err); }
};

exports.inventoryReport = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true }).populate('category', 'name').sort('name');
    const summary = {
      totalProducts: products.length,
      totalStockValue: products.reduce((sum, p) => sum + p.stock * p.cost, 0),
      totalRetailValue: products.reduce((sum, p) => sum + p.stock * p.price, 0),
      lowStockCount: products.filter(p => p.stock <= p.minimumStock).length,
      outOfStockCount: products.filter(p => p.stock === 0).length,
    };
    res.json({ success: true, products, summary });
  } catch (err) { next(err); }
};

exports.profitReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const salesMatch = { status: 'completed', ...buildDateMatch(startDate, endDate) };
    const salesData = await Sale.aggregate([
      { $match: salesMatch },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productInfo' } },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$items.total' }, cost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$productInfo.cost', 0] }] } } } },
      { $project: { _id: 1, revenue: 1, cost: 1, profit: { $subtract: ['$revenue', '$cost'] } } },
      { $sort: { _id: 1 } },
    ]);
    const totalRevenue = salesData.reduce((s, d) => s + d.revenue, 0);
    const totalCost = salesData.reduce((s, d) => s + d.cost, 0);
    res.json({ success: true, profitData: salesData, summary: { totalRevenue, totalCost, totalProfit: totalRevenue - totalCost } });
  } catch (err) { next(err); }
};

exports.customerReport = async (req, res, next) => {
  try {
    const customers = await Customer.find({ isActive: true }).sort('-totalSpending');
    const topCustomers = customers.slice(0, 10);
    const summary = { totalCustomers: customers.length, totalSpending: customers.reduce((s, c) => s + c.totalSpending, 0) };
    res.json({ success: true, topCustomers, summary });
  } catch (err) { next(err); }
};

exports.supplierReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const match = buildDateMatch(startDate, endDate, 'purchaseDate');
    const supplierPurchases = await Purchase.aggregate([
      { $match: match },
      { $group: { _id: '$supplier', totalPurchases: { $sum: '$totalCost' }, orderCount: { $sum: 1 } } },
      { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 'supplierInfo' } },
      { $unwind: '$supplierInfo' },
      { $project: { name: '$supplierInfo.name', company: '$supplierInfo.company', totalPurchases: 1, orderCount: 1 } },
      { $sort: { totalPurchases: -1 } },
    ]);
    res.json({ success: true, supplierPurchases });
  } catch (err) { next(err); }
};
