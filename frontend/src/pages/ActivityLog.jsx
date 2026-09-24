import { useState, useEffect, useCallback } from 'react';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';
import PageHeader from '../components/PageHeader';
import useDebounce from '../hooks/useDebounce';

const ENTITIES = [
  'Product',
  'Category',
  'Inventory',
  'Sale',
  'Purchase',
  'Customer',
  'Supplier',
  'User',
];

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [actionSearch, setActionSearch] = useState('');
  const debouncedAction = useDebounce(actionSearch, 350);
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit };
    if (debouncedAction.trim()) params.action = debouncedAction.trim();
    if (entityFilter) params.entity = entityFilter;

    api.get('/activity-log', { params })
      .then((res) => {
        setLogs(res.data?.logs || []);
        setTotalPages(res.data?.totalPages || 1);
        setTotalCount(res.data?.total ?? (res.data?.logs?.length || 0));
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to load activity logs';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [debouncedAction, entityFilter, page, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle="Audit trail of user actions and system changes across all modules"
        actions={
          <button
            className="btn btn-secondary"
            onClick={fetchLogs}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FiRefreshCw size={14} /> Refresh
          </button>
        }
      />

      <div className="toolbar">
        <div className="search-bar" style={{ marginBottom: 0, flex: 1 }}>
          <FiSearch className="search-icon" />
          <input
            type="text"
            placeholder="Filter by action (e.g. Created, Updated, Deleted, Logged in)..."
            value={actionSearch}
            onChange={(e) => {
              setActionSearch(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: 36, width: '100%' }}
            aria-label="Filter by action"
          />
        </div>
        <select
          className="filter-select"
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by entity"
        >
          <option value="">All Entities</option>
          {ENTITIES.map((ent) => (
            <option key={ent} value={ent}>
              {ent}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="loading">
                  Loading activity logs...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--danger)' }}>
                  <div style={{ marginBottom: 10 }}>{error}</div>
                  <button
                    className="btn btn-secondary"
                    onClick={fetchLogs}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <FiRefreshCw size={14} /> Retry
                  </button>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)' }}>
                  No activity logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500 }}>{log.user?.name || 'System / Unknown'}</span>
                      {log.user?.role && (
                        <span
                          className={`badge ${log.user.role === 'admin' ? 'badge-info' : 'badge-muted'}`}
                          style={{ fontSize: 11, textTransform: 'capitalize' }}
                        >
                          {log.user.role}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info">{log.action}</span>
                  </td>
                  <td>
                    <span className="badge badge-muted">{log.entity}</span>
                  </td>
                  <td>{log.details || '—'}</td>
                </tr>
              ))
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
              Page {page} of {totalPages} ({totalCount.toLocaleString()} logs)
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
    </div>
  );
}
