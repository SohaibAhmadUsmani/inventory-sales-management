const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  address: { type: String, default: '', trim: true },
  totalSpending: { type: Number, default: 0, min: 0 },
  totalOrders: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

customerSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);

