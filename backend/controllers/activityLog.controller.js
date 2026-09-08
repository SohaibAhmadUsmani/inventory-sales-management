const ActivityLog = require('../models/ActivityLog');

exports.getActivityLogs = async (req, res, next) => {
  try {
    const { user, action, entity, page = 1, limit = 20 } = req.query;
    const query = {};
    if (user) query.user = user;
    if (action) query.action = { $regex: action, $options: 'i' };
    if (entity) query.entity = entity;
    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('user', 'name role')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ success: true, count: logs.length, total, totalPages: Math.ceil(total / limit), page: Number(page), logs });
  } catch (err) { next(err); }
};
