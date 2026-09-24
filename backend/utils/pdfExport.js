const PDFDocument = require('pdfkit-table');

const sanitizeFilename = (rawName, fallback = 'Document') => {
  const safeName = String(rawName || fallback).replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  return safeName || fallback;
};

const fmtMoney = (val) => Number(val || 0).toFixed(2);

exports.generateInvoicePDF = (sale, res) => {
  const doc = new PDFDocument({ margin: 50 });
  const safeName = sanitizeFilename(sale?.invoiceNumber, 'Invoice');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
  res.on('close', () => {
    if (!res.writableEnded) doc.destroy();
  });
  doc.pipe(res);

  doc.fontSize(20).text('INVOICE', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice #: ${sale?.invoiceNumber || 'N/A'}`);
  doc.text(`Date: ${sale?.createdAt ? new Date(sale.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`);
  doc.text(`Payment Method: ${sale?.paymentMethod || 'N/A'}`);
  if (sale?.paymentStatus) doc.text(`Payment Status: ${sale.paymentStatus}`);
  if (sale?.customer) {
    doc.text(`Customer: ${sale.customer.name || 'Walk-in'}`);
    if (sale.customer.phone) doc.text(`Phone: ${sale.customer.phone}`);
    if (sale.customer.email) doc.text(`Email: ${sale.customer.email}`);
    if (sale.customer.address) doc.text(`Address: ${sale.customer.address}`);
  }
  doc.moveDown();

  doc.fontSize(14).text('Items', { underline: true });
  doc.moveDown(0.5);
  (sale?.items || []).forEach((item) => {
    const qty = Number(item?.quantity || 0);
    const unitPrice = fmtMoney(item?.price);
    const lineTotal = fmtMoney(item?.total ?? (qty * Number(item?.price || 0)));
    doc.fontSize(10).text(`${item?.name || 'Item'} x ${qty} @ $${unitPrice} - $${lineTotal}`);
  });
  doc.moveDown();
  doc.fontSize(11).text(`Subtotal: $${fmtMoney(sale?.subtotal)}`);
  if (Number(sale?.discount || 0) > 0) doc.text(`Discount: -$${fmtMoney(sale?.discount)}`);
  if (Number(sale?.tax || 0) > 0) doc.text(`Tax: $${fmtMoney(sale?.tax)}`);
  doc.fontSize(14).text(`Total: $${fmtMoney(sale?.total)}`, { underline: true });

  doc.end();
};

/**
 * Generate a combined monthly business report PDF (dashboard-style summary
 * covering sales, profit, top products, revenue by category and stock health).
 */
exports.generateMonthlyBusinessReportPDF = async (data, res) => {
  const { monthLabel = 'Monthly', salesSummary = {}, profitSummary = {}, topProducts = [], categoryRevenue = [], lowStockCount = 0, newCustomers = 0 } = data || {};
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const safeName = sanitizeFilename(`Monthly_Business_Report_${monthLabel}`, 'Monthly_Business_Report');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
  res.on('close', () => {
    if (!res.writableEnded) doc.destroy();
  });
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text('Monthly Business Report', { align: 'center' });
  doc.fontSize(13).font('Helvetica').fillColor('#4f46e5').text(monthLabel, { align: 'center' });
  doc.fillColor('#64748b').fontSize(9).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1.2);

  doc.fontSize(13).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Revenue: $${fmtMoney(salesSummary.totalRevenue)}      Total Sales: ${salesSummary.totalSales ?? 0}      Avg Sale: $${fmtMoney(salesSummary.avgSale)}`);
  doc.text(`Total Cost: $${fmtMoney(profitSummary.totalCost)}      Total Profit: $${fmtMoney(profitSummary.totalProfit)}`);
  doc.text(`Low Stock Products: ${lowStockCount}      New Customers This Month: ${newCustomers}`);
  doc.moveDown(1);

  doc.fontSize(13).font('Helvetica-Bold').text('Top Selling Products');
  doc.moveDown(0.3);
  if (topProducts.length) {
    await doc.table(
      { headers: ['Product', 'Qty Sold', 'Revenue'], rows: topProducts },
      { prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9), prepareRow: () => doc.font('Helvetica').fontSize(9), padding: 6 }
    );
  } else {
    doc.fontSize(10).font('Helvetica-Oblique').text('No sales recorded this month.');
  }
  doc.moveDown(1);

  doc.fontSize(13).font('Helvetica-Bold').text('Revenue by Category');
  doc.moveDown(0.3);
  if (categoryRevenue.length) {
    await doc.table(
      { headers: ['Category', 'Revenue'], rows: categoryRevenue },
      { prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9), prepareRow: () => doc.font('Helvetica').fontSize(9), padding: 6 }
    );
  } else {
    doc.fontSize(10).font('Helvetica-Oblique').text('No sales recorded this month.');
  }

  doc.end();
};

/**
 * Generate a professional tabular report PDF.
 * @param {Object} opts
 * @param {String} opts.title - report title
 * @param {String} [opts.dateRange] - e.g. "Jan 1, 2026 - Jan 31, 2026"
 * @param {String[]} [opts.filters] - human-readable applied filters, e.g. ["Category: Electronics"]
 * @param {String[]} opts.headers - table column headers
 * @param {Array[]} opts.rows - table rows (array of arrays, already formatted as strings)
 * @param {Array[]} [opts.totals] - optional single row appended after the data, e.g. ["Total", "", "$1,234.00"]
 * @param {Object} res - express response
 */
exports.generateReportPDF = async (opts, res) => {
  const { title = 'Report', dateRange, filters = [], headers = [], rows = [], totals } = opts || {};
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const safeName = sanitizeFilename(title, 'Report');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
  res.on('close', () => {
    if (!res.writableEnded) doc.destroy();
  });
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b')
    .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  if (dateRange) {
    doc.text(`Date range: ${dateRange}`, { align: 'center' });
  }
  if (filters.length) {
    doc.text(`Filters: ${filters.join(' | ')}`, { align: 'center' });
  }
  doc.fillColor('#000000');
  doc.moveDown(1);

  const tableRows = totals ? [...rows, totals] : rows;

  if (!rows.length) {
    doc.fontSize(11).font('Helvetica-Oblique').text('No data found for the selected filters.', { align: 'center' });
  } else {
    await doc.table(
      { headers, rows: tableRows },
      {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(9),
        prepareRow: (row, indexColumn, indexRow) => {
          const isTotals = totals && indexRow === tableRows.length - 1;
          doc.font(isTotals ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        },
        padding: 6,
        divider: { header: { disabled: false, width: 1, opacity: 1 }, horizontal: { disabled: false, width: 0.5, opacity: 0.5 } },
      }
    );
  }

  doc.end();
};

