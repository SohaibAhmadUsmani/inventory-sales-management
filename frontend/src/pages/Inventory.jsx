import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Inventory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ productId: '', quantity: '', notes: '' });

  const fetchInventory = () => {
    setLoading(true);
    api.get('/inventory', { params: { type } })
      .then(res => setRecords(res.data.records))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInventory(); }, [type]);

  const handleStockIn = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/stock-in', form);
      toast.success('Stock added');
      setShowModal(false);
      setForm({ productId: '', quantity: '', notes: '' });
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Inventory</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Stock In</button>
      </div>

      <div className="search-bar">
        <select value={type} onChange={e => setType(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <option value="">All Types</option>
          <option value="stock_in">Stock In</option>
          <option value="stock_out">Stock Out</option>
          <option value="damaged">Damaged</option>
          <option value="adjustment">Adjustment</option>
          <option value="sale">Sale</option>
          <option value="purchase">Purchase</option>
        </select>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Previous</th><th>Current</th><th>By</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24 }}>No records</td></tr>
            ) : records.map(r => (
              <tr key={r._id}>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>{r.product?.name || '-'}</td>
                <td><span className={`badge badge-${r.type === 'damaged' ? 'danger' : r.type === 'sale' ? 'warning' : 'info'}`}>{r.type}</span></td>
                <td>{r.quantity}</td>
                <td>{r.previousStock}</td>
                <td>{r.currentStock}</td>
                <td>{r.performedBy?.name || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 400 }}>
            <h2 style={{ marginBottom: 16 }}>Stock In</h2>
            <form onSubmit={handleStockIn}>
              <div className="form-group">
                <label>Product ID</label>
                <input value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Quantity</label>
                <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
