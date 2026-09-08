const XLSX = require('xlsx');

exports.exportToExcel = (data, sheetName, filePath) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filePath);
  return filePath;
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
