const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Category = require('../models/Category');
const { exportReportToExcel } = require('../utils/excelExport');
const { generateReportPDF, generateMonthlyBusinessReportPDF } = require('../utils/pdfExport');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const oid = (id) => new mongoose.Types.ObjectId(id);

const buildDateMatch = (startDate, endDate, field = 'createdAt') => {
  const match = {};
  if (startDate || endDate) {
    match[field] = {};
    if (startDate) match[field].$gte = new Date(startDate);
    if (endDate) match[field].$lte = new Date(endDate + 'T23:59:59.999Z');
  }
  return match;
};

const dateRangeLabel = (startDate, endDate) => {
  if (!startDate && !endDate) return 'All time';
  const fmt = (d) => new Date(d).toLocaleDateString();
  if (startDate && endDate) return `${fmt(startDate)} - ${fmt(endDate)}`;
  if (startDate) return `From ${fmt(startDate)}`;
  return `Until ${fmt(endDate)}`;
};

const resolveFilterLabels = async ({ product, category, customer, supplier, paymentMethod, status } = {}) => {
  const [p, c, cu, s] = await Promise.all([
    product ? Product.findById(product).select('name') : null,
    category ? Category.findById(category).select('name') : null,
    customer ? Customer.findById(customer).select('name') : null,
    supplier ? Supplier.findById(supplier).select('name') : null,
  ]);
  const labels = [];
  if (p) labels.push(`Product: ${p.name}`);
  if (c) labels.push(`Category: ${c.name}`);
  if (cu) labels.push(`Customer: ${cu.name}`);
  if (s) labels.push(`Supplier: ${s.name}`);
  if (paymentMethod) labels.push(`Payment method: ${paymentMethod}`);
  if (status) labels.push(`Status: ${status}`);
  return labels;
};

/* ---------------------------- Sales report ---------------------------- */

const getSalesReportData = async ({ startDate, endDate, groupBy = 'day', customer, paymentMethod, status }) => {
  const match = { status: status || 'completed', ...buildDateMatch(startDate, endDate) };
  if (customer) match.customer = oid(customer);
  if (paymentMethod) match.paymentMethod = paymentMethod;
  const dateFormat = groupBy === 'month' ? '%Y-%m' : groupBy === 'week' ? '%Y-W%V' : '%Y-%m-%d';
  const sales = await Sale.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, totalSales: { $sum: '$total' }, count: { $sum: 1 }, avgSale: { $avg: '$total' } } },
    { $sort: { _id: 1 } },
  ]);
  const summaryAgg = await Sale.aggregate([{ $match: match }, { $group: { _id: null, totalRevenue: { $sum: '$total' }, totalSales: { $sum: 1 }, avgSale: { $avg: '$total' } } }]);
  const summary = summaryAgg[0] || { totalRevenue: 0, totalSales: 0, avgSale: 0 };
  return { sales, summary };
};

exports.salesReport = async (req, res, next) => {
  try {
    const { sales, summary } = await getSalesReportData(req.query);
    res.json({ success: true, sales, summary });
  } catch (err) { next(err); }
};

exports.exportSalesExcel = async (req, res, next) => {
  try {
    const { sales, summary } = await getSalesReportData(req.query);
    const rows = sales.map((s) => ({ Period: s._id, 'Sales Count': s.count, 'Total Revenue': round2(s.totalSales), 'Avg Sale': round2(s.avgSale) }));
    const totals = { Period: 'TOTAL', 'Sales Count': summary.totalSales, 'Total Revenue': round2(summary.totalRevenue), 'Avg Sale': round2(summary.avgSale) };
    exportReportToExcel(res, { rows, totals, sheetName: 'Sales Report', filename: 'Sales_Report' });
  } catch (err) { next(err); }
};

exports.exportSalesPdf = async (req, res, next) => {
  try {
    const { sales, summary } = await getSalesReportData(req.query);
    const { startDate, endDate, customer, paymentMethod, status } = req.query;
    const filters = await resolveFilterLabels({ customer, paymentMethod, status });
    const rows = sales.map((s) => [s._id, String(s.count), `$${round2(s.totalSales)}`, `$${round2(s.avgSale)}`]);
    const totals = ['TOTAL', String(summary.totalSales), `$${round2(summary.totalRevenue)}`, `$${round2(summary.avgSale)}`];
    await generateReportPDF({
      title: 'Sales Report',
      dateRange: dateRangeLabel(startDate, endDate),
      filters,
      headers: ['Period', 'Sales Count', 'Total Revenue', 'Avg Sale'],
      rows,
      totals,
    }, res);
  } catch (err) { next(err); }
};

