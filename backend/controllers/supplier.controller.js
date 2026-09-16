const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');

exports.getSuppliers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { isActive: true };
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { company: { $regex: search, $options: 'i' } }, { phone: { $regex: search, $options: 'i' } }];
    const total = await Supplier.countDocuments(query);
    const suppliers = await Supplier.find(query).sort('-createdAt').skip((page - 1) * limit).limit(Number(limit));
    res.json({ success: true, count: suppliers.length, total, totalPages: Math.ceil(total / limit), page: Number(page), suppliers });
  } catch (err) { next(err); }
};

exports.getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id).populate('productsSupplied', 'name sku');
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, supplier });
  } catch (err) { next(err); }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json({ success: true, supplier });
  } catch (err) { next(err); }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, supplier });
  } catch (err) { next(err); }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    const purchaseCount = await Purchase.countDocuments({ supplier: req.params.id });
    if (purchaseCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete supplier because purchase history exists. Please clear purchase records first.',
      });
    }

    const deletedSupplier = await Supplier.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    res.json({ success: true, message: 'Supplier deleted', supplier: deletedSupplier });
  } catch (err) { next(err); }
};

exports.getSupplierPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({ supplier: req.params.id }).sort('-createdAt');
    res.json({ success: true, count: purchases.length, purchases });
  } catch (err) { next(err); }
};
