import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fetchStats } from '../lib/api';

function formatRevenue(v) {
  if (!v) return '$0';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatMonth(ym) {
  if (!ym) return '';
  const [year, month] = ym.split('-');
  const d = new Date(Number(year), Number(month) - 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5">
      <p className="text-sm text-gray-500 mb-3">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function EntityBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct}% of total entities</p>
    </div>
  );
}


function SavedGraphsSection({ onRestoreGraph }) {
  const [savedGraphs, setSavedGraphs] = useState([]);

  useEffect(() => {
    const raw = localStorage.getItem('dodge_ai_saved_graphs');
    setSavedGraphs(raw ? JSON.parse(raw) : []);
  }, []);

  function handleDelete(id) {
    const updated = savedGraphs.filter(g => g.id !== id);
    setSavedGraphs(updated);
    localStorage.setItem('dodge_ai_saved_graphs', JSON.stringify(updated));
  }

  if (savedGraphs.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Saved Graphs</p>
        <p className="text-xs text-gray-400">{savedGraphs.length} saved</p>
      </div>
      {savedGraphs.map((g) => (
        <div key={g.id} className="px-5 py-4 border-b border-gray-50 last:border-0 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{g.query}</p>
            <p className="text-xs text-gray-400 mt-0.5">{g.nodeCount} nodes · {formatDate(g.savedAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onRestoreGraph?.(new Set(g.highlightedIds), g.query)}
              className="text-xs text-blue-600 hover:text-blue-500 font-medium"
            >
              View on graph →
            </button>
            <button
              onClick={() => handleDelete(g.id)}
              className="text-xs text-gray-400 hover:text-red-500"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SavedChartsSection() {
  const [savedCharts, setSavedCharts] = useState([]);

  useEffect(() => {
    const raw = localStorage.getItem('dodge_ai_saved_charts');
    setSavedCharts(raw ? JSON.parse(raw) : []);
  }, []);

  function handleDelete(id) {
    const updated = savedCharts.filter(c => c.id !== id);
    setSavedCharts(updated);
    localStorage.setItem('dodge_ai_saved_charts', JSON.stringify(updated));
  }

  if (savedCharts.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Saved Charts</p>
        <p className="text-xs text-gray-400">{savedCharts.length} saved</p>
      </div>
      <div className="divide-y divide-gray-50">
        {savedCharts.map((c) => (
          <div key={c.id} className="px-5 py-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{c.query}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.savedAt)}</p>
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="text-xs text-gray-400 hover:text-red-500 ml-3 shrink-0"
              >
                ✕
              </button>
            </div>
            {c.answer && (
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">{c.answer}</p>
            )}
            {c.chartRows && c.strKey && c.numKey ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={c.chartRows} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey={c.strKey}
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }}
                    cursor={{ fill: '#f3f4f6' }}
                  />
                  <Bar dataKey={c.numKey} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardsView({ onRestoreGraph }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const revenue = stats?.totalRevenue ?? 0;
  const counts = stats?.counts ?? {};
  const topCustomers = stats?.topCustomers ?? [];
  const trendData = (stats?.monthlyRevenue ?? []).map(r => ({
    month: formatMonth(r.month),
    revenue: r.revenue,
  }));

  const totalEntityCount = (counts.invoices ?? 0) + (counts.payments ?? 0) +
    (counts.deliveries ?? 0) + (counts.customers ?? 0);

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Overview</h1>
          <p className="text-sm text-gray-400 mt-0.5">Last updated: {today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Last 30 days
          </button>
          <button className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Revenue" value={formatRevenue(revenue)} sub="from payments" />
            <MetricCard label="Total Customers" value={(counts.customers ?? 0).toLocaleString()} sub="unique accounts" />
            <MetricCard label="Total Invoices" value={(counts.invoices ?? 0).toLocaleString()} sub="billing documents" />
            <MetricCard label="Payments Collected" value={(counts.payments ?? 0).toLocaleString()} sub="posted payments" />
          </div>

          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Revenue Trend</p>
              <p className="text-xs text-gray-400 mb-4">Monthly payment receipts</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v/1_000).toFixed(0)}K` : `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    formatter={v => [formatRevenue(v), 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-900 mb-4">By Entity Type</p>
              <EntityBar label="Invoices" value={counts.invoices ?? 0} total={totalEntityCount} color="#f97316" />
              <EntityBar label="Payments" value={counts.payments ?? 0} total={totalEntityCount} color="#16a34a" />
              <EntityBar label="Deliveries" value={counts.deliveries ?? 0} total={totalEntityCount} color="#7c3aed" />
              <EntityBar label="Customers" value={counts.customers ?? 0} total={totalEntityCount} color="#2563eb" />
            </div>
          </div>

          {topCustomers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Top Accounts</p>
                <button className="text-xs text-blue-600 hover:text-blue-500 font-medium">View all</button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoices</th>
                    <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-700 text-right">{c.invoice_count.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-900 text-right">{formatRevenue(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <SavedChartsSection />

      <SavedGraphsSection onRestoreGraph={onRestoreGraph} />
    </div>
  );
}
