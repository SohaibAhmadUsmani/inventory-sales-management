const User = require('../models/User');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Purchase = require('../models/Purchase');
const ActivityLog = require('../models/ActivityLog');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getUsers = async (req, res, next) => {
  try {
    const { search, role, status } = req.query;
    const query = {};
    if (search && String(search).trim()) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    if (role && ['admin', 'staff'].includes(role)) {
      query.role = role;
    }
    if (status === 'active') query.isActive = true;
    else if (status === 'inactive') query.isActive = false;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      count: users.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      users,
    });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { name, email, phone, password } = req.body;
    if (name !== undefined) user.name = String(name).trim();
    if (email !== undefined) user.email = String(email).trim().toLowerCase();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (password !== undefined && String(password).trim() !== '') {
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      }
      user.password = password;
    }

    await user.save();
    user.password = undefined;

    await ActivityLog.create({
      user: req.user.id,
      action: `Updated profile: ${user.name}`,
      entity: 'User',
      entityId: user._id,
      details: `${user.name} updated their profile`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, phone, role, isActive, password } = req.body;
    const isSelf = String(req.params.id) === String(req.user.id);

    if (isSelf) {
      if (isActive === false || isActive === 'false') {
        return res.status(400).json({
          success: false,
          message: 'You cannot deactivate your own admin account.',
        });
      }
      if (role && role !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'You cannot demote your own admin account.',
        });
      }
    }

    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) user.name = String(name).trim();
    if (email !== undefined) user.email = String(email).trim().toLowerCase();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (role !== undefined && ['admin', 'staff'].includes(role)) user.role = role;
    if (isActive !== undefined) user.isActive = isActive === true || isActive === 'true';

    if (password !== undefined && String(password).trim() !== '') {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        });
      }
      user.password = password;
    }

    await user.save();
    user.password = undefined;

    await ActivityLog.create({
      user: req.user.id,
      action: `Updated user: ${user.name}`,
      entity: 'User',
      entityId: user._id,
      details: `Updated user ${user.name} (${user.email}) — role: ${user.role}, active: ${user.isActive}`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete or deactivate your own account.',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const [hasSales, hasInventory, hasPurchases] = await Promise.all([
      Sale.exists({ createdBy: user._id }),
      Inventory.exists({ performedBy: user._id }),
      Purchase.exists({ createdBy: user._id }),
    ]);

    if (hasSales || hasInventory || hasPurchases) {
      user.isActive = false;
      await user.save();

      await ActivityLog.create({
        user: req.user.id,
        action: `Deactivated user: ${user.name}`,
        entity: 'User',
        entityId: user._id,
        details: `Deactivated user ${user.name} (${user.email}) to preserve historical sales/inventory records`,
        ip: req.ip,
        ipAddress: req.ip || '',
      });

      return res.json({
        success: true,
        message: 'User has historical transactions and has been deactivated.',
        user,
      });
    }

    await User.findByIdAndDelete(user._id);

    await ActivityLog.create({
      user: req.user.id,
      action: `Deleted user: ${user.name}`,
      entity: 'User',
      entityId: user._id,
      details: `Deleted user ${user.name} (${user.email})`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

