import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

const TABS = [
  { key: 'sales', label: 'Sales' },
  { key: 'products', label: 'Product Sales' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'profit', label: 'Profit' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
];

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 };

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', groupBy: 'day', customer: '', paymentMethod: '', status: '', product: '', category: '', supplier: '' });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState('');

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    api.get('/products', { params: { limit: 500 } }).then(res => setProducts(res.data.products || [])).catch(() => {});
    api.get('/categories').then(res => setCategories(res.data.categories || [])).catch(() => {});
    api.get('/customers', { params: { limit: 500 } }).then(res => setCustomers(res.data.customers || [])).catch(() => {});
    api.get('/suppliers').then(res => setSuppliers(res.data.suppliers || [])).catch(() => {});
  }, []);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setReportData(null);
    setError(null);
  };

  const updateFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const activeParams = () => {
    const { startDate, endDate, groupBy, customer, paymentMethod, status, product, category, supplier } = filters;
    const params = {};
    if (['sales', 'products', 'profit', 'suppliers'].includes(activeTab)) {
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
    }
    if (activeTab === 'sales') {
      params.groupBy = groupBy;
      if (customer) params.customer = customer;
      if (paymentMethod) params.paymentMethod = paymentMethod;
      if (status) params.status = status;
    }
    if (activeTab === 'products' || activeTab === 'profit') {
      if (product) params.product = product;
      if (category) params.category = category;
    }
    if (activeTab === 'inventory' && category) params.category = category;
    if (activeTab === 'customers' && customer) params.customer = customer;
    if (activeTab === 'suppliers' && supplier) params.supplier = supplier;
    return params;
  };

  const fetchReport = () => {
    setLoading(true);
    setError(null);
    api.get(`/reports/${activeTab}`, { params: activeParams() })
      .then(res => setReportData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to fetch report'))
      .finally(() => setLoading(false));
  };

  const downloadExport = async (format) => {
    const key = `${activeTab}-${format}`;
    setExporting(key);
    try {
      const res = await api.get(`/reports/${activeTab}/export/${format}`, { params: activeParams(), responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}_report.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting('');
    }
  };

  const downloadMonthlyReport = async () => {
    setExporting('monthly');
    try {
      const now = new Date();
      const res = await api.get('/reports/monthly/export/pdf', {
        params: { month: now.getMonth() + 1, year: now.getFullYear() },
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Monthly_Business_Report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting('');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        <button className="btn btn-secondary" onClick={downloadMonthlyReport} disabled={exporting === 'monthly'}>
          {exporting === 'monthly' ? 'Generating...' : 'Monthly Business Report (PDF)'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {TABS.map(t => (
            <button key={t.key} className={`btn ${activeTab === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => switchTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {['sales', 'products', 'profit', 'suppliers'].includes(activeTab) && (
            <>
              <input type="date" value={filters.startDate} onChange={e => updateFilter('startDate', e.target.value)} style={selectStyle} />
              <input type="date" value={filters.endDate} onChange={e => updateFilter('endDate', e.target.value)} style={selectStyle} />
            </>
          )}

          {activeTab === 'sales' && (
            <>
              <select value={filters.groupBy} onChange={e => updateFilter('groupBy', e.target.value)} style={selectStyle}>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
              <select value={filters.customer} onChange={e => updateFilter('customer', e.target.value)} style={selectStyle}>
                <option value="">All Customers</option>
                {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <select value={filters.paymentMethod} onChange={e => updateFilter('paymentMethod', e.target.value)} style={selectStyle}>
                <option value="">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
              </select>
              <select value={filters.status} onChange={e => updateFilter('status', e.target.value)} style={selectStyle}>
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="returned">Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </>
          )}

          {(activeTab === 'products' || activeTab === 'profit') && (
            <>
              <select value={filters.product} onChange={e => updateFilter('product', e.target.value)} style={selectStyle}>
                <option value="">All Products</option>
                {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <select value={filters.category} onChange={e => updateFilter('category', e.target.value)} style={selectStyle}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </>
          )}

          {activeTab === 'inventory' && (
            <select value={filters.category} onChange={e => updateFilter('category', e.target.value)} style={selectStyle}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          )}

          {activeTab === 'customers' && (
            <select value={filters.customer} onChange={e => updateFilter('customer', e.target.value)} style={selectStyle}>
              <option value="">Top 10 Customers</option>
              {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          )}

          {activeTab === 'suppliers' && (
            <select value={filters.supplier} onChange={e => updateFilter('supplier', e.target.value)} style={selectStyle}>
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          )}

          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>{loading ? 'Loading...' : 'Generate'}</button>

          {reportData && (
            <>
              <button className="btn btn-secondary" onClick={() => downloadExport('excel')} disabled={exporting === `${activeTab}-excel`}>
                {exporting === `${activeTab}-excel` ? 'Exporting...' : 'Export Excel'}
              </button>
              <button className="btn btn-secondary" onClick={() => downloadExport('pdf')} disabled={exporting === `${activeTab}-pdf`}>
                {exporting === `${activeTab}-pdf` ? 'Exporting...' : 'Export PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
      )}

      {!error && reportData && (
        <ReportResults tab={activeTab} data={reportData} />
      )}
    </div>
  );
}

function SummaryCards({ summary }) {
  if (!summary) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
      {Object.entries(summary).map(([key, val]) => (
        <div key={key} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{typeof val === 'number' ? (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('spending') || key.toLowerCase().includes('profit') || key.toLowerCase().includes('cost') || key.toLowerCase().includes('value') || key.toLowerCase().includes('sale') ? money(val) : val.toLocaleString()) : String(val)}</div>
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
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Sales Report</h3>
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
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Product Sales Report</h3>
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
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Inventory Report</h3>
        <SummaryCards summary={summary} />
        <table>
          <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Min Stock</th><th>Status</th></tr></thead>
          <tbody>
            {products.length === 0 ? <EmptyRow span={8} /> : products.map(p => (
              <tr key={p._id}>
                <td>{p.name}</td><td>{p.sku}</td><td>{p.category?.name || '-'}</td>
                <td>{money(p.price)}</td><td>{money(p.cost)}</td><td>{p.stock}</td><td>{p.minimumStock}</td>
                <td><span className={`badge ${p.stock <= p.minimumStock ? 'badge-danger' : 'badge-success'}`}>{p.stock <= p.minimumStock ? 'Low Stock' : 'In Stock'}</span></td>
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
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Profit Report</h3>
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
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Customer Report — {cust?.name}</h3>
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
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Customer Report (Top 10 by Spending)</h3>
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
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Supplier Purchases Report</h3>
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
