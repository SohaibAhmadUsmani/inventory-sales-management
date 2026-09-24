import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';

export default function Categories() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchCategories = () => {
    setLoading(true);
    api.get('/categories')
      .then(res => setCategories(res.data?.categories || []))
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Category name cannot be empty');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/categories', { name: trimmedName, description: description.trim() });
      toast.success('Category created');
      setName('');
      setDescription('');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (c) => {
    setEditingId(c._id);
    setEditName(c.name || '');
    setEditDescription(c.description || '');
  };

  const cancelEdit = () => {
    if (savingId) return;
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEdit = async (id) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('Category name cannot be empty');
      return;
    }
    setSavingId(id);
    try {
      await api.put(`/categories/${id}`, { name: trimmedName, description: editDescription.trim() });
      toast.success('Category updated');
      setEditingId(null);
      setEditName('');
      setEditDescription('');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update category');
    } finally {
      setSavingId(null);
    }
  };

  const handleEditKeyDown = (e, id) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const colCount = isAdmin ? 3 : 2;

  return (
    <div>
      <PageHeader title="Categories" subtitle="Organize your products into categories" />

      <div className="card">
        {isAdmin && (
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              placeholder="New category name..."
              aria-label="New category name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{ flex: 1, minWidth: 160, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <input
              placeholder="Description (optional)"
              aria-label="New category description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ flex: 2, minWidth: 200, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add'}
            </button>
          </form>
        )}

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} className="loading">Loading...</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 24 }}>No categories yet</td></tr>
            ) : categories.map(c => (
              <tr key={c._id}>
                {isAdmin && editingId === c._id ? (
                  <>
                    <td>
                      <input
                        aria-label={`Edit name for ${c.name}`}
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => handleEditKeyDown(e, c._id)}
                        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, width: '100%' }}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Edit description for ${c.name}`}
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        onKeyDown={e => handleEditKeyDown(e, c._id)}
                        style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, width: '100%' }}
                      />
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => saveEdit(c._id)}
                        disabled={savingId === c._id}
                      >
                        {savingId === c._id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={cancelEdit}
                        disabled={savingId === c._id}
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{c.name}</td>
                    <td>{c.description || '-'}</td>
                    {isAdmin && (
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => startEdit(c)}
                          disabled={deletingId === c._id}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleDelete(c._id)}
                          disabled={deletingId === c._id}
                        >
                          {deletingId === c._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    )}
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