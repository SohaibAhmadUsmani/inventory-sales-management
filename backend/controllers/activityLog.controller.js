const ActivityLog = require('../models/ActivityLog');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getActivityLogs = async (req, res, next) => {
  try {
    const { user, action, entity, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));

    const query = {};
    if (user) query.user = user;
    if (action && String(action).trim()) {
      query.action = { $regex: escapeRegex(String(action).trim()), $options: 'i' };
    }
    if (entity && String(entity).trim()) {
      query.entity = String(entity).trim();
    }
    if (search && String(search).trim()) {
      const s = escapeRegex(String(search).trim());
      query.$or = [
        { details: { $regex: s, $options: 'i' } },
        { action: { $regex: s, $options: 'i' } },
        { entity: { $regex: s, $options: 'i' } },
      ];
    }

    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('user', 'name role email')
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      count: logs.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      page: pageNum,
      logs,
    });
  } catch (err) { next(err); }
};

