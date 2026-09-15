// Turns an array of flat objects into a downloadable CSV file.
// `columns` maps CSV header labels to a getter run against each row.
// e.g. exportCsv('customers.csv', customers, { Name: c => c.name })
export function exportCsv(filename, rows, columns) {
  const headers = Object.keys(columns);
  const escape = (value) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(columns[h](row))).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}