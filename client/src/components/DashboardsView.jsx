import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchStats } from '../lib/api';

const KPI_CONFIG = [
  { key: 'invoices', label: 'Invoices', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  { key: 'payments', label: 'Payments', color: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
  { key: 'customers', label: 'Customers', color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  { key: 'deliveries', label: 'Deliveries', color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  { key: 'sales_orders', label: 'Sales Orders', color: 'bg-pink-50 text-pink-700', dot: 'bg-pink-500' },
  { key: 'products', label: 'Products', color: 'bg-gray-50 text-gray-700', dot: 'bg-gray-400' },
];

function KpiCard({ label, value, color, dot }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white px-5 py-4 flex items-center gap-4`}>
      <span className={`w-2.5 h-2.5 rounded-full ${dot} shrink-0`} />
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value?.toLocaleString() ?? '—'}</p>
      </div>
    </div>
  );
}

export default function DashboardsView() {
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

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const revenue = stats?.totalRevenue ?? 0;
  const formattedRevenue = revenue >= 1_000_000
    ? `$${(revenue / 1_000_000).toFixed(1)}M`
    : revenue >= 1_000
    ? `$${(revenue / 1_000).toFixed(1)}K`
    : `$${revenue.toFixed(0)}`;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboards</h1>
      <p className="text-sm text-gray-500 mb-6">Live metrics from your SAP Order-to-Cash dataset</p>

      {/* Revenue highlight */}
      <div className="mb-6 p-5 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl text-white shadow-sm">
        <p className="text-sm font-medium opacity-80">Total Payment Revenue</p>
        <p className="text-4xl font-bold mt-1">{formattedRevenue}</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {KPI_CONFIG.map(cfg => (
          <KpiCard
            key={cfg.key}
            label={cfg.label}
            value={stats?.counts?.[cfg.key]}
            color={cfg.color}
            dot={cfg.dot}
          />
        ))}
      </div>

      {/* Top customers bar chart */}
      {stats?.topCustomers?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-6">
          <p className="text-sm font-semibold text-gray-900 mb-1">Top Customers by Invoice Count</p>
          <p className="text-xs text-gray-400 mb-4">Top {stats.topCustomers.length} customers</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={stats.topCustomers}
              margin={{ top: 0, right: 0, left: -20, bottom: 40 }}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: '#f3f4f6' }}
                formatter={(v) => [v, 'Invoices']}
              />
              <Bar dataKey="invoice_count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Customer table */}
      {stats?.topCustomers?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Customer Invoice Summary</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
                <th className="text-right px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoices</th>
              </tr>
            </thead>
            <tbody>
              {stats.topCustomers.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                  <td className="px-5 py-2.5 text-sm text-gray-900">{c.name}</td>
                  <td className="px-5 py-2.5 text-xs text-gray-400 font-mono">{c.id}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-700 font-medium text-right">{c.invoice_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
