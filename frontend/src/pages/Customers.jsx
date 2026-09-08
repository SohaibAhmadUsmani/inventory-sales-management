import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });

  const fetchCustomers = () => {
    setLoading(true);
    api.get('/customers', { params: { search } })
      .then(res => setCustomers(res.data.customers))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customers', form);
      toast.success('Customer created');
      setShowModal(false);
      setForm({ name: '', phone: '', email: '', address: '' });
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Customer</button>
      </div>
      <div className="search-bar">
        <input placeholder="Search by name, phone, or email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Orders</th><th>Total Spending</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="loading">Loading...</td></tr>
            ) : customers.map(c => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>{c.email}</td>
                <td>{c.totalOrders}</td>
                <td>${c.totalSpending?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 400 }}>
            <h2 style={{ marginBottom: 16 }}>Add Customer</h2>
            <form onSubmit={handleSubmit}>
              {['name', 'phone', 'email', 'address'].map(field => (
                <div className="form-group" key={field}>
                  <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} required={field === 'name'} />
                </div>
              ))}
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
