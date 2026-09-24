const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', default: null, index: true },
  type: {
    type: String,
    enum: [
      'opening_stock',
      'stock_in',
      'stock_out',
      'damaged',
      'expired',
      'adjustment',
      'sale',
      'purchase',
      'sale_return',
      'purchase_return',
      'transfer_in',
      'transfer_out',
    ],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative'],
    validate: {
      validator: function (val) {
        if (['opening_stock', 'adjustment'].includes(this.type)) {
          return Number.isFinite(val) && val >= 0;
        }
        return Number.isFinite(val) && val >= 0.001;
      },
      message: 'Quantity must be greater than zero',
    },
  },
  previousStock: { type: Number, required: true },
  currentStock: { type: Number, required: true },
  unitCost: { type: Number, default: 0 },
  reference: { type: String, default: '' },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  referenceModel: { type: String, enum: ['Sale', 'Purchase', 'Product', null], default: null },
  reason: { type: String, default: '' },
  notes: { type: String, default: '' },
  isVoided: { type: Boolean, default: false, index: true },
  voidReason: { type: String, default: '' },
  idempotencyKey: { type: String, unique: true, sparse: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

inventorySchema.index({ product: 1, createdAt: -1 });
inventorySchema.index({ type: 1, createdAt: -1 });
inventorySchema.index({ product: 1, type: 1, createdAt: -1 });
inventorySchema.index({ supplier: 1, createdAt: -1 });
inventorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Inventory', inventorySchema);
