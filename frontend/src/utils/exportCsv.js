// Turns an array of flat objects into a downloadable CSV file.
// `columns` maps CSV header labels to a getter run against each row.
// e.g. exportCsv('customers.csv', customers, { Name: c => c.name })
export function exportCsv(filename, rows, columns) {
  if (!Array.isArray(rows) || !columns || typeof columns !== 'object') return;

  const headers = Object.keys(columns);
  const escape = (value) => {
    let str = String(value ?? '');
    if (/^[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.map((h) => escape(h)).join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const getter = columns[h];
          const val = typeof getter === 'function' ? getter(row) : row?.[getter];
          return escape(val);
        })
        .join(',')
    ),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}