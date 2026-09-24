import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';
import { exportCsv } from '../utils/exportCsv';
import { FiDownload, FiFileText } from 'react-icons/fi';

const TABS = [
  { key: 'sales', label: 'Sales' },
  { key: 'products', label: 'Product Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'profit', label: 'Profit' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
];

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildParamsForTab(tab, filters) {
  const { startDate, endDate, groupBy, customer, paymentMethod, status, product, category, supplier } = filters;
  const params = {};
  if (['sales', 'products', 'profit', 'suppliers'].includes(tab)) {
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
  }
  if (tab === 'sales') {
    params.groupBy = groupBy;
    if (customer) params.customer = customer;
    if (paymentMethod) params.paymentMethod = paymentMethod;
    if (status) params.status = status;
  }
  if (tab === 'products' || tab === 'profit') {
    if (product) params.product = product;
    if (category) params.category = category;
  }
  if (tab === 'inventory' && category) params.category = category;
  if (tab === 'customers' && customer) params.customer = customer;
  if (tab === 'suppliers' && supplier) params.supplier = supplier;
  return params;
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', groupBy: 'day', customer: '', paymentMethod: '', status: '', product: '', category: '', supplier: '' });
  const [appliedParams, setAppliedParams] = useState({ groupBy: 'day' });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState('');

  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    api.get('/products', { params: { limit: 500 } }).then(res => setProducts(res.data?.products || [])).catch(() => {});
    api.get('/categories').then(res => setCategories(res.data?.categories || [])).catch(() => {});
    api.get('/customers', { params: { limit: 500 } }).then(res => setCustomers(res.data?.customers || [])).catch(() => {});
    api.get('/suppliers', { params: { limit: 500 } }).then(res => setSuppliers(res.data?.suppliers || [])).catch(() => {});
  }, []);

  const runReportFetch = useCallback((tab, params) => {
    setLoading(true);
    setError(null);
    setAppliedParams(params);
    api.get(`/reports/${tab}`, { params })
      .then(res => setReportData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to fetch report'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = buildParamsForTab(activeTab, filters);
    runReportFetch(activeTab, params);
    // Auto-fetch on initial mount and whenever activeTab changes (FE-100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, runReportFetch]);

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    setReportData(null);
    setError(null);
    setActiveTab(tab);
  };

  const updateFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const fetchReport = () => {
    const params = buildParamsForTab(activeTab, filters);
    runReportFetch(activeTab, params);
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(new Blob([blob]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadExport = async (format) => {
    const key = `${activeTab}-${format}`;
    setExporting(key);
    try {
      const res = await api.get(`/reports/${activeTab}/export/${format}`, { params: appliedParams, responseType: 'blob' });
      triggerDownload(res.data, `${activeTab}_report.${format === 'excel' ? 'xlsx' : 'pdf'}`);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting('');
    }
  };

  const handleExportCsv = () => {
    if (!reportData) return;

    if (activeTab === 'sales') {
      const rows = reportData.sales || [];
      if (rows.length === 0) return toast.info('No sales data to export');
      exportCsv('sales_report.csv', rows, {
        Period: (s) => s._id,
        'Sales Count': (s) => s.count,
        'Total Revenue': (s) => Number(s.totalSales || 0).toFixed(2),
        'Avg Sale': (s) => Number(s.avgSale || 0).toFixed(2),
      });
      return;
    }

    if (activeTab === 'products') {
      const rows = reportData.productSales || [];
      if (rows.length === 0) return toast.info('No product sales data to export');
      exportCsv('product_sales_report.csv', rows, {
        Product: (p) => p._id,
        SKU: (p) => p.sku || '',
        'Qty Sold': (p) => p.totalQuantity,
        Revenue: (p) => Number(p.totalRevenue || 0).toFixed(2),
      });
      return;
    }

    if (activeTab === 'inventory') {
      const rows = reportData.products || [];
      if (rows.length === 0) return toast.info('No inventory data to export');
      exportCsv('inventory_report.csv', rows, {
        Name: (p) => p.name,
        SKU: (p) => p.sku,
        Category: (p) => p.category?.name || '-',
        Price: (p) => Number(p.price || 0).toFixed(2),
        Cost: (p) => Number(p.cost || 0).toFixed(2),
        Stock: (p) => p.stock,
        'Min Stock': (p) => p.minimumStock,
        Status: (p) => (p.stock === 0 ? 'Out of Stock' : p.stock <= p.minimumStock ? 'Low Stock' : 'In Stock'),
      });
      return;
    }

    if (activeTab === 'profit') {
      const rows = reportData.profitData || [];
      if (rows.length === 0) return toast.info('No profit data to export');
      exportCsv('profit_report.csv', rows, {
        Date: (d) => d._id,
        Revenue: (d) => Number(d.revenue || 0).toFixed(2),
        Cost: (d) => Number(d.cost || 0).toFixed(2),
        Profit: (d) => Number(d.profit || 0).toFixed(2),
      });
      return;
    }

    if (activeTab === 'customers') {
      if (reportData.purchaseHistory) {
        const rows = reportData.purchaseHistory || [];
        if (rows.length === 0) return toast.info('No customer purchases to export');
        exportCsv('customer_purchases_report.csv', rows, {
          'Invoice #': (s) => s.invoiceNumber,
          Date: (s) => new Date(s.createdAt).toLocaleDateString(),
          Total: (s) => Number(s.total || 0).toFixed(2),
          Payment: (s) => s.paymentMethod,
          Status: (s) => s.status,
        });
      } else {
        const rows = reportData.topCustomers || [];
        if (rows.length === 0) return toast.info('No customer data to export');
        exportCsv('customers_report.csv', rows, {
          Name: (c) => c.name,
          Phone: (c) => c.phone || '-',
          Email: (c) => c.email || '-',
          'Total Orders': (c) => c.totalOrders,
          'Total Spending': (c) => Number(c.totalSpending || 0).toFixed(2),
        });
      }
      return;
    }

    if (activeTab === 'suppliers') {
      const rows = reportData.supplierPurchases || [];
      if (rows.length === 0) return toast.info('No supplier purchases to export');
      exportCsv('supplier_purchases_report.csv', rows, {
        Supplier: (s) => s.name,
        Company: (s) => s.company || '-',
        'Order Count': (s) => s.orderCount,
        'Total Purchases': (s) => Number(s.totalPurchases || 0).toFixed(2),
      });
    }
  };

  const downloadMonthlyReport = async () => {
    setExporting('monthly');
    try {
      const now = new Date();
      const [yearStr, monthStr] = (reportMonth || '').split('-');
      const year = parseInt(yearStr, 10) || now.getFullYear();
      const month = parseInt(monthStr, 10) || (now.getMonth() + 1);
      const res = await api.get('/reports/monthly/export/pdf', {
        params: { month, year },
        responseType: 'blob',
      });
      triggerDownload(res.data, `Monthly_Business_Report_${year}_${String(month).padStart(2, '0')}.pdf`);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting('');
    }
  };

  const headerActions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <input
        type="month"
        className="ui-filter-input"
        value={reportMonth}
        onChange={(e) => setReportMonth(e.target.value)}
        aria-label="Select month for Monthly Business Report"
      />
      <button className="ui-btn-dark" onClick={downloadMonthlyReport} disabled={exporting === 'monthly'}>
        <FiFileText size={16} />
        {exporting === 'monthly' ? 'Generating...' : 'Monthly Business Report (PDF)'}
      </button>
    </div>
  );

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate, filter and export detailed business reports" actions={headerActions} />
      <div className="ui-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`ui-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => switchTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="ui-filter-bar">
        {['sales', 'products', 'profit', 'suppliers'].includes(activeTab) && (
          <>
            <input type="date" className="ui-filter-input" value={filters.startDate} max={filters.endDate || undefined} onChange={e => updateFilter('startDate', e.target.value)} aria-label="Start date" />
            <input type="date" className="ui-filter-input" value={filters.endDate} min={filters.startDate || undefined} onChange={e => updateFilter('endDate', e.target.value)} aria-label="End date" />
          </>
        )}

        {activeTab === 'sales' && (
          <>
            <select className="ui-filter-input" value={filters.groupBy} onChange={e => updateFilter('groupBy', e.target.value)}>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
            <select className="ui-filter-input" value={filters.customer} onChange={e => updateFilter('customer', e.target.value)}>
              <option value="">All Customers</option>
              {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select className="ui-filter-input" value={filters.paymentMethod} onChange={e => updateFilter('paymentMethod', e.target.value)}>
              <option value="">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
            </select>
            <select className="ui-filter-input" value={filters.status} onChange={e => updateFilter('status', e.target.value)}>
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </>
        )}

        {(activeTab === 'products' || activeTab === 'profit') && (
          <>
            <select className="ui-filter-input" value={filters.product} onChange={e => updateFilter('product', e.target.value)}>
              <option value="">All Products</option>
              {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <select className="ui-filter-input" value={filters.category} onChange={e => updateFilter('category', e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </>
        )}

        {activeTab === 'inventory' && (
          <select className="ui-filter-input" value={filters.category} onChange={e => updateFilter('category', e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}

        {activeTab === 'customers' && (
          <select className="ui-filter-input" value={filters.customer} onChange={e => updateFilter('customer', e.target.value)}>
            <option value="">Top 10 Customers</option>
            {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        )}

        {activeTab === 'suppliers' && (
          <select className="ui-filter-input" value={filters.supplier} onChange={e => updateFilter('supplier', e.target.value)}>
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        )}

        <button className="ui-btn-outline" style={{ background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }} onClick={fetchReport} disabled={loading}>
          {loading ? 'Loading...' : 'Generate'}
        </button>

        {reportData && (
          <>
            <button className="ui-btn-outline" onClick={handleExportCsv}>
              <FiDownload size={14} />
              CSV
            </button>
            <button className="ui-btn-outline" onClick={() => downloadExport('excel')} disabled={exporting === `${activeTab}-excel`}>
              <FiDownload size={14} />
              {exporting === `${activeTab}-excel` ? 'Exporting...' : 'Excel'}
            </button>
            <button className="ui-btn-outline" onClick={() => downloadExport('pdf')} disabled={exporting === `${activeTab}-pdf`}>
              <FiDownload size={14} />
              {exporting === `${activeTab}-pdf` ? 'Exporting...' : 'PDF'}
            </button>
          </>
        )}
      </div>

      {loading && <div className="loading">Loading report...</div>}

      {!loading && error && (
        <div className="ui-table-card" style={{ textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
      )}

      {!loading && !error && reportData && (
        <ReportResults tab={activeTab} data={reportData} />
      )}
    </>
  );
}

function SummaryCards({ summary }) {
  if (!summary) return null;
  const entries = Object.entries(summary).filter(([key]) => key !== '_id');
  if (entries.length === 0) return null;
  return (
    <div className="ui-summary-grid">
      {entries.map(([key, val]) => (
        <div key={key} className="ui-summary-item">
          <div className="ui-summary-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}</div>
          <div className="ui-summary-value">
            {typeof val === 'number'
              ? (/Revenue|Cost|Profit|Spending|Value|avgSale/.test(key) ? money(val) : val.toLocaleString())
              : String(val ?? 0)}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ span, children }) {
  return <tr><td colSpan={span} style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>{children || 'No data found for the selected filters'}</td></tr>;
}

function ReportResults({ tab, data }) {
  if (tab === 'sales') {
    const { sales = [], summary } = data;
    return (
      <div className="ui-table-card">
        <div className="ui-table-card-head"><div className="ui-chart-title">Sales Report</div></div>
        <SummaryCards summary={summary} />
        <table>
          <thead><tr><th>Period</th><th>Sales Count</th><th>Total Revenue</th><th>Avg Sale</th></tr></thead>
          <tbody>
            {sales.length === 0 ? <EmptyRow span={4} /> : sales.map((s, i) => (
              <tr key={i}><td>{s._id}</td><td>{s.count}</td><td>{money(s.totalSales)}</td><td>{money(s.avgSale)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'products') {
    const { productSales = [] } = data;
    return (
      <div className="ui-table-card">
        <div className="ui-table-card-head"><div className="ui-chart-title">Product Sales Report</div></div>
        <table>
          <thead><tr><th>Product</th><th>SKU</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
          <tbody>
            {productSales.length === 0 ? <EmptyRow span={4} /> : productSales.map((p, i) => (
              <tr key={i}><td>{p._id}</td><td>{p.sku}</td><td>{p.totalQuantity}</td><td>{money(p.totalRevenue)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'inventory') {
    const { products = [], summary } = data;
    return (
      <div className="ui-table-card">
        <div className="ui-table-card-head"><div className="ui-chart-title">Inventory Report</div></div>
        <SummaryCards summary={summary} />
        <table>
          <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Min Stock</th><th>Status</th></tr></thead>
          <tbody>
            {products.length === 0 ? <EmptyRow span={8} /> : products.map(p => (
              <tr key={p._id}>
                <td>{p.name}</td><td>{p.sku}</td><td>{p.category?.name || '-'}</td>
                <td>{money(p.price)}</td><td>{money(p.cost)}</td><td>{p.stock}</td><td>{p.minimumStock}</td>
                <td>
                  {p.stock === 0 ? (
                    <span className="badge badge-danger">Out of Stock</span>
                  ) : p.stock <= p.minimumStock ? (
                    <span className="badge badge-warning">Low Stock</span>
                  ) : (
                    <span className="badge badge-success">In Stock</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'profit') {
    const { profitData = [], summary } = data;
    return (
      <div className="ui-table-card">
        <div className="ui-table-card-head"><div className="ui-chart-title">Profit Report</div></div>
        <SummaryCards summary={summary} />
        <table>
          <thead><tr><th>Date</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
          <tbody>
            {profitData.length === 0 ? <EmptyRow span={4} /> : profitData.map((d, i) => (
              <tr key={i}><td>{d._id}</td><td>{money(d.revenue)}</td><td>{money(d.cost)}</td><td>{money(d.profit)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'customers') {
    const { topCustomers = [], summary, purchaseHistory } = data;
    if (purchaseHistory) {
      const cust = topCustomers[0];
      return (
        <div className="ui-table-card">
          <div className="ui-table-card-head"><div className="ui-chart-title">Customer Report — {cust?.name}</div></div>
          <SummaryCards summary={summary} />
          <table>
            <thead><tr><th>Invoice #</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              {purchaseHistory.length === 0 ? <EmptyRow span={5} /> : purchaseHistory.map(s => (
                <tr key={s._id}><td>{s.invoiceNumber}</td><td>{new Date(s.createdAt).toLocaleDateString()}</td><td>{money(s.total)}</td><td>{s.paymentMethod}</td><td>{s.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="ui-table-card">
        <div className="ui-table-card-head"><div className="ui-chart-title">Customer Report (Top 10 by Spending)</div></div>
        <SummaryCards summary={summary} />
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Total Orders</th><th>Total Spending</th></tr></thead>
          <tbody>
            {topCustomers.length === 0 ? <EmptyRow span={5} /> : topCustomers.map(c => (
              <tr key={c._id}><td>{c.name}</td><td>{c.phone || '-'}</td><td>{c.email || '-'}</td><td>{c.totalOrders}</td><td>{money(c.totalSpending)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === 'suppliers') {
    const { supplierPurchases = [] } = data;
    return (
      <div className="ui-table-card">
        <div className="ui-table-card-head"><div className="ui-chart-title">Supplier Purchases Report</div></div>
        <table>
          <thead><tr><th>Supplier</th><th>Company</th><th>Order Count</th><th>Total Purchases</th></tr></thead>
          <tbody>
            {supplierPurchases.length === 0 ? <EmptyRow span={4} /> : supplierPurchases.map((s, i) => (
              <tr key={i}><td>{s.name}</td><td>{s.company || '-'}</td><td>{s.orderCount}</td><td>{money(s.totalPurchases)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
