const router = require('express').Router();
const { salesReport, productSalesReport, inventoryReport, profitReport, customerReport, supplierReport } = require('../controllers/report.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));
router.get('/sales', salesReport);
router.get('/products', productSalesReport);
router.get('/inventory', inventoryReport);
router.get('/profit', profitReport);
router.get('/customers', customerReport);
router.get('/suppliers', supplierReport);

module.exports = router;
