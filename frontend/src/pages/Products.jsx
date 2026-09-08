import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', category: '', price: '', cost: '', stock: '', minimumStock: '', description: '' });

  const fetchProducts = () => {
    setLoading(true);
    api.get('/products', { params: { search } })
      .then(res => setProducts(res.data.products))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/products', form);
      toast.success('Product created');
      setShowModal(false);
      setForm({ name: '', sku: '', category: '', price: '', cost: '', stock: '', minimumStock: '', description: '' });
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create product');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Product</button>
      </div>

      <div className="search-bar">
        <input placeholder="Search products by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="loading">Loading...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24 }}>No products found</td></tr>
            ) : products.map(p => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.category?.name || '-'}</td>
                <td>${p.price}</td>
                <td>${p.cost}</td>
                <td>{p.stock}</td>
                <td>{p.stock <= p.minimumStock ? <span className="badge badge-danger">Low Stock</span> : <span className="badge badge-success">In Stock</span>}</td>
                <td><button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: 16 }}>Add Product</h2>
            <form onSubmit={handleSubmit}>
              {['name', 'sku', 'price', 'cost', 'stock', 'minimumStock'].map(field => (
                <div className="form-group" key={field}>
                  <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input type={field === 'name' || field === 'sku' ? 'text' : 'number'} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} required />
                </div>
              ))}
              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
