const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  company: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  address: { type: String, default: '', trim: true },
  totalPurchases: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Products are linked via Product.supplier (set from the Product form).
// A virtual populate keeps this list always accurate with no manual syncing,
// so it can never drift out of date the way a manually-maintained array would.
supplierSchema.virtual('productsSupplied', {
  ref: 'Product',
  localField: '_id',
  foreignField: 'supplier',
});

supplierSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);