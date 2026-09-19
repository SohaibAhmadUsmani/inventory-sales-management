const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const user = await User.create({ name, email, password, role: role || 'staff', phone });
    await ActivityLog.create({ user: user._id, action: 'Registered', entity: 'User', entityId: user._id, details: `${user.name} registered as ${user.role}` });
    res.status(201).json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password' });
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account has been deactivated' });
    if (!(await user.comparePassword(password))) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    await ActivityLog.create({ user: user._id, action: 'Logged in', entity: 'User', entityId: user._id, details: `${user.name} logged in` });
    res.json({ success: true, token: generateToken(user._id), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.json({ success: true, message: 'If an account exists for this email, a password reset link has been generated.' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    await ActivityLog.create({ user: user._id, action: 'Password Reset Requested', entity: 'User', entityId: user._id, details: `${user.name} requested a password reset` });

    const response = { success: true, message: 'If an account exists for this email, a password reset link has been generated.' };
    if (process.env.NODE_ENV === 'development') {
      response.resetUrl = resetUrl;
      response.devNote = 'Development mode: use this URL to reset your password. In production, this would be sent via email.';
    }
    res.json(response);
  } catch (err) { next(err); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = hashToken(req.params.token);
    const user = await User.findOne({ resetPasswordToken: hashedToken, resetPasswordExpire: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    await ActivityLog.create({ user: user._id, action: 'Password Reset', entity: 'User', entityId: user._id, details: `${user.name} reset their password` });

    res.json({ success: true, message: 'Password reset successful', token: generateToken(user._id) });
  } catch (err) { next(err); }
};
