const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Purchase = require('../models/Purchase');

exports.getDashboard = async (req, res, next) => {
  try {
    const totalSales = await Sale.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$total' } } }]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todaySales = await Sale.aggregate([{ $match: { status: 'completed', createdAt: { $gte: today } } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]);
    const totalProducts = await Product.countDocuments({ isActive: true });
    const lowStockProducts = await Product.countDocuments({ isActive: true, $expr: { $lte: ['$stock', '$minimumStock'] } });
    const totalCustomers = await Customer.countDocuments({ isActive: true });
    const pendingOrders = await Purchase.countDocuments({ status: 'ordered' });

    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const monthlyRevenue = await Sale.aggregate([{ $match: { status: 'completed', createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$total' } } }]);

    const dailySales = await Sale.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const topProducts = await Sale.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', totalQuantity: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.total' } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    const revenueByCategory = await Sale.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productInfo' } },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'categories', localField: 'productInfo.category', foreignField: '_id', as: 'categoryInfo' } },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] }, revenue: { $sum: '$items.total' } } },
      { $sort: { revenue: -1 } },
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
