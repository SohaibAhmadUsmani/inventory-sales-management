const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  cost: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
});

const purchaseSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: {
    type: [purchaseItemSchema],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'Purchase order must contain at least one item',
    },
  },
  totalCost: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, required: true },
  paymentStatus: { type: String, enum: ['paid', 'pending', 'partial'], default: 'pending' },
  status: { type: String, enum: ['ordered', 'received', 'cancelled'], default: 'ordered' },
  inventoryApplied: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

purchaseSchema.index({ supplier: 1, createdAt: -1 });
purchaseSchema.index({ status: 1, purchaseDate: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);

