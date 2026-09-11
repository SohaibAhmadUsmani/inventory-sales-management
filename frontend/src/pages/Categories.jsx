import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchCategories = () => {
    setLoading(true);
    api.get('/categories')
      .then(res => setCategories(res.data.categories))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/categories', { name, description });
      toast.success('Category created');
      setName('');
      setDescription('');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    }
  };

  const startEdit = (c) => {
    setEditingId(c._id);
    setEditName(c.name);
    setEditDescription(c.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEdit = async (id) => {
    try {
      await api.put(`/categories/${id}`, { name: editName, description: editDescription });
      toast.success('Category updated');
      cancelEdit();
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update category');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    }
  };

  return (
    <div>
      <div className="page-header"><h1>Categories</h1></div>

      <div className="card">
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            placeholder="New category name..."
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{ flex: 1, minWidth: 160, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ flex: 2, minWidth: 200, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
          />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>

        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="3" className="loading">Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan="3" style={{ textAlign: 'center', padding: 24 }}>No categories yet</td></tr>
            ) : categories.map(c => (
              <tr key={c._id}>
                {editingId === c._id ? (
                  <>
                    <td>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, width: '100%' }} />
                    </td>
                    <td>
                      <input value={editDescription} onChange={e => setEditDescription(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, width: '100%' }} />
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => saveEdit(c._id)}>Save</button>
                      <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={cancelEdit}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{c.name}</td>
                    <td>{c.description || '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => startEdit(c)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => handleDelete(c._id)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
