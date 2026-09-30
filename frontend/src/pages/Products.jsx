import PageHeader from '../components/PageHeader';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import api from '../services/api';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
  name: '',
  sku: '',
  category: '',
  supplier: '',
  price: '',
  cost: '',
  stock: '',
  minimumStock: '',
  description: '',
};

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 350);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);

  const urlSearch = searchParams.get('search') || '';
  useEffect(() => {
    setSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const fetchCategories = useCallback(() => {
    api.get('/categories')
      .then(res => setCategories(res.data?.categories || []))
      .catch(() => toast.error('Failed to load categories'));
  }, []);

  const fetchSuppliers = useCallback(() => {
    api.get('/suppliers', { params: { limit: 200 } })
      .then(res => setSuppliers(res.data?.suppliers || []))
      .catch(() => toast.error('Failed to load suppliers'));
  }, []);

  const fetchProducts = useCallback((signal) => {
    setLoading(true);
    api.get('/products', {
      params: {
        search: debouncedSearch.trim() || undefined,
        category: categoryFilter || undefined,
        supplier: supplierFilter || undefined,
        minPrice: minPrice !== '' ? minPrice : undefined,
        maxPrice: maxPrice !== '' ? maxPrice : undefined,
        lowStock: lowStockOnly ? 'true' : undefined,
        page,
        limit: 10,
      },
      signal,
    })
      .then(res => {
        setProducts(res.data?.products || []);
        setTotalPages(res.data?.totalPages || 1);
      })
      .catch(err => {
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        toast.error('Failed to load products');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [debouncedSearch, categoryFilter, supplierFilter, minPrice, maxPrice, lowStockOnly, page]);

  useEffect(() => {
    fetchCategories();
    fetchSuppliers();
  }, [fetchCategories, fetchSuppliers]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    return () => controller.abort();
  }, [fetchProducts]);

  const closeModal = useCallback(() => {
    if (saving) return;
    setShowModal(false);
    setEditingId(null);
  }, [saving]);

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, closeModal]);

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
      category: p.category?._id || p.category || '',
      supplier: p.supplier?._id || p.supplier || '',
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

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    const trimmedSku = form.sku.trim();
    if (!trimmedName || !trimmedSku) {
      toast.error('Product name and SKU are required');
      return;
    }
    if (!form.category) {
      toast.error('Please select a category');
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (editingId && key === 'stock') return;
        if (key === 'name') {
          data.append(key, trimmedName);
        } else if (key === 'sku') {
          data.append(key, trimmedSku);
        } else {
          data.append(key, value);
        }
      });
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
      setShowModal(false);
      setEditingId(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (p.stock > 0) {
      toast.error('Cannot delete product with existing stock');
      return;
    }
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${p._id}`);
      toast.success('Product deleted');
      if (products.length === 1 && page > 1) {
        setPage(prev => Math.max(1, prev - 1));
      } else {
        fetchProducts();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const colCount = isAdmin ? 10 : 9;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog, stock levels and pricing"
        actions={isAdmin ? <button className="btn btn-primary" onClick={openAddModal}>Add Product</button> : null}
      />

      <div className="search-bar" style={{ flexWrap: 'wrap' }}>
        <input
          placeholder="Search products by name or SKU..."
          aria-label="Search products by name or SKU"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={e => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter by supplier"
          value={supplierFilter}
          onChange={e => {
            setSupplierFilter(e.target.value);
            setPage(1);
          }}
          style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Min Price"
          aria-label="Minimum price filter"
          value={minPrice}
          onChange={e => {
            setMinPrice(e.target.value);
            setPage(1);
          }}
          style={{ width: 110, flex: '0 0 auto', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Max Price"
          aria-label="Maximum price filter"
          value={maxPrice}
          onChange={e => {
            setMaxPrice(e.target.value);
            setPage(1);
          }}
          style={{ width: 110, flex: '0 0 auto', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={e => {
              setLowStockOnly(e.target.checked);
              setPage(1);
            }}
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
              <th>Supplier</th>
              <th>Price</th>
              <th>Cost</th>
              <th>Stock</th>
              <th>Status</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} className="loading">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 24 }}>No products found</td></tr>
            ) : products.map(p => (
              <tr key={p._id}>
                <td>
                  {p.image ? (
                    <img
                      src={resolveImageUrl(p.image)}
                      alt={p.name}
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }}
                      onError={e => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg)' }} />
                  )}
                </td>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.category?.name || '-'}</td>
                <td>{p.supplier?.name || '—'}</td>
                <td>${Number(p.price || 0).toFixed(2)}</td>
                <td>${Number(p.cost || 0).toFixed(2)}</td>
                <td>{p.stock}</td>
                <td>
                  {p.stock <= p.minimumStock
                    ? <span className="badge badge-danger">Low Stock</span>
                    : <span className="badge badge-success">In Stock</span>}
                </td>
                {isAdmin && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => openEditModal(p)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => handleDelete(p)}
                      disabled={p.stock > 0}
                      title={p.stock > 0 ? 'Cannot delete product with existing stock' : 'Delete product'}
                    >
                      Delete
                    </button>
                  </td>
                )}
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
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 16 }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            onClick={e => e.stopPropagation()}
            style={{ width: 500, maxWidth: '100%', maxHeight: '85vh', overflow: 'auto' }}
          >
            <h2 id="product-modal-title" style={{ marginBottom: 16 }}>{editingId ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="prod-name">Name</label>
                <input id="prod-name" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label htmlFor="prod-sku">SKU</label>
                <input id="prod-sku" type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label htmlFor="prod-category">Category</label>
                  <select id="prod-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} required>
                    <option value="">Select category...</option>
                    {categories.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="prod-supplier">Supplier (Optional)</label>
                  <select id="prod-supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
                    <option value="">No supplier assigned</option>
                    {suppliers.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.name}{s.company ? ` (${s.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label htmlFor="prod-price">Price</label>
                  <input id="prod-price" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label htmlFor="prod-cost">Cost</label>
                  <input id="prod-cost" type="number" step="0.01" min="0" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label htmlFor="prod-stock">
                    Stock {editingId && <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 400 }}>(Adjust via Inventory ledger)</span>}
                  </label>
                  <input
                    id="prod-stock"
                    type="number"
                    step="1"
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
                  <label htmlFor="prod-min-stock">Minimum Stock</label>
                  <input id="prod-min-stock" type="number" step="1" min="0" value={form.minimumStock} onChange={e => setForm({ ...form, minimumStock: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="prod-description">Description</label>
                <textarea id="prod-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="prod-image">Product Image</label>
                <input id="prod-image" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageChange} />
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginTop: 8 }}
                    onError={e => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
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
  if (/^(https?:|blob:|data:)/i.test(imagePath)) return imagePath;
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  const normalized = String(imagePath).replace(/\\/g, '/').replace(/^\/?uploads\/?/, '');
  return `${base}/uploads/${normalized}`;
}