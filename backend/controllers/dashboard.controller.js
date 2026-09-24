const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Purchase = require('../models/Purchase');

const getLocalTimezoneOffset = () => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMins = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMins / 60)).padStart(2, '0');
  const mins = String(absMins % 60).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
};

exports.getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const localTimezone = getLocalTimezoneOffset();

    const [
      totalSales,
      todaySales,
      totalProducts,
      lowStockProducts,
      totalCustomers,
      pendingOrders,
      monthlyRevenue,
      dailySales,
      topProducts,
      revenueByCategory,
    ] = await Promise.all([
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, $expr: { $lte: ['$stock', '$minimumStock'] } }),
      Customer.countDocuments({ isActive: true }),
      Purchase.countDocuments({ status: 'ordered' }),
      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Sale.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: localTimezone } },
            total: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            name: { $first: '$items.name' },
            totalQuantity: { $sum: '$items.quantity' },
            totalQty: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.total' },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        { $project: { _id: '$name', totalQuantity: 1, totalQty: 1, totalRevenue: 1 } },
      ]),
      Sale.aggregate([
        { $match: { status: 'completed' } },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productInfo' } },
        { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'categories', localField: 'productInfo.category', foreignField: '_id', as: 'categoryInfo' } },
        { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] }, revenue: { $sum: '$items.total' } } },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      dashboard: {
        totalSales: totalSales[0]?.total || 0,
        todaySales: todaySales[0]?.total || 0,
        todaySalesCount: todaySales[0]?.count || 0,
        totalProducts,
        lowStockProducts,
        totalCustomers,
        pendingOrders,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        dailySales,
        topProducts,
        revenueByCategory,
      },
    });
  } catch (err) { next(err); }
};

