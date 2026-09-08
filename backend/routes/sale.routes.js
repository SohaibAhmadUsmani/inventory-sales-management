const router = require('express').Router();
const { getSales, getSale, createSale, getDailySales } = require('../controllers/sale.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/daily', getDailySales);
router.route('/').get(getSales).post(createSale);
router.route('/:id').get(getSale);

module.exports = router;
