const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '', trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

categorySchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);

