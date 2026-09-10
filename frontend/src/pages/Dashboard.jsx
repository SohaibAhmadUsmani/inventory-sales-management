import { useState, useEffect } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.get('/dashboard')
      .then(res => setData(res.data.dashboard))
      .catch(err => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const COLORS = ['#4f46e5', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  if (loading) return <div className="loading">Loading dashboard...</div>;

  if (error || !data) {
    return (
      <div>
        <div className="page-header"><h1>Dashboard</h1></div>
        <div className="card" style={{ textAlign: 'center', color: 'var(--danger)' }}>
          {error || 'Failed to load dashboard'}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h1>Dashboard</h1></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Sales', value: `$${data.totalSales?.toLocaleString()}` },
          { label: "Today's Sales", value: `$${data.todaySales?.toLocaleString()}` },
          { label: 'Total Products', value: data.totalProducts },
          { label: 'Low Stock', value: data.lowStockProducts, color: data.lowStockProducts > 0 ? 'var(--danger)' : 'inherit' },
          { label: 'Total Customers', value: data.totalCustomers },
          { label: 'Pending Orders', value: data.pendingOrders },
          { label: 'Monthly Revenue', value: `$${data.monthlyRevenue?.toLocaleString()}` },
        ].map((stat, i) => (
          <div className="card" key={i}>
            <div style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Daily Sales (Last 30 Days)</h3>
          {data.dailySales?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.dailySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--text-light)' }}>No sales data yet</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Top Selling Products</h3>
          {data.topProducts?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.topProducts} dataKey="totalQuantity" nameKey="_id" cx="50%" cy="50%" outerRadius={100} label={({ _id }) => _id}>
                  {data.topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--text-light)' }}>No sales data yet</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Revenue by Category</h3>
        {data.revenueByCategory?.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.revenueByCategory} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="_id" width={140} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {data.revenueByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: 'var(--text-light)' }}>No sales data yet</p>
        )}
      </div>
    </div>
  );
}
