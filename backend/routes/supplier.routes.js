const router = require('express').Router();
const { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier, getSupplierPurchases, getSupplierStats } = require('../controllers/supplier.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getSupplierStats);
router.route('/').get(getSuppliers).post(authorize('admin'), createSupplier);
router.route('/:id').get(getSupplier).put(authorize('admin'), updateSupplier).delete(authorize('admin'), deleteSupplier);
router.get('/:id/purchases', getSupplierPurchases);

module.exports = router;