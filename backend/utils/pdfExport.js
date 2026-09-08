const PDFDocument = require('pdfkit');

exports.generateInvoicePDF = (sale, res) => {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${sale.invoiceNumber}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text('INVOICE', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Invoice #: ${sale.invoiceNumber}`);
  doc.text(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`);
  doc.text(`Payment Method: ${sale.paymentMethod}`);
  if (sale.customer) doc.text(`Customer: ${sale.customer.name}`);
  doc.moveDown();

  doc.fontSize(14).text('Items', { underline: true });
  doc.moveDown(0.5);
  sale.items.forEach(item => {
    doc.fontSize(10).text(`${item.name} x ${item.quantity} - $${item.total.toFixed(2)}`);
  });
  doc.moveDown();
  doc.text(`Subtotal: $${sale.subtotal.toFixed(2)}`);
  if (sale.discount > 0) doc.text(`Discount: -$${sale.discount.toFixed(2)}`);
  if (sale.tax > 0) doc.text(`Tax: $${sale.tax.toFixed(2)}`);
  doc.fontSize(14).text(`Total: $${sale.total.toFixed(2)}`, { underline: true });

  doc.end();
};

exports.generateReportPDF = (title, data, res) => {
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${title.replace(/\s+/g, '_')}.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  data.forEach(row => {
    doc.fontSize(10).text(JSON.stringify(row));
  });

  doc.end();
};
