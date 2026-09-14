import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', phone: '', email: '', address: '' });

  const fetchSuppliers = () => {
    setLoading(true);
    api.get('/suppliers', { params: { search } })
      .then(res => setSuppliers(res.data.suppliers))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSuppliers(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', form);
      toast.success('Supplier created');
      setShowModal(false);
      setForm({ name: '', company: '', phone: '', email: '', address: '' });
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDeleteSupplier = async (supplierId) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) {
      return;
    }

    try {
      await api.delete(`/suppliers/${supplierId}`);
      toast.success('Supplier deleted');
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete supplier');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Suppliers</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Add Supplier</button>
      </div>
      <div className="search-bar">
        <input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Company</th><th>Phone</th><th>Email</th><th>Total Purchases</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="loading">Loading...</td></tr>
            ) : suppliers.map(s => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.company}</td>
                <td>{s.phone}</td>
                <td>{s.email}</td>
                <td>${s.totalPurchases?.toFixed(2)}</td>
                <td>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => handleDeleteSupplier(s._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 400 }}>
            <h2 style={{ marginBottom: 16 }}>Add Supplier</h2>
            <form onSubmit={handleSubmit}>
              {['name', 'company', 'phone', 'email', 'address'].map(field => (
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
