import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplierId: '', items: [{ productId: '', quantity: '', cost: '' }], purchaseDate: '', paymentStatus: 'pending' });

  const fetchPurchases = () => {
    setLoading(true);
    api.get('/purchases')
      .then(res => setPurchases(res.data.purchases))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPurchases(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const items = form.items.map(i => ({ ...i, productId: i.productId, quantity: Number(i.quantity), cost: Number(i.cost) }));
      await api.post('/purchases', { ...form, items });
      toast.success('Purchase order created');
      setShowModal(false);
      fetchPurchases();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Purchases</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create Purchase Order</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Order #</th><th>Supplier</th><th>Date</th><th>Total Cost</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="loading">Loading...</td></tr>
            ) : purchases.map(p => (
              <tr key={p._id}>
                <td>{p.orderNumber}</td>
                <td>{p.supplier?.name || '-'}</td>
                <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                <td>${p.totalCost?.toFixed(2)}</td>
                <td><span className={`badge badge-${p.paymentStatus === 'paid' ? 'success' : 'warning'}`}>{p.paymentStatus}</span></td>
                <td><span className={`badge badge-${p.status === 'received' ? 'success' : 'info'}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 500 }}>
            <h2 style={{ marginBottom: 16 }}>Create Purchase Order</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Supplier ID</label>
                <input value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Purchase Date</label>
                <input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Payment Status</label>
                <select value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
