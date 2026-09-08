const router = require('express').Router();
const { getInventory, stockIn, stockOut, damagedStock, adjustStock, getStockByProduct } = require('../controllers/inventory.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', getInventory);
router.post('/stock-in', authorize('admin'), stockIn);
router.post('/stock-out', authorize('admin'), stockOut);
router.post('/damaged', authorize('admin'), damagedStock);
router.post('/adjust', authorize('admin'), adjustStock);
router.get('/product/:productId', getStockByProduct);

module.exports = router;
