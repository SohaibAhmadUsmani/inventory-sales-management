const XLSX = require('xlsx');

const sanitizeSheetName = (sheetName = 'Report') => (
  String(sheetName || 'Report').replace(/[:\\/?*\[\]]/g, '').slice(0, 31) || 'Report'
);

const sanitizeFilename = (rawName, fallback = 'Report') => {
  const safeName = String(rawName || fallback).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  return safeName || fallback;
};

const sanitizeCellValue = (val) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trimStart();
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${val}`;
  }
  return val;
};

const sanitizeRow = (row = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    out[k] = sanitizeCellValue(v);
  }
  return out;
};

exports.exportToExcel = (data = [], sheetName = 'Report', filePath) => {
  const safeRows = Array.isArray(data) ? data.map(sanitizeRow) : [];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(safeRows.length ? safeRows : [{}]);
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(sheetName));
  XLSX.writeFile(wb, filePath);
  return filePath;
};

/**
 * Stream a report (array of plain row objects) to the HTTP response as an .xlsx download.
 * @param {Object} res - express response
 * @param {Object} opts
 * @param {Object[]} opts.rows - row objects with column-name keys (same keys across rows)
 * @param {Object} [opts.totals] - optional final totals/summary row, same shape as rows
 * @param {String} [opts.sheetName='Report']
 * @param {String} opts.filename - filename without extension
 */
exports.exportReportToExcel = (res, { rows = [], totals, sheetName = 'Report', filename = 'Report' } = {}) => {
  const rawData = totals ? [...rows, totals] : rows;
  const data = rawData.map(sanitizeRow);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);

  // Auto-size columns safely without spreading potentially large arrays into Math.max
  if (data.length) {
    const headers = Object.keys(data[0]);
    ws['!cols'] = headers.map((h) => {
      const maxLen = data.reduce((max, r) => Math.max(max, String(r[h] ?? '').length), h.length);
      return { wch: Math.min(40, maxLen + 2) };
    });
  }

  const safeSheet = sanitizeSheetName(sheetName);
  XLSX.utils.book_append_sheet(wb, ws, safeSheet);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const safeName = sanitizeFilename(filename, 'Report');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
  res.send(buffer);
};

exports.formatSalesForExport = (sales = []) => {
  return sales.map((s) => ({
    'Invoice #': s.invoiceNumber,
    'Date': new Date(s.createdAt).toLocaleDateString(),
    'Customer': s.customer?.name || 'Walk-in',
    'Items': Array.isArray(s.items) ? s.items.length : 0,
    'Subtotal': s.subtotal,
    'Discount': s.discount,
    'Tax': s.tax,
    'Total': s.total,
    'Payment': s.paymentMethod,
    'Status': s.status,
  }));
};

exports.formatProductsForExport = (products = []) => {
  return products.map((p) => ({
    'Name': p.name,
    'SKU': p.sku,
    'Category': p.category?.name || '',
    'Price': p.price,
    'Cost': p.cost,
    'Stock': p.stock,
    'Min Stock': p.minimumStock,
    'Status': p.stock === 0 ? 'Out of Stock' : p.stock <= p.minimumStock ? 'Low Stock' : 'In Stock',
  }));
};

exports.formatCustomersForExport = (customers = []) => {
  return customers.map((c) => ({
    'Name': c.name,
    'Phone': c.phone,
    'Email': c.email,
    'Address': c.address,
    'Total Orders': c.totalOrders,
    'Total Spending': c.totalSpending,
  }));
};

exports.formatPurchasesForExport = (purchases = []) => {
  return purchases.map((p) => ({
    'Order #': p.orderNumber,
    'Supplier': p.supplier?.name || '',
    'Date': new Date(p.purchaseDate).toLocaleDateString(),
    'Items': Array.isArray(p.items) ? p.items.length : 0,
    'Total Cost': p.totalCost,
    'Payment': p.paymentStatus,
    'Status': p.status,
  }));
};

