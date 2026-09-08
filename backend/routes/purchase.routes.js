const router = require('express').Router();
const { getPurchases, getPurchase, createPurchase, updatePurchaseStatus } = require('../controllers/purchase.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getPurchases).post(authorize('admin'), createPurchase);
router.route('/:id').get(getPurchase);
router.put('/:id/status', authorize('admin'), updatePurchaseStatus);

module.exports = router;
