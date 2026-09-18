const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null },
  type: {
    type: String,
    enum: ['opening_stock', 'stock_in', 'stock_out', 'damaged', 'adjustment', 'sale', 'purchase'],
    required: true,
  },
  quantity: { type: Number, required: true },
  previousStock: { type: Number, required: true },
  currentStock: { type: Number, required: true },
  reference: { type: String, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  notes: { type: String, default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

inventorySchema.index({ product: 1, createdAt: -1 });
inventorySchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('Inventory', inventorySchema);
