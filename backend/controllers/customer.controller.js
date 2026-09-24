const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const ActivityLog = require('../models/ActivityLog');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getCustomers = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(10000, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};
    if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'active') {
      query.isActive = true;
      query.totalOrders = { $gt: 0 };
    } else if (status === 'new') {
      query.isActive = true;
      query.totalOrders = 0;
    } else if (status === 'all') {
      // No filter on isActive / totalOrders
    } else {
      query.isActive = true;
    }

    if (search && String(search).trim()) {
      const s = escapeRegex(String(search).trim());
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ];
    }

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      count: customers.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      page: pageNum,
      customers,
    });
  } catch (err) { next(err); }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, customer });
  } catch (err) { next(err); }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address } = req.body;
    const customer = await Customer.create({ name, phone, email, address });

    if (req.user?.id) {
      await ActivityLog.create({
        user: req.user.id,
        action: 'Created',
        entity: 'Customer',
        entityId: customer._id,
        details: `Created customer ${customer.name}`,
        ipAddress: req.ip || '',
      });
    }

    res.status(201).json({ success: true, customer });
  } catch (err) { next(err); }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, isActive } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (typeof isActive === 'boolean') updates.isActive = isActive;

    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    if (req.user?.id) {
      await ActivityLog.create({
        user: req.user.id,
        action: 'Updated',
        entity: 'Customer',
        entityId: customer._id,
        details: `Updated customer ${customer.name}`,
        ipAddress: req.ip || '',
      });
    }

    res.json({ success: true, customer });
  } catch (err) { next(err); }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    if (req.user?.id) {
      await ActivityLog.create({
        user: req.user.id,
        action: 'Deleted',
        entity: 'Customer',
        entityId: customer._id,
        details: `Deleted customer ${customer.name}`,
        ipAddress: req.ip || '',
      });
    }

    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) { next(err); }
};

exports.getCustomerPurchases = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const sales = await Sale.find({ customer: req.params.id, status: 'completed' })
      .sort('-createdAt')
      .limit(100);
    res.json({ success: true, count: sales.length, sales });
  } catch (err) { next(err); }
};

exports.getCustomerStats = async (req, res, next) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [total, active, newThisMonth, agg] = await Promise.all([
      Customer.countDocuments({ isActive: true }),
      Customer.countDocuments({ isActive: true, totalOrders: { $gt: 0 } }),
      Customer.countDocuments({ isActive: true, createdAt: { $gte: startOfMonth } }),
      Customer.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalLifetimeValue: { $sum: '$totalSpending' } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        total,
        active,
        newThisMonth,
        totalLifetimeValue: agg[0]?.totalLifetimeValue || 0,
      },
    });
  } catch (err) { next(err); }
};