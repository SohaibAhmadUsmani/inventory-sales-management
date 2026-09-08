import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/sales', { params: { search, paymentMethod } })
      .then(res => setSales(res.data.sales))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, paymentMethod]);

  return (
    <div>
      <div className="page-header"><h1>Sales History</h1></div>
      <div className="search-bar">
        <input placeholder="Search by invoice number..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
          <option value="">All Payment Methods</option>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="online">Online</option>
        </select>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading">Loading...</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24 }}>No sales found</td></tr>
            ) : sales.map(s => (
              <tr key={s._id}>
                <td>{s.invoiceNumber}</td>
                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                <td>{s.customer?.name || 'Walk-in'}</td>
                <td>{s.items.length}</td>
                <td>${s.total.toFixed(2)}</td>
                <td><span className="badge badge-info">{s.paymentMethod}</span></td>
                <td><span className={`badge badge-${s.status === 'completed' ? 'success' : 'warning'}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
