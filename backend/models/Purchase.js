const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  cost: { type: Number, required: true },
  total: { type: Number, required: true },
});

const purchaseSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: [purchaseItemSchema],
  totalCost: { type: Number, required: true },
  purchaseDate: { type: Date, required: true },
  paymentStatus: { type: String, enum: ['paid', 'pending', 'partial'], default: 'pending' },
  status: { type: String, enum: ['ordered', 'received', 'cancelled'], default: 'ordered' },
  inventoryApplied: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Purchase', purchaseSchema);
