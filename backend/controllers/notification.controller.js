const Notification = require('../models/Notification');

const buildUserNotificationFilter = (user) => (
  user.role === 'admin' ? {} : { $or: [{ user: user.id }, { user: null }] }
);

exports.getNotifications = async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' ? {} : { $or: [{ user: req.user.id }, { user: null }] };
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort('-createdAt').limit(50),
      Notification.countDocuments({ ...query, isRead: false }),
    ]);
    res.json({ success: true, count: notifications.length, unreadCount, notifications });
  } catch (err) { next(err); }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...buildUserNotificationFilter(req.user) };
    const notification = await Notification.findOneAndUpdate(filter, { isRead: true }, { new: true });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Marked as read', notification });
  } catch (err) { next(err); }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const query = req.user.role === 'admin' ? {} : { $or: [{ user: req.user.id }, { user: null }] };
    await Notification.updateMany({ ...query, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) { next(err); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...buildUserNotificationFilter(req.user) };
    const notification = await Notification.findOneAndDelete(filter);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { next(err); }
};

