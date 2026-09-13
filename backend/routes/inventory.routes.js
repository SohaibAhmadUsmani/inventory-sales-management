const router = require('express').Router();
const {
  getInventory,
  getInventoryStats,
  getCurrentStock,
  getLowStockAlerts,
  exportLedgerCsv,
  stockIn,
  stockOut,
  damagedStock,
  adjustStock,
  getStockByProduct,
} = require('../controllers/inventory.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getInventoryStats);
router.get('/current-stock', getCurrentStock);
router.get('/low-stock', getLowStockAlerts);
router.get('/export-csv', exportLedgerCsv);
router.get('/', getInventory);

router.post('/stock-in', authorize('admin', 'staff'), stockIn);
router.post('/stock-out', authorize('admin', 'staff'), stockOut);
router.post('/damaged', authorize('admin', 'staff'), damagedStock);
router.post('/adjust', authorize('admin', 'staff'), adjustStock);

router.get('/product/:productId', getStockByProduct);

module.exports = router;
