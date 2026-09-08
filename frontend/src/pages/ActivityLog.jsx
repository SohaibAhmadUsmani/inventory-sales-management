import { useState, useEffect } from 'react';
import api from '../services/api';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/activity-log')
      .then(res => setLogs(res.data.logs))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header"><h1>Activity Log</h1></div>
      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="loading">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>No activity logs</td></tr>
            ) : logs.map(log => (
              <tr key={log._id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.user?.name || '-'}</td>
                <td><span className="badge badge-info">{log.action}</span></td>
                <td>{log.entity}</td>
                <td>{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
