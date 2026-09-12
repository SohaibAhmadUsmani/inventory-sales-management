import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiDownload, FiPlus, FiEdit2, FiTrash2, FiEye, FiX, FiMail, FiPhone, FiPackage } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';
import useDebounce from '../hooks/useDebounce';
import { exportCsv } from '../utils/exportCsv';

const emptyForm = { name: '', company: '', phone: '', email: '', address: '' };

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
}

const paymentBadge = {
  paid: 'badge-success',
  pending: 'badge-warning',
  partial: 'badge-info',
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [profileSupplier, setProfileSupplier] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchaseSummary, setPurchaseSummary] = useState(null);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const fetchSuppliers = useCallback(() => {
    setLoading(true);
    api.get('/suppliers', { params: { search: debouncedSearch, page, limit: 10 } })
      .then((res) => {
        setSuppliers(res.data.suppliers);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => toast.error('Could not load suppliers'))
      .finally(() => setLoading(false));
  }, [debouncedSearch, page]);

  const fetchStats = useCallback(() => {
    api.get('/suppliers/stats').then((res) => setStats(res.data.stats)).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s) => {
    setEditingId(s._id);
    setForm({ name: s.name, company: s.company || '', phone: s.phone || '', email: s.email || '', address: s.address || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, form);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', form);
        toast.success('Supplier added');
      }
      setShowForm(false);
      fetchSuppliers();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Remove ${supplier.name} from your suppliers?`)) return;
    try {
      await api.delete(`/suppliers/${supplier._id}`);
      toast.success('Supplier removed');
      fetchSuppliers();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove supplier');
    }
  };

  const openProfile = (supplier) => {
    setProfileSupplier(supplier);
    setPurchasesLoading(true);
    Promise.all([
      api.get(`/suppliers/${supplier._id}`),
      api.get(`/suppliers/${supplier._id}/purchases`),
    ])
      .then(([detailRes, purchaseRes]) => {
        setProfileSupplier(detailRes.data.supplier);
        setPurchases(purchaseRes.data.purchases);
        setPurchaseSummary(purchaseRes.data.summary);
      })
      .catch(() => toast.error('Could not load supplier details'))
      .finally(() => setPurchasesLoading(false));
  };

  const handleExport = () => {
    if (suppliers.length === 0) return toast.info('No suppliers to export');
    exportCsv('suppliers.csv', suppliers, {
      Name: (s) => s.name,
      Company: (s) => s.company,
      Phone: (s) => s.phone,
      Email: (s) => s.email,
      Address: (s) => s.address,
      'Total Purchases': (s) => s.totalPurchases?.toFixed(2),
      Status: (s) => (s.isActive ? 'Active' : 'Inactive'),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Supplier &amp; Purchase Management</h1>
          <p className="page-subtitle">Manage vendors, track products supplied, and monitor payment status.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExport}><FiDownload /> Export CSV</button>
          <button className="btn btn-primary" onClick={openAdd}><FiPlus /> Add Supplier</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Suppliers</span>
          <span className="stat-value">{stats ? stats.total.toLocaleString() : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Suppliers</span>
          <span className="stat-value">{stats ? stats.active.toLocaleString() : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending Orders</span>
          <span className="stat-value">{stats ? stats.pendingPOs.toLocaleString() : '—'}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Spend</span>
          <span className="stat-value">${stats ? stats.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-bar" style={{ marginBottom: 0, flex: 1 }}>
          <FiSearch className="search-icon" />
          <input
            placeholder="Search vendors by name, company, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Contact</th>
              <th>Products Supplied</th>
              <th>Total Purchases</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="loading">Loading suppliers...</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan="6" className="empty-state">No suppliers match your search.</td></tr>
            ) : suppliers.map((s) => (
              <tr key={s._id}>
                <td>
                  <div className="profile-cell">
                    <span className="avatar">{initials(s.company || s.name)}</span>
                    <div>
                      <div className="profile-name">{s.company || s.name}</div>
                      <div className="profile-meta">{s.company ? s.name : `SUP-${s._id.slice(-4).toUpperCase()}`}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-cell">
                    {s.email && <span><FiMail /> {s.email}</span>}
                    {s.phone && <span><FiPhone /> {s.phone}</span>}
                  </div>
                </td>
                <td><span className="badge badge-muted"><FiPackage /> {s.productsSupplied?.length ?? 0}</span></td>
                <td>${s.totalPurchases?.toFixed(2)}</td>
                <td>{s.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Inactive</span>}</td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" title="View profile" onClick={() => openProfile(s)}><FiEye /></button>
                    <button className="icon-btn" title="Edit" onClick={() => openEdit(s)}><FiEdit2 /></button>
                    <button className="icon-btn icon-btn-danger" title="Remove" onClick={() => handleDelete(s)}><FiTrash2 /></button>
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
              <h2>{editingId ? 'Edit Supplier' : 'Add Supplier'}</h2>
              <button className="icon-btn" onClick={() => setShowForm(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Contact Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
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
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Supplier'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {profileSupplier && (
        <div className="modal-overlay" onClick={() => setProfileSupplier(null)}>
          <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="profile-cell">
                <span className="avatar avatar-lg">{initials(profileSupplier.company || profileSupplier.name)}</span>
                <div>
                  <h2 style={{ marginBottom: 2 }}>{profileSupplier.company || profileSupplier.name}</h2>
                  <div className="profile-meta">{profileSupplier.name} {profileSupplier.email && `· ${profileSupplier.email}`}</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setProfileSupplier(null)}><FiX /></button>
            </div>

            <div className="stat-grid stat-grid-compact">
              <div className="stat-card">
                <span className="stat-label">Total Purchases</span>
                <span className="stat-value">${profileSupplier.totalPurchases?.toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Pending Payments</span>
                <span className="stat-value">${(purchaseSummary?.pending || 0).toFixed(2)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Address</span>
                <span className="stat-value-sm">{profileSupplier.address || '—'}</span>
              </div>
            </div>

            <h3 className="section-title">Products Supplied</h3>
            {profileSupplier.productsSupplied?.length ? (
              <div className="chip-row">
                {profileSupplier.productsSupplied.map((p) => (
                  <span key={p._id} className="chip">{p.name} <span className="chip-muted">{p.sku}</span></span>
                ))}
              </div>
            ) : (
              <p className="empty-state" style={{ padding: '12px 0' }}>No products linked yet. Assign this supplier from the Products page.</p>
            )}

            <h3 className="section-title">Purchase History</h3>
            <table>
              <thead>
                <tr><th>Order #</th><th>Date</th><th>Items</th><th>Payment Status</th><th>Total</th></tr>
              </thead>
              <tbody>
                {purchasesLoading ? (
                  <tr><td colSpan="5" className="loading">Loading...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan="5" className="empty-state">No purchase orders yet.</td></tr>
                ) : purchases.map((p) => (
                  <tr key={p._id}>
                    <td>{p.orderNumber}</td>
                    <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                    <td>{p.items.length}</td>
                    <td><span className={`badge ${paymentBadge[p.paymentStatus] || 'badge-muted'}`}>{p.paymentStatus}</span></td>
                    <td>${p.totalCost.toFixed(2)}</td>
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