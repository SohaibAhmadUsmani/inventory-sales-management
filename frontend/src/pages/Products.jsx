import PageHeader from '../components/PageHeader';
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
  name: '',
  sku: '',
  category: '',
  price: '',
  cost: '',
  stock: '',
  minimumStock: '',
  description: '',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(() => {
    api.get('/categories')
      .then(res => setCategories(res.data.categories))
      .catch(console.error);
  }, []);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    api.get('/products', {
      params: {
        search: search || undefined,
        category: categoryFilter || undefined,
        lowStock: lowStockOnly ? 'true' : undefined,
        page,
        limit: 10,
      },
    })
      .then(res => {
        setProducts(res.data.products);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, [search, categoryFilter, lowStockOnly, page]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { setPage(1); }, [search, categoryFilter, lowStockOnly]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview('');
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditingId(p._id);
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      category: p.category?._id || '',
      price: p.price ?? '',
      cost: p.cost ?? '',
      stock: p.stock ?? '',
      minimumStock: p.minimumStock ?? '',
      description: p.description || '',
    });
    setImageFile(null);
    setImagePreview(p.image ? resolveImageUrl(p.image) : '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) {
      toast.error('Please select a category');
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      if (imageFile) data.append('image', imageFile);

      if (editingId) {
        await api.put(`/products/${editingId}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product updated');
      } else {
        await api.post('/products', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Product created');
      }
      closeModal();
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${p._id}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog, stock levels and pricing"
        actions={<button className="btn btn-primary" onClick={openAddModal}>Add Product</button>}
      />

      <div className="search-bar" style={{ flexWrap: 'wrap' }}>
        <input
          placeholder="Search products by name or SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={e => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="loading">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24 }}>No products found</td></tr>
            ) : products.map(p => (
              <tr key={p._id}>
                <td>
                  {p.image ? (
                    <img
                      src={resolveImageUrl(p.image)}
                      alt={p.name}
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg)' }} />
                  )}
                </td>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.category?.name || '-'}</td>
                <td>${Number(p.price).toFixed(2)}</td>
                <td>${Number(p.cost).toFixed(2)}</td>
                <td>{p.stock}</td>
                <td>
                  {p.stock <= p.minimumStock
                    ? <span className="badge badge-danger">Low Stock</span>
                    : <span className="badge badge-success">In Stock</span>}
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => openEditModal(p)}>Edit</button>
                  <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleDelete(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && products.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button
              className="btn btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: 'var(--text-light)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxHeight: '85vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 16 }}>{editingId ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>SKU</label>
                <input type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                  <option value="">Select category...</option>
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Price</label>
                  <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Cost</label>
                  <input type="number" step="0.01" min="0" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>
                    Stock {editingId && <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>(Adjust via Inventory ledger)</span>}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    disabled={Boolean(editingId)}
                    title={editingId ? 'Direct stock edits are locked to preserve audit trail integrity. Use Inventory Movements or Stock Adjustment.' : ''}
                    style={editingId ? { opacity: 0.7, cursor: 'not-allowed', background: 'var(--bg)' } : {}}
                    required={!editingId}
                  />
                </div>
                <div className="form-group">
                  <label>Minimum Stock</label>
                  <input type="number" min="0" value={form.minimumStock} onChange={e => setForm({ ...form, minimumStock: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Product Image</label>
                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} />
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function resolveImageUrl(imagePath) {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  const normalized = imagePath.replace(/\\/g, '/').replace(/^\/?uploads\/?/, '');
  return `${base}/uploads/${normalized}`;
}