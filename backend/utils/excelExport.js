const XLSX = require('xlsx');

exports.exportToExcel = (data, sheetName, filePath) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
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
exports.exportReportToExcel = (res, { rows, totals, sheetName = 'Report', filename }) => {
  const data = totals ? [...rows, totals] : rows;
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);

  // Auto-size columns roughly based on content length
  if (data.length) {
    const headers = Object.keys(data[0]);
    ws['!cols'] = headers.map((h) => ({
      wch: Math.min(40, Math.max(h.length, ...data.map((r) => String(r[h] ?? '').length)) + 2),
    }));
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename.replace(/\s+/g, '_')}.xlsx`);
  res.send(buffer);
};

exports.formatSalesForExport = (sales) => {
  return sales.map(s => ({
    'Invoice #': s.invoiceNumber,
    'Date': new Date(s.createdAt).toLocaleDateString(),
    'Customer': s.customer?.name || 'Walk-in',
    'Items': s.items.length,
    'Subtotal': s.subtotal,
    'Discount': s.discount,
    'Tax': s.tax,
    'Total': s.total,
    'Payment': s.paymentMethod,
    'Status': s.status,
  }));
};

exports.formatProductsForExport = (products) => {
  return products.map(p => ({
    'Name': p.name,
    'SKU': p.sku,
    'Category': p.category?.name || '',
    'Price': p.price,
    'Cost': p.cost,
    'Stock': p.stock,
    'Min Stock': p.minimumStock,
    'Status': p.stock <= p.minimumStock ? 'Low Stock' : 'In Stock',
  }));
};

exports.formatCustomersForExport = (customers) => {
  return customers.map(c => ({
    'Name': c.name,
    'Phone': c.phone,
    'Email': c.email,
    'Address': c.address,
    'Total Orders': c.totalOrders,
    'Total Spending': c.totalSpending,
  }));
};

exports.formatPurchasesForExport = (purchases) => {
  return purchases.map(p => ({
    'Order #': p.orderNumber,
    'Supplier': p.supplier?.name || '',
    'Date': new Date(p.purchaseDate).toLocaleDateString(),
    'Items': p.items.length,
    'Total Cost': p.totalCost,
    'Payment': p.paymentStatus,
    'Status': p.status,
  }));
};