/* ------------------------- Product sales report ------------------------ */

const getProductSalesReportData = async ({ startDate, endDate, product, category }) => {
  const match = { status: 'completed', ...buildDateMatch(startDate, endDate) };
  const pipeline = [{ $match: match }, { $unwind: '$items' }];
  if (product) pipeline.push({ $match: { 'items.product': oid(product) } });
  if (category) {
    pipeline.push(
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productInfo' } },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      { $match: { 'productInfo.category': oid(category) } },
    );
  }
  pipeline.push(
    { $group: { _id: '$items.name', totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.total' }, sku: { $first: '$items.sku' } } },
    { $sort: { totalRevenue: -1 } },
  );
  const productSales = await Sale.aggregate(pipeline);
  return { productSales };
};

exports.productSalesReport = async (req, res, next) => {
  try {
    const { productSales } = await getProductSalesReportData(req.query);
    res.json({ success: true, productSales });
  } catch (err) { next(err); }
};

exports.exportProductSalesExcel = async (req, res, next) => {
  try {
    const { productSales } = await getProductSalesReportData(req.query);
    const rows = productSales.map((p) => ({ Product: p._id, SKU: p.sku, 'Qty Sold': p.totalQuantity, Revenue: round2(p.totalRevenue) }));
    const totals = {
      Product: 'TOTAL', SKU: '',
      'Qty Sold': productSales.reduce((s, p) => s + p.totalQuantity, 0),
      Revenue: round2(productSales.reduce((s, p) => s + p.totalRevenue, 0)),
    };
    exportReportToExcel(res, { rows, totals, sheetName: 'Product Sales', filename: 'Product_Sales_Report' });
  } catch (err) { next(err); }
};

exports.exportProductSalesPdf = async (req, res, next) => {
  try {
    const { productSales } = await getProductSalesReportData(req.query);
    const { startDate, endDate, product, category } = req.query;
    const filters = await resolveFilterLabels({ product, category });
    const rows = productSales.map((p) => [p._id, p.sku, String(p.totalQuantity), `$${round2(p.totalRevenue)}`]);
    const totals = ['TOTAL', '', String(productSales.reduce((s, p) => s + p.totalQuantity, 0)), `$${round2(productSales.reduce((s, p) => s + p.totalRevenue, 0))}`];
    await generateReportPDF({
      title: 'Product Sales Report',
      dateRange: dateRangeLabel(startDate, endDate),
      filters,
      headers: ['Product', 'SKU', 'Qty Sold', 'Revenue'],
      rows,
      totals,
    }, res);
  } catch (err) { next(err); }
};

/* ----------------------------- Inventory report -------------------------- */

const getInventoryReportData = async ({ category }) => {
  const query = { isActive: true };
  if (category) query.category = category;
  const products = await Product.find(query).populate('category', 'name').sort('name');
  const summary = {
    totalProducts: products.length,
    totalStockValue: round2(products.reduce((sum, p) => sum + p.stock * p.cost, 0)),
    totalRetailValue: round2(products.reduce((sum, p) => sum + p.stock * p.price, 0)),
    lowStockCount: products.filter((p) => p.stock <= p.minimumStock).length,
    outOfStockCount: products.filter((p) => p.stock === 0).length,
  };
  return { products, summary };
};

exports.inventoryReport = async (req, res, next) => {
  try {
    const { products, summary } = await getInventoryReportData(req.query);
    res.json({ success: true, products, summary });
  } catch (err) { next(err); }
};

exports.exportInventoryExcel = async (req, res, next) => {
  try {
    const { products, summary } = await getInventoryReportData(req.query);
    const rows = products.map((p) => ({
      Name: p.name, SKU: p.sku, Category: p.category?.name || '', Price: p.price, Cost: p.cost,
      Stock: p.stock, 'Min Stock': p.minimumStock, Status: p.stock <= p.minimumStock ? 'Low Stock' : 'In Stock',
    }));
    const totals = {
      Name: 'TOTAL', SKU: '', Category: `${summary.totalProducts} products`, Price: '',
      Cost: `Stock value: $${summary.totalStockValue}`, Stock: '', 'Min Stock': '',
      Status: `Low: ${summary.lowStockCount} / Out: ${summary.outOfStockCount}`,
    };
    exportReportToExcel(res, { rows, totals, sheetName: 'Inventory Report', filename: 'Inventory_Report' });
  } catch (err) { next(err); }
};

exports.exportInventoryPdf = async (req, res, next) => {
  try {
    const { products, summary } = await getInventoryReportData(req.query);
    const { category } = req.query;
    const filters = await resolveFilterLabels({ category });
    const rows = products.map((p) => [p.name, p.sku, p.category?.name || '', `$${p.price}`, `$${p.cost}`, String(p.stock), String(p.minimumStock), p.stock <= p.minimumStock ? 'Low Stock' : 'In Stock']);
    const totals = ['TOTAL', '', `${summary.totalProducts} products`, '', `Value: $${summary.totalStockValue}`, '', '', `Low: ${summary.lowStockCount} / Out: ${summary.outOfStockCount}`];
    await generateReportPDF({
      title: 'Inventory Report',
      filters,
      headers: ['Name', 'SKU', 'Category', 'Price', 'Cost', 'Stock', 'Min Stock', 'Status'],
      rows,
      totals,
    }, res);
  } catch (err) { next(err); }
};

/* ------------------------------ Profit report ----------------------------- */

const getProfitReportData = async ({ startDate, endDate, product, category }) => {
  const salesMatch = { status: 'completed', ...buildDateMatch(startDate, endDate) };
  const pipeline = [{ $match: salesMatch }, { $unwind: '$items' }];
  if (product) pipeline.push({ $match: { 'items.product': oid(product) } });
  pipeline.push(
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productInfo' } },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
  );
  if (category) pipeline.push({ $match: { 'productInfo.category': oid(category) } });
  pipeline.push(
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$items.total' }, cost: { $sum: { $multiply: ['$items.quantity', { $ifNull: ['$productInfo.cost', 0] }] } } } },
    { $project: { _id: 1, revenue: 1, cost: 1, profit: { $subtract: ['$revenue', '$cost'] } } },
    { $sort: { _id: 1 } },
  );
  const profitData = await Sale.aggregate(pipeline);
  const totalRevenue = profitData.reduce((s, d) => s + d.revenue, 0);
  const totalCost = profitData.reduce((s, d) => s + d.cost, 0);
  return { profitData, summary: { totalRevenue: round2(totalRevenue), totalCost: round2(totalCost), totalProfit: round2(totalRevenue - totalCost) } };
};

exports.profitReport = async (req, res, next) => {
  try {
    const { profitData, summary } = await getProfitReportData(req.query);
    res.json({ success: true, profitData, summary });
  } catch (err) { next(err); }
};

exports.exportProfitExcel = async (req, res, next) => {
  try {
    const { profitData, summary } = await getProfitReportData(req.query);
    const rows = profitData.map((d) => ({ Date: d._id, Revenue: round2(d.revenue), Cost: round2(d.cost), Profit: round2(d.profit) }));
    const totals = { Date: 'TOTAL', Revenue: summary.totalRevenue, Cost: summary.totalCost, Profit: summary.totalProfit };
    exportReportToExcel(res, { rows, totals, sheetName: 'Profit Report', filename: 'Profit_Report' });
  } catch (err) { next(err); }
};

exports.exportProfitPdf = async (req, res, next) => {
  try {
    const { profitData, summary } = await getProfitReportData(req.query);
    const { startDate, endDate, product, category } = req.query;
    const filters = await resolveFilterLabels({ product, category });
    const rows = profitData.map((d) => [d._id, `$${round2(d.revenue)}`, `$${round2(d.cost)}`, `$${round2(d.profit)}`]);
    const totals = ['TOTAL', `$${summary.totalRevenue}`, `$${summary.totalCost}`, `$${summary.totalProfit}`];
    await generateReportPDF({
      title: 'Profit Report',
      dateRange: dateRangeLabel(startDate, endDate),
      filters,
      headers: ['Date', 'Revenue', 'Cost', 'Profit'],
      rows,
      totals,
    }, res);
  } catch (err) { next(err); }
};

/* ----------------------------- Customer report ---------------------------- */

const getCustomerReportData = async ({ customer }) => {
  if (customer) {
    const cust = await Customer.findById(customer);
    if (!cust) return { topCustomers: [], summary: { totalCustomers: 0, totalSpending: 0 }, purchaseHistory: [], singleCustomer: null };
    const purchaseHistory = await Sale.find({ customer, status: 'completed' }).sort('-createdAt').select('invoiceNumber total createdAt paymentMethod status');
    return { topCustomers: [cust], summary: { totalCustomers: 1, totalSpending: round2(cust.totalSpending) }, purchaseHistory, singleCustomer: cust };
  }
  const customers = await Customer.find({ isActive: true }).sort('-totalSpending');
  const topCustomers = customers.slice(0, 10);
  const summary = { totalCustomers: customers.length, totalSpending: round2(customers.reduce((s, c) => s + c.totalSpending, 0)) };
  return { topCustomers, summary, purchaseHistory: null, singleCustomer: null };
};

exports.customerReport = async (req, res, next) => {
  try {
    const { topCustomers, summary, purchaseHistory } = await getCustomerReportData(req.query);
    res.json({ success: true, topCustomers, summary, ...(purchaseHistory ? { purchaseHistory } : {}) });
  } catch (err) { next(err); }
};

exports.exportCustomerExcel = async (req, res, next) => {
  try {
    const { topCustomers, summary, purchaseHistory, singleCustomer } = await getCustomerReportData(req.query);
    if (singleCustomer) {
      const rows = purchaseHistory.map((s) => ({ 'Invoice #': s.invoiceNumber, Date: new Date(s.createdAt).toLocaleDateString(), Total: round2(s.total), Payment: s.paymentMethod, Status: s.status }));
      const totals = { 'Invoice #': 'TOTAL', Date: '', Total: round2(purchaseHistory.reduce((s, x) => s + x.total, 0)), Payment: '', Status: '' };
      exportReportToExcel(res, { rows, totals, sheetName: 'Customer Report', filename: `Customer_Report_${singleCustomer.name.replace(/\s+/g, '_')}` });
      return;
    }
    const rows = topCustomers.map((c) => ({ Name: c.name, Phone: c.phone, Email: c.email, 'Total Orders': c.totalOrders, 'Total Spending': round2(c.totalSpending) }));
    const totals = { Name: 'TOTAL', Phone: '', Email: '', 'Total Orders': topCustomers.reduce((s, c) => s + c.totalOrders, 0), 'Total Spending': summary.totalSpending };
    exportReportToExcel(res, { rows, totals, sheetName: 'Customer Report', filename: 'Customer_Report' });
  } catch (err) { next(err); }
};

exports.exportCustomerPdf = async (req, res, next) => {
  try {
    const { topCustomers, summary, purchaseHistory, singleCustomer } = await getCustomerReportData(req.query);
    if (singleCustomer) {
      const rows = purchaseHistory.map((s) => [s.invoiceNumber, new Date(s.createdAt).toLocaleDateString(), `$${round2(s.total)}`, s.paymentMethod, s.status]);
      const totals = ['TOTAL', '', `$${round2(purchaseHistory.reduce((s, x) => s + x.total, 0))}`, '', ''];
      await generateReportPDF({
        title: `Customer Report — ${singleCustomer.name}`,
        headers: ['Invoice #', 'Date', 'Total', 'Payment', 'Status'],
        rows,
        totals,
      }, res);
      return;
    }
    const rows = topCustomers.map((c) => [c.name, c.phone || '-', c.email || '-', String(c.totalOrders), `$${round2(c.totalSpending)}`]);
    const totals = ['TOTAL', '', '', String(topCustomers.reduce((s, c) => s + c.totalOrders, 0)), `$${summary.totalSpending}`];
    await generateReportPDF({
      title: 'Customer Report (Top 10 by spending)',
      headers: ['Name', 'Phone', 'Email', 'Total Orders', 'Total Spending'],
      rows,
      totals,
    }, res);
  } catch (err) { next(err); }
};

/* ----------------------------- Supplier report ---------------------------- */

const getSupplierReportData = async ({ startDate, endDate, supplier }) => {
  const match = buildDateMatch(startDate, endDate, 'purchaseDate');
  if (supplier) match.supplier = oid(supplier);
  const supplierPurchases = await Purchase.aggregate([
    { $match: match },
    { $group: { _id: '$supplier', totalPurchases: { $sum: '$totalCost' }, orderCount: { $sum: 1 } } },
    { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 'supplierInfo' } },
    { $unwind: '$supplierInfo' },
    { $project: { name: '$supplierInfo.name', company: '$supplierInfo.company', totalPurchases: 1, orderCount: 1 } },
    { $sort: { totalPurchases: -1 } },
  ]);
  return { supplierPurchases };
};

exports.supplierReport = async (req, res, next) => {
  try {
    const { supplierPurchases } = await getSupplierReportData(req.query);
    res.json({ success: true, supplierPurchases });
  } catch (err) { next(err); }
};

exports.exportSupplierExcel = async (req, res, next) => {
  try {
    const { supplierPurchases } = await getSupplierReportData(req.query);
    const rows = supplierPurchases.map((s) => ({ Supplier: s.name, Company: s.company || '', 'Order Count': s.orderCount, 'Total Purchases': round2(s.totalPurchases) }));
    const totals = { Supplier: 'TOTAL', Company: '', 'Order Count': supplierPurchases.reduce((s, x) => s + x.orderCount, 0), 'Total Purchases': round2(supplierPurchases.reduce((s, x) => s + x.totalPurchases, 0)) };
    exportReportToExcel(res, { rows, totals, sheetName: 'Supplier Report', filename: 'Supplier_Purchases_Report' });
  } catch (err) { next(err); }
};

exports.exportSupplierPdf = async (req, res, next) => {
  try {
    const { supplierPurchases } = await getSupplierReportData(req.query);
    const { startDate, endDate, supplier } = req.query;
    const filters = await resolveFilterLabels({ supplier });
    const rows = supplierPurchases.map((s) => [s.name, s.company || '-', String(s.orderCount), `$${round2(s.totalPurchases)}`]);
    const totals = ['TOTAL', '', String(supplierPurchases.reduce((s, x) => s + x.orderCount, 0)), `$${round2(supplierPurchases.reduce((s, x) => s + x.totalPurchases, 0))}`];
    await generateReportPDF({
      title: 'Supplier Purchases Report',
      dateRange: dateRangeLabel(startDate, endDate),
      filters,
      headers: ['Supplier', 'Company', 'Order Count', 'Total Purchases'],
      rows,
      totals,
    }, res);
  } catch (err) { next(err); }
};

/* ------------------------- Monthly business report ------------------------ */

exports.exportMonthlyBusinessReportPdf = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const monthLabel = start.toLocaleString('default', { month: 'long', year: 'numeric' });

    const match = { status: 'completed', createdAt: { $gte: start, $lte: end } };

    const salesSummaryAgg = await Sale.aggregate([{ $match: match }, { $group: { _id: null, totalRevenue: { $sum: '$total' }, totalSales: { $sum: 1 }, avgSale: { $avg: '$total' } } }]);
    const salesSummary = salesSummaryAgg[0] || { totalRevenue: 0, totalSales: 0, avgSale: 0 };

    const { summary: profitSummary } = await getProfitReportData({ startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) });

    const topProducts = await Sale.aggregate([
      { $match: match }, { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, revenue: { $sum: '$items.total' } } },
      { $sort: { revenue: -1 } }, { $limit: 5 },
    ]);

    const categoryRevenue = await Sale.aggregate([
      { $match: match }, { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productInfo' } },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'categories', localField: 'productInfo.category', foreignField: '_id', as: 'categoryInfo' } },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] }, revenue: { $sum: '$items.total' } } },
      { $sort: { revenue: -1 } },
    ]);

    const lowStockCount = await Product.countDocuments({ isActive: true, $expr: { $lte: ['$stock', '$minimumStock'] } });
    const newCustomers = await Customer.countDocuments({ createdAt: { $gte: start, $lte: end } });

    await generateMonthlyBusinessReportPDF({
      monthLabel,
      salesSummary: { totalRevenue: round2(salesSummary.totalRevenue), totalSales: salesSummary.totalSales, avgSale: round2(salesSummary.avgSale) },
      profitSummary,
      topProducts: topProducts.map((p) => [p._id, String(p.qty), `$${round2(p.revenue)}`]),
      categoryRevenue: categoryRevenue.map((c) => [c._id, `$${round2(c.revenue)}`]),
      lowStockCount,
      newCustomers,
    }, res);
  } catch (err) { next(err); }
};
