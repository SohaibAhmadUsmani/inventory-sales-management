import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiDownload, FiUserPlus, FiEdit2, FiTrash2, FiEye, FiX, FiMail, FiPhone } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';
import useDebounce from '../hooks/useDebounce';
import { exportCsv } from '../utils/exportCsv';

const emptyForm = { name: '', phone: '', email: '', address: '' };

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

function StatusBadge({ isActive, totalOrders }) {
  if (!isActive) return <span className="badge badge-muted">Inactive</span>;
  if (totalOrders === 0) return <span className="badge badge-info">New</span>;
  return <span className="badge badge-success">Active</span>;
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [profileCustomer, setProfileCustomer] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    api.get('/customers', { params: { search: debouncedSearch, page, limit: 10 } })
      .then((res) => {
        setCustomers(res.data.customers);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => toast.error('Could not load customers'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, page]);

  const fetchStats = useCallback(() => {
    api.get('/customers/stats').then((res) => setStats(res.data.stats)).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const visibleCustomers = customers.filter((c) => {
    if (statusFilter === 'active') return c.isActive && c.totalOrders > 0;
    if (statusFilter === 'new') return c.isActive && c.totalOrders === 0;
    if (statusFilter === 'inactive') return !c.isActive;
    return true;
  });

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (c) => {
    setEditingId(c._id);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
        toast.success('Customer updated');
      } else {
        await api.post('/customers', form);
        toast.success('Customer added');
      }
      setShowForm(false);
      fetchCustomers();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Remove ${customer.name} from your customer list?`)) return;
    try {
      await api.delete(`/customers/${customer._id}`);
      toast.success('Customer removed');
      fetchCustomers();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove customer');
    }
  };

  const openProfile = (customer) => {
    setProfileCustomer(customer);
    setPurchasesLoading(true);
    api.get(`/customers/${customer._id}/purchases`)
      .then((res) => setPurchases(res.data.sales))
      .catch(() => toast.error('Could not load purchase history'))
      .finally(() => setPurchasesLoading(false));
  };

  const handleExport = () => {
    if (visibleCustomers.length === 0) return toast.info('No customers to export');
    exportCsv('customers.csv', visibleCustomers, {
      Name: (c) => c.name,
      Phone: (c) => c.phone,
      Email: (c) => c.email,
      Address: (c) => c.address,
      'Total Orders': (c) => c.totalOrders,
      'Total Spending': (c) => c.totalSpending?.toFixed(2),
      Status: (c) => (c.isActive ? 'Active' : 'Inactive'),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customer Relationship Management</h1>
          <p className="page-subtitle">Manage your client base, track purchase history, and total spending.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport}><FiDownload /> Export CSV</button>
          <button className="btn btn-primary" onClick={openAdd}><FiUserPlus /> Add Customer</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Customers</span>
          <span className="stat-value">{stats ? stats.total.toLocaleString() : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Customers</span>
          <span className="stat-value">{stats ? stats.active.toLocaleString() : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">New This Month</span>
          <span className="stat-value">{stats ? stats.newThisMonth.toLocaleString() : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Lifetime Value</span>
          <span className="stat-value">${stats ? stats.totalLifetimeValue.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar" style={{ marginBottom: 0, flex: 1 }}>
          <FiSearch className="search-icon" />
          <input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="active">Active</option>
          <option value="new">New</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Orders</th>
              <th>Total Spent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="loading">Loading customers...</td></tr>
            ) : visibleCustomers.length === 0 ? (
              <tr><td colSpan="6" className="empty-state">No customers match your search.</td></tr>
            ) : visibleCustomers.map((c) => (
              <tr key={c._id}>
                <td>
                  <div className="profile-cell">
                    <span className="avatar">{initials(c.name)}</span>
                    <div>
                      <div className="profile-name">{c.name}</div>
                      <div className="profile-meta">{c._id.slice(-6).toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-cell">
                    {c.email && <span><FiMail /> {c.email}</span>}
                    {c.phone && <span><FiPhone /> {c.phone}</span>}
                  </div>
                </td>
                <td><StatusBadge isActive={c.isActive} totalOrders={c.totalOrders} /></td>
                <td>{c.totalOrders}</td>
                <td>${c.totalSpending?.toFixed(2)}</td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" title="View profile" onClick={() => openProfile(c)}><FiEye /></button>
                    <button className="icon-btn" title="Edit" onClick={() => openEdit(c)}><FiEdit2 /></button>
                    <button className="icon-btn icon-btn-danger" title="Remove" onClick={() => handleDelete(c)}><FiTrash2 /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="icon-btn" onClick={() => setShowForm(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {profileCustomer && (
        <div className="modal-overlay" onClick={() => setProfileCustomer(null)}>
          <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="profile-cell">
                <span className="avatar avatar-lg">{initials(profileCustomer.name)}</span>
                <div>
                  <h2 style={{ marginBottom: 2 }}>{profileCustomer.name}</h2>
                  <div className="profile-meta">{profileCustomer.email} {profileCustomer.phone && `· ${profileCustomer.phone}`}</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setProfileCustomer(null)}><FiX /></button>
            </div>

            <div className="stat-grid stat-grid-compact">
              <div className="stat-card">
                <span className="stat-label">Total Orders</span>
                <span className="stat-value">{profileCustomer.totalOrders}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Spending</span>
                <span className="stat-value">${profileCustomer.totalSpending?.toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Address</span>
                <span className="stat-value-sm">{profileCustomer.address || '—'}</span>
              </div>
            </div>

            <h3 className="section-title">Purchase History</h3>
            <table>
              <thead>
                <tr><th>Invoice</th><th>Date</th><th>Items</th><th>Payment</th><th>Total</th></tr>
              </thead>
              <tbody>
                {purchasesLoading ? (
                  <tr><td colSpan="5" className="loading">Loading...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan="5" className="empty-state">No purchases yet.</td></tr>
                ) : purchases.map((sale) => (
                  <tr key={sale._id}>
                    <td>{sale.invoiceNumber}</td>
                    <td>{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td>{sale.items.length}</td>
                    <td style={{ textTransform: 'capitalize' }}>{sale.paymentMethod}</td>
                    <td>${sale.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}