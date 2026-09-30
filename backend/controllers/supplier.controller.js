const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

exports.getSuppliers = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(10000, Math.max(1, parseInt(limit, 10) || 20));

    const query = { isActive: true };
    if (search && String(search).trim()) {
      const s = escapeRegex(String(search).trim());
      query.$or = [
        { name: { $regex: s, $options: 'i' } },
        { company: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }

    const total = await Supplier.countDocuments(query);
    const suppliers = await Supplier.find(query)
      .populate({ path: 'productsSupplied', select: 'name sku stock price cost', match: { isActive: true } })
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.json({
      success: true,
      count: suppliers.length,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
      page: pageNum,
      suppliers,
    });
  } catch (err) { next(err); }
};

exports.getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
      .populate({ path: 'productsSupplied', select: 'name sku stock price cost', match: { isActive: true } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    res.json({ success: true, supplier });
  } catch (err) { next(err); }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const { name, company, phone, email, address } = req.body;
    const supplier = await Supplier.create({ name, company, phone, email, address });

    if (req.user?.id) {
      await ActivityLog.create({
        user: req.user.id,
        action: 'Created',
        entity: 'Supplier',
        entityId: supplier._id,
        details: `Created supplier ${supplier.name}${supplier.company ? ` (${supplier.company})` : ''}`,
        ipAddress: req.ip || '',
      });
    }

    res.status(201).json({ success: true, supplier });
  } catch (err) { next(err); }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const { name, company, phone, email, address } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (company !== undefined) updates.company = company;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;

    const supplier = await Supplier.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate({ path: 'productsSupplied', select: 'name sku stock price cost', match: { isActive: true } });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    if (req.user?.id) {
      await ActivityLog.create({
        user: req.user.id,
        action: 'Updated',
        entity: 'Supplier',
        entityId: supplier._id,
        details: `Updated supplier ${supplier.name}`,
        ipAddress: req.ip || '',
      });
    }

    res.json({ success: true, supplier });
  } catch (err) { next(err); }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

    const openPurchaseCount = await Purchase.countDocuments({ supplier: req.params.id, status: 'ordered' });
    if (openPurchaseCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete supplier because open purchase orders exist. Please receive or cancel open purchase orders first.',
      });
    }

    const deletedSupplier = await Supplier.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    await Product.updateMany({ supplier: req.params.id }, { $set: { supplier: null } });

    if (req.user?.id) {
      await ActivityLog.create({
        user: req.user.id,
        action: 'Deleted',
        entity: 'Supplier',
        entityId: supplier._id,
        details: `Deleted supplier ${supplier.name}`,
        ipAddress: req.ip || '',
      });
    }

    res.json({ success: true, message: 'Supplier deleted', supplier: deletedSupplier });
  } catch (err) { next(err); }
};

exports.getSupplierPurchases = async (req, res, next) => {
  try {
    const purchases = await Purchase.find({ supplier: req.params.id }).sort('-createdAt');
    const summary = purchases.reduce((acc, p) => {
      if (p.status === 'cancelled') return acc;
      const cost = Number(p.totalCost) || 0;
      acc.totalCost = round2(acc.totalCost + cost);
      acc[p.paymentStatus] = round2((acc[p.paymentStatus] || 0) + cost);
      return acc;
    }, { totalCost: 0, paid: 0, pending: 0, partial: 0 });
    res.json({ success: true, count: purchases.length, purchases, summary });
  } catch (err) { next(err); }
};

exports.getSupplierStats = async (req, res, next) => {
  try {
    const activeSupplierIds = await Supplier.find({ isActive: true }).distinct('_id');
    const [total, active, agg, pendingPOs] = await Promise.all([
      Supplier.countDocuments({ isActive: true }),
      Supplier.countDocuments({ isActive: true, totalPurchases: { $gt: 0 } }),
      Supplier.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalSpend: { $sum: '$totalPurchases' } } },
      ]),
      Purchase.countDocuments({ status: 'ordered', supplier: { $in: activeSupplierIds } }),
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