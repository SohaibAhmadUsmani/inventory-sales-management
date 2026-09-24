const router = require('express').Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerPurchases, getCustomerStats } = require('../controllers/customer.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getCustomerStats);
router.route('/').get(getCustomers).post(createCustomer);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(authorize('admin'), deleteCustomer);
router.get('/:id/purchases', getCustomerPurchases);

module.exports = router;