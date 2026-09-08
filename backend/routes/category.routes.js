const router = require('express').Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/category.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/').get(getCategories).post(authorize('admin'), createCategory);
router.route('/:id').put(authorize('admin'), updateCategory).delete(authorize('admin'), deleteCategory);

module.exports = router;
