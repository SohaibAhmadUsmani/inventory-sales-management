import { useState } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = () => {
    setLoading(true);
    const params = { startDate, endDate };
    api.get(`/reports/${activeTab}`, { params })
      .then(res => setReportData(res.data))
      .catch(err => toast.error('Failed to fetch report'))
      .finally(() => setLoading(false));
  };

  const tabs = ['sales', 'products', 'inventory', 'profit', 'customers', 'suppliers'];

  return (
    <div>
      <div className="page-header"><h1>Reports</h1></div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {tabs.map(tab => (
            <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setActiveTab(tab); setReportData(null); }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }} />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }} />
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>{loading ? 'Loading...' : 'Generate'}</button>
        </div>
      </div>

      {reportData && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report</h3>
          {reportData.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
              {Object.entries(reportData.summary).map(([key, val]) => (
                <div key={key} style={{ padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{typeof val === 'number' ? val.toLocaleString() : val}</div>
                </div>
              ))}
            </div>
          )}
          <pre style={{ fontSize: 12, maxHeight: 400, overflow: 'auto', background: 'var(--bg)', padding: 16, borderRadius: 8 }}>
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
