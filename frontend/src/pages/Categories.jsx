import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  const fetchCategories = () => {
    setLoading(true);
    api.get('/categories')
      .then(res => setCategories(res.data.categories))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories', { name });
      toast.success('Category created');
      setName('');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) {
      toast.error('Failed to delete category');
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Categories</h1></div>

      <div className="card">
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input placeholder="New category name..." value={name} onChange={e => setName(e.target.value)} required style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }} />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>

        <table>
          <thead><tr><th>Name</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="2" className="loading">Loading...</td></tr>
            ) : categories.map(c => (
              <tr key={c._id}>
                <td>{c.name}</td>
                <td><button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleDelete(c._id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
