const router = require('express').Router();
const {
  salesReport, productSalesReport, inventoryReport, profitReport, customerReport, supplierReport,
  exportSalesExcel, exportSalesPdf,
  exportProductSalesExcel, exportProductSalesPdf,
  exportInventoryExcel, exportInventoryPdf,
  exportProfitExcel, exportProfitPdf,
  exportCustomerExcel, exportCustomerPdf,
  exportSupplierExcel, exportSupplierPdf,
  exportMonthlyBusinessReportPdf,
} = require('../controllers/report.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.get('/sales', salesReport);
router.get('/sales/export/excel', exportSalesExcel);
router.get('/sales/export/pdf', exportSalesPdf);

router.get('/products', productSalesReport);
router.get('/products/export/excel', exportProductSalesExcel);
router.get('/products/export/pdf', exportProductSalesPdf);

router.get('/inventory', inventoryReport);
router.get('/inventory/export/excel', exportInventoryExcel);
router.get('/inventory/export/pdf', exportInventoryPdf);

router.get('/profit', profitReport);
router.get('/profit/export/excel', exportProfitExcel);
router.get('/profit/export/pdf', exportProfitPdf);

router.get('/customers', customerReport);
router.get('/customers/export/excel', exportCustomerExcel);
router.get('/customers/export/pdf', exportCustomerPdf);

router.get('/suppliers', supplierReport);
router.get('/suppliers/export/excel', exportSupplierExcel);
router.get('/suppliers/export/pdf', exportSupplierPdf);

router.get('/monthly/export/pdf', exportMonthlyBusinessReportPdf);

module.exports = router;
