import { useState, useEffect, useCallback } from 'react';
import { FiTrash2, FiCheck, FiCheckCircle, FiBell, FiRefreshCw } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';
import PageHeader from '../components/PageHeader';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/notifications')
      .then((res) => {
        setNotifications(res.data?.notifications || []);
        setUnreadCount(res.data?.unreadCount ?? 0);
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to load notifications';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id) => {
    setBusyId(id);
    try {
      await api.put(`/notifications/${id}/read`);
      window.dispatchEvent(new Event('notifications-updated'));
      fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark notification as read');
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.put('/notifications/read-all');
      toast.success('All marked as read');
      window.dispatchEvent(new Event('notifications-updated'));
      fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark all notifications as read');
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id) => {
    setBusyId(id);
    try {
      await api.delete(`/notifications/${id}`);
      toast.success('Notification deleted');
      window.dispatchEvent(new Event('notifications-updated'));
      fetchNotifications();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete notification');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            Notifications
            {unreadCount > 0 && (
              <span className="badge badge-danger" style={{ fontSize: 13 }}>
                {unreadCount} unread
              </span>
            )}
          </span>
        }
        subtitle="System alerts, low-stock warnings, and operational updates"
        actions={
          unreadCount > 0 ? (
            <button
              className="btn btn-secondary"
              onClick={markAllRead}
              disabled={markingAll}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FiCheckCircle size={15} />
              {markingAll ? 'Marking...' : 'Mark All Read'}
            </button>
          ) : null
        }
      />

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading">Loading notifications...</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--danger)' }}>
            <div style={{ marginBottom: 12 }}>{error}</div>
            <button
              className="btn btn-secondary"
              onClick={fetchNotifications}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FiRefreshCw size={14} /> Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
            <FiBell size={28} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p>No notifications</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n._id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                background: n.isRead ? 'transparent' : '#eff6ff',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {!n.isRead && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontWeight: 600 }}>{n.title}</span>
                  {n.type && (
                    <span className="badge badge-muted" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                      {String(n.type).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 4 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                </div>
              </div>
              <div className="row-actions" style={{ flexShrink: 0 }}>
                {!n.isRead && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => markAsRead(n._id)}
                    disabled={busyId === n._id}
                    title="Mark as read"
                  >
                    <FiCheck size={14} /> Mark Read
                  </button>
                )}
                <button
                  className="icon-btn icon-btn-danger"
                  onClick={() => deleteNotification(n._id)}
                  disabled={busyId === n._id}
                  title="Delete notification"
                  aria-label="Delete notification"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
