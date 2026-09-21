const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, unique: true, uppercase: true },
  description: { type: String, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  price: { type: Number, required: true, min: 0 },
  cost: { type: Number, required: true, min: 0 },
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

module.exports = mongoose.model('Product', productSchema);
