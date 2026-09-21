const router = require('express').Router();
const { getSales, getSale, getSaleInvoice, createSale, getDailySales, cancelSale } = require('../controllers/sale.controller');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/daily', getDailySales);
router.route('/').get(getSales).post(createSale);
router.get('/:id/invoice', getSaleInvoice);
router.put('/:id/cancel', cancelSale);
router.route('/:id').get(getSale);

module.exports = router;
