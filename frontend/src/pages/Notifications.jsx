import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    api.get('/notifications')
      .then(res => { setNotifications(res.data.notifications); setUnreadCount(res.data.unreadCount); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAsRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    toast.success('All marked as read');
    fetchNotifications();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Notifications {unreadCount > 0 && <span className="badge badge-danger" style={{ marginLeft: 8 }}>{unreadCount}</span>}</h1>
        {unreadCount > 0 && <button className="btn btn-secondary" onClick={markAllRead}>Mark All Read</button>}
      </div>
      <div className="card">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : notifications.length === 0 ? (
          <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-light)' }}>No notifications</p>
        ) : notifications.map(n => (
          <div key={n._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: n.isRead ? 'transparent' : '#eff6ff' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-light)' }}>{n.message}</div>
              <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            {!n.isRead && <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => markAsRead(n._id)}>Mark Read</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
