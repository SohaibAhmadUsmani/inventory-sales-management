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
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (err) { next(err); }
};

exports.getSupplierPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({ supplier: req.params.id }).sort('-createdAt');
    const summary = purchases.reduce((acc, p) => {
      acc.totalCost += p.totalCost;
      acc[p.paymentStatus] = (acc[p.paymentStatus] || 0) + p.totalCost;
      return acc;
    }, { totalCost: 0, paid: 0, pending: 0, partial: 0 });
    res.json({ success: true, count: purchases.length, purchases, summary });
  } catch (err) { next(err); }
};

exports.getSupplierStats = async (req, res, next) => {
  try {
    const [total, active, agg, pendingPOs] = await Promise.all([
      Supplier.countDocuments({ isActive: true }),
      Supplier.countDocuments({ isActive: true, totalPurchases: { $gt: 0 } }),
      Supplier.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalSpend: { $sum: '$totalPurchases' } } },
      ]),
      Purchase.countDocuments({ status: 'ordered' }),
    ]);

    res.json({
      success: true,
      stats: {
        total,
        active,
        totalSpend: agg[0]?.totalSpend || 0,
        pendingPOs,
      },
    });
  } catch (err) { next(err); }
};