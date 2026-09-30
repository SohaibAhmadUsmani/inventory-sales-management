import { useState, useEffect, useCallback } from 'react';
import {
  FiSearch,
  FiUserPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiUsers,
  FiUserCheck,
  FiShield,
  FiUser,
  FiMail,
  FiPhone,
  FiCheckCircle,
  FiSlash,
  FiRefreshCw,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import useDebounce from '../hooks/useDebounce';
import PageHeader from '../components/PageHeader';

const EMPTY_ADD_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'staff',
};

const EMPTY_EDIT_FORM = {
  name: '',
  email: '',
  phone: '',
  role: 'staff',
  isActive: true,
  password: '',
};

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const currentUserId = String(currentUser?._id || currentUser?.id || '');

  const [users, setUsers] = useState([]);
  const [allUsersForStats, setAllUsersForStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Add User Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addingSaving, setAddingSaving] = useState(false);

  // Edit User Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [loadingEditUser, setLoadingEditUser] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Row action loading state
  const [actionUserId, setActionUserId] = useState(null);

  const fetchStatsUsers = useCallback(() => {
    api
      .get('/users', { params: { limit: 500 } })
      .then((res) => {
        setAllUsersForStats(res.data?.users || []);
      })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit: 20 };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (roleFilter) params.role = roleFilter;

    api
      .get('/users', { params })
      .then((res) => {
        const list = res.data?.users || [];
        setUsers(list);
        setTotalPages(res.data?.totalPages || 1);
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to load users';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, roleFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchStatsUsers();
  }, [fetchStatsUsers]);

  const statsSource = allUsersForStats.length > 0 ? allUsersForStats : users;
  const totalUsersCount = statsSource.length;
  const activeUsersCount = statsSource.filter((u) => u.isActive !== false).length;
  const adminUsersCount = statsSource.filter((u) => u.role === 'admin').length;
  const staffUsersCount = statsSource.filter((u) => u.role === 'staff').length;

  const openAddModal = () => {
    setAddForm(EMPTY_ADD_FORM);
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password) {
      return toast.warning('Name, email, and password are required');
    }
    if (addForm.password.length < 6) {
      return toast.warning('Password must be at least 6 characters');
    }
    setAddingSaving(true);
    try {
      await api.post('/auth/register', {
        name: addForm.name.trim(),
        email: addForm.email.trim().toLowerCase(),
        password: addForm.password,
        phone: addForm.phone.trim(),
        role: addForm.role,
      });
      toast.success('User account created successfully');
      setShowAddModal(false);
      fetchUsers();
      fetchStatsUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setAddingSaving(false);
    }
  };

  const openEditModal = async (u) => {
    setEditingUserId(u._id);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'staff',
      isActive: u.isActive !== false,
      password: '',
    });
    setShowEditModal(true);
    setLoadingEditUser(true);
    try {
      const res = await api.get(`/users/${u._id}`);
      const fresh = res.data?.user;
      if (fresh) {
        setEditForm({
          name: fresh.name || '',
          email: fresh.email || '',
          phone: fresh.phone || '',
          role: fresh.role || 'staff',
          isActive: fresh.isActive !== false,
          password: '',
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not refresh user details');
    } finally {
      setLoadingEditUser(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.email.trim()) {
      return toast.warning('Name and email are required');
    }
    if (editForm.password && editForm.password.length < 6) {
      return toast.warning('New password must be at least 6 characters');
    }

    const isSelf = String(editingUserId) === currentUserId;
    if (isSelf && editForm.role !== 'admin') {
      return toast.error('You cannot demote your own admin role');
    }
    if (isSelf && !editForm.isActive) {
      return toast.error('You cannot deactivate your own account');
    }

    setEditSaving(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }

      await api.put(`/users/${editingUserId}`, payload);
      toast.success('User updated successfully');
      setShowEditModal(false);
      fetchUsers();
      fetchStatsUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleStatus = async (u) => {
    const isSelf = String(u._id) === currentUserId;
    if (isSelf) {
      return toast.error('You cannot deactivate your own account');
    }
    const nextActive = u.isActive === false;
    const actionLabel = nextActive ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${u.name}?`)) return;

    setActionUserId(u._id);
    try {
      await api.put(`/users/${u._id}`, {
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        role: u.role,
        isActive: nextActive,
      });
      toast.success(`User ${nextActive ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
      fetchStatsUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${actionLabel} user`);
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteUser = async (u) => {
    const isSelf = String(u._id) === currentUserId;
    if (isSelf) {
      return toast.error('You cannot delete your own account');
    }
    if (!window.confirm(`Are you sure you want to delete/deactivate user "${u.name}"?`)) return;

    setActionUserId(u._id);
    try {
      await api.delete(`/users/${u._id}`);
      toast.success('User removed successfully');
      fetchUsers();
      fetchStatsUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionUserId(null);
    }
  };

  const editingIsSelf = String(editingUserId) === currentUserId;

  const kpiCards = [
    { label: 'Total Users', value: totalUsersCount, icon: FiUsers, color: '#4f46e5' },
    { label: 'Active Users', value: activeUsersCount, icon: FiUserCheck, color: '#22c55e' },
    { label: 'Admins', value: adminUsersCount, icon: FiShield, color: '#8b5cf6' },
    { label: 'Staff Members', value: staffUsersCount, icon: FiUser, color: '#0d9488' },
  ];

  return (
    <div>
      <PageHeader
        title="Users & Staff Management"
        subtitle="Manage administrator and staff accounts, roles, and access permissions"
        actions={
          <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FiUserPlus size={16} /> Add User / Staff
          </button>
        }
      />

      <div className="ui-stat-grid">
        {kpiCards.map((card, idx) => (
          <div className="ui-stat-card" key={idx}>
            <div className="ui-stat-top">
              <span className="ui-stat-label">{card.label}</span>
              <span className="ui-stat-icon" style={{ background: `${card.color}1a`, color: card.color }}>
                <card.icon size={16} />
              </span>
            </div>
            <div className="ui-stat-value">{Number(card.value || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <div className="search-bar" style={{ marginBottom: 0, flex: 1 }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: 36, width: '100%' }}
            aria-label="Search users by name or email"
          />
        </div>
        <select
          className="filter-select"
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by role"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="loading">
                  Loading users...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--danger)' }}>
                  <div style={{ marginBottom: 10 }}>{error}</div>
                  <button className="btn btn-secondary" onClick={fetchUsers} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <FiRefreshCw size={14} /> Retry
                  </button>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  No users match your search criteria.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = String(u._id) === currentUserId;
                const isActive = u.isActive !== false;
                const isBusy = actionUserId === u._id;

                return (
                  <tr key={u._id}>
                    <td>
                      <div className="profile-cell">
                        <span className="avatar">{initials(u.name)}</span>
                        <div>
                          <div className="profile-name">
                            {u.name}{' '}
                            {isSelf && (
                              <span
                                className="badge badge-info"
                                style={{ fontSize: 10, padding: '2px 6px', marginLeft: 4 }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <div className="profile-meta">{String(u._id || '').slice(-6).toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <FiMail size={13} style={{ color: 'var(--text-light)' }} />
                        {u.email}
                      </span>
                    </td>
                    <td>
                      {u.phone ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <FiPhone size={13} style={{ color: 'var(--text-light)' }} />
                          {u.phone}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-muted'}`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {u.role || 'staff'}
                      </span>
                    </td>
                    <td>
                      {isActive ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                    <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          title="Edit User"
                          onClick={() => openEditModal(u)}
                          disabled={isBusy}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          className="icon-btn"
                          title={
                            isSelf
                              ? 'You cannot deactivate your own account'
                              : isActive
                              ? 'Deactivate User'
                              : 'Activate User'
                          }
                          onClick={() => handleToggleStatus(u)}
                          disabled={isSelf || isBusy}
                          style={{
                            opacity: isSelf ? 0.4 : 1,
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                            color: isActive ? 'var(--warning)' : 'var(--success)',
                          }}
                        >
                          {isActive ? <FiSlash /> : <FiCheckCircle />}
                        </button>
                        <button
                          className="icon-btn icon-btn-danger"
                          title={isSelf ? 'You cannot delete your own account' : 'Delete User'}
                          onClick={() => handleDeleteUser(u)}
                          disabled={isSelf || isBusy}
                          style={{
                            opacity: isSelf ? 0.4 : 1,
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Add User / Staff Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !addingSaving && setShowAddModal(false)}>
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="add-user-title">Add User / Staff</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowAddModal(false)}
                disabled={addingSaving}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label htmlFor="add-user-name">Full Name *</label>
                <input
                  id="add-user-name"
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-user-email">Email Address *</label>
                <input
                  id="add-user-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="jane@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-user-password">Password * (min 6 chars)</label>
                <input
                  id="add-user-password"
                  type="password"
                  minLength={6}
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="Enter initial password"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-user-phone">Phone</label>
                <input
                  id="add-user-phone"
                  type="text"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+1 555 0100"
                />
              </div>
              <div className="form-group">
                <label htmlFor="add-user-role">Role *</label>
                <select
                  id="add-user-role"
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={addingSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addingSaving}>
                  {addingSaving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => !editSaving && setShowEditModal(false)}>
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="edit-user-title">Edit User{editingIsSelf ? ' (Your Account)' : ''}</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowEditModal(false)}
                disabled={editSaving}
              >
                <FiX />
              </button>
            </div>
            {loadingEditUser ? (
              <div className="loading" style={{ height: 120 }}>
                Loading user details...
              </div>
            ) : (
              <form onSubmit={handleEditSubmit}>
                <div className="form-group">
                  <label htmlFor="edit-user-name">Full Name *</label>
                  <input
                    id="edit-user-name"
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-user-email">Email Address *</label>
                  <input
                    id="edit-user-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-user-phone">Phone</label>
                  <input
                    id="edit-user-phone"
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-user-role">Role</label>
                  <select
                    id="edit-user-role"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    disabled={editingIsSelf}
                    title={editingIsSelf ? 'You cannot demote your own admin role' : ''}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  {editingIsSelf && (
                    <small style={{ color: 'var(--text-light)', fontSize: 12 }}>
                      Role changes are disabled for your own account.
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="edit-user-status">Account Status</label>
                  <select
                    id="edit-user-status"
                    value={editForm.isActive ? 'active' : 'inactive'}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isActive: e.target.value === 'active' })
                    }
                    disabled={editingIsSelf}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="edit-user-password">New Password (optional)</label>
                  <input
                    id="edit-user-password"
                    type="password"
                    minLength={6}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowEditModal(false)}
                    disabled={editSaving}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={editSaving}>
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
