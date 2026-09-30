const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, default: '', trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  price: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: (val) => Number.isFinite(val) && val >= 0,
      message: 'Price must be a valid non-negative number',
    },
  },
  cost: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: (val) => Number.isFinite(val) && val >= 0,
      message: 'Cost must be a valid non-negative number',
    },
  },
  stock: { type: Number, required: true, default: 0, min: 0 },
  minimumStock: { type: Number, required: true, default: 5, min: 0 },
  image: { type: String, default: '' },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

productSchema.virtual('isLowStock').get(function () {
  return this.stock <= this.minimumStock;
});

productSchema.index({ name: 'text', sku: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ supplier: 1, isActive: 1 });
productSchema.index({ stock: 1, minimumStock: 1 });

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);

