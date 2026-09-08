const router = require('express').Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getLowStockProducts } = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);
router.get('/low-stock', getLowStockProducts);
router.route('/').get(getProducts).post(authorize('admin'), upload.single('image'), createProduct);
router.route('/:id').get(getProduct).put(authorize('admin'), upload.single('image'), updateProduct).delete(authorize('admin'), deleteProduct);

module.exports = router;
