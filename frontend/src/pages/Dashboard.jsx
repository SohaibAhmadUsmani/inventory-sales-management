import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { FiDollarSign, FiTrendingUp, FiBox, FiAlertTriangle, FiUsers, FiClock, FiBarChart2, FiPackage, FiRefreshCw } from 'react-icons/fi';

const COLORS = ['#0d9488', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/dashboard')
      .then(res => setData(res.data?.dashboard || null))
      .catch(err => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const stats = data ? [
    { label: 'Total Sales', value: `$${Number(data.totalSales || 0).toLocaleString()}`, icon: FiDollarSign, color: '#4f46e5' },
    { label: "Today's Sales", value: `$${Number(data.todaySales || 0).toLocaleString()}`, note: `${data.todaySalesCount ?? 0} orders today`, icon: FiTrendingUp, color: '#0d9488' },
    { label: 'Total Products', value: Number(data.totalProducts || 0).toLocaleString(), icon: FiBox, color: '#4f46e5' },
    { label: 'Low Stock', value: Number(data.lowStockProducts || 0).toLocaleString(), icon: FiAlertTriangle, color: (data.lowStockProducts || 0) > 0 ? '#ef4444' : '#22c55e' },
    { label: 'Total Customers', value: Number(data.totalCustomers || 0).toLocaleString(), icon: FiUsers, color: '#8b5cf6' },
    ...(user?.role === 'admin'
      ? [{ label: 'Pending Orders', value: Number(data.pendingOrders || 0).toLocaleString(), icon: FiClock, color: '#f59e0b' }]
      : []),
    { label: 'Monthly Revenue', value: `$${Number(data.monthlyRevenue || 0).toLocaleString()}`, icon: FiBarChart2, color: '#0d9488' },
  ] : [];

  const categoryTotal = data?.revenueByCategory?.reduce((s, c) => s + Number(c.revenue || 0), 0) || 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your sales, inventory and customer activity" />

      {loading && <div className="loading">Loading dashboard...</div>}

      {!loading && (error || !data) && (
        <div className="ui-chart-card" style={{ textAlign: 'center', color: 'var(--danger)' }}>
          <div style={{ marginBottom: 12 }}>{error || 'Failed to load dashboard'}</div>
          <button
            className="btn btn-secondary"
            onClick={fetchDashboard}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FiRefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="ui-stat-grid">
            {stats.map((stat, i) => (
              <div className="ui-stat-card" key={i}>
                <div className="ui-stat-top">
                  <span className="ui-stat-label">{stat.label}</span>
                  <span className="ui-stat-icon" style={{ background: `${stat.color}1a`, color: stat.color }}>
                    <stat.icon size={16} />
                  </span>
                </div>
                <div className="ui-stat-value">{stat.value}</div>
                {stat.note && <div className="ui-stat-note">{stat.note}</div>}
              </div>
            ))}
          </div>

          <div className="ui-chart-row">
            <div className="ui-chart-card">
              <div className="ui-chart-card-head">
                <div>
                  <div className="ui-chart-title">Daily Sales Trend</div>
                  <div className="ui-chart-sub">Revenue collected over the last 30 days</div>
                </div>
                <div className="ui-legend">
                  <span><span className="ui-legend-dot" style={{ background: '#0d9488' }} />Revenue</span>
                </div>
              </div>
              {data.dailySales?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.dailySales}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${v / 1000}k` : v}`} />
                    <Tooltip formatter={(v) => [`$${Number(v || 0).toLocaleString()}`, 'Revenue']} />
                    <Area type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={2.5} fill="url(#revFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="ui-empty">No sales data yet</div>}
            </div>

            <div className="ui-chart-card">
              <div className="ui-chart-card-head">
                <div>
                  <div className="ui-chart-title">Top Selling Products</div>
                  <div className="ui-chart-sub">By quantity sold</div>
                </div>
              </div>
              {data.topProducts?.length > 0 ? (
                <div className="ui-product-list">
                  {data.topProducts.map((p, i) => (
                    <div className="ui-product-row" key={i}>
                      <span className="ui-product-icon" style={{ color: COLORS[i % COLORS.length] }}><FiPackage size={18} /></span>
                      <div className="ui-product-info">
                        <div className="ui-product-name">{p._id}</div>
                        <div className="ui-product-sub">{Number(p.totalQuantity || 0).toLocaleString()} sold</div>
                      </div>
                      <div className="ui-product-value">
                        <div className="amount">${Number(p.totalRevenue || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="ui-empty">No sales data yet</div>}
            </div>
          </div>

          <div className="ui-chart-card">
            <div className="ui-chart-card-head">
              <div>
                <div className="ui-chart-title">Revenue by Category</div>
                <div className="ui-chart-sub">Distribution of revenue across product categories</div>
              </div>
            </div>
            {data.revenueByCategory?.length > 0 ? (
              <div className="ui-category-layout">
                <div style={{ width: 240, maxWidth: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.revenueByCategory} dataKey="revenue" nameKey="_id" innerRadius={65} outerRadius={100} paddingAngle={2}>
                        {data.revenueByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `$${Number(v || 0).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="ui-category-legend">
                  {data.revenueByCategory.map((c, i) => (
                    <div className="ui-category-legend-row" key={i}>
                      <span className="ui-category-legend-label">
                        <span className="ui-legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                        {c._id}
                      </span>
                      <span className="ui-category-legend-pct">
                        {categoryTotal > 0 ? ((Number(c.revenue || 0) / categoryTotal) * 100).toFixed(1) : '0.0'}% &nbsp;·&nbsp; ${Number(c.revenue || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div className="ui-empty">No sales data yet</div>}
          </div>
        </>
      )}
    </>
  );
}
