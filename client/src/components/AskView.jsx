import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { sendChat } from '../lib/api';

const SUGGESTIONS = [
  'Which customer has the most invoices?',
  'Show all payments above 10000',
  'Outstanding invoices with no payment',
  'Top 5 customers by revenue',
];

function detectChartData(results) {
  if (!results || results.length < 2) return null;
  const keys = Object.keys(results[0]);
  const strKey = keys.find(k => typeof results[0][k] === 'string');
  const numKey = keys.find(k => typeof results[0][k] === 'number');
  if (!strKey || !numKey) return null;
  return { strKey, numKey };
}

export default function AskView({ onHighlight, initialQuery }) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showSql, setShowSql] = useState(false);
  const [error, setError] = useState(null);

  async function submit(q) {
    const trimmed = (q ?? query).trim();
    if (!trimmed || loading) return;
    setQuery(trimmed);
    setLoading(true);
    setResult(null);
    setError(null);
    setShowSql(false);

    try {
      const res = await sendChat(trimmed);
      setResult(res);

      // Extract IDs from results to highlight on graph
      if (res.results && res.results.length > 0) {
        const ids = new Set(
          res.results
            .map(r => r.id)
            .filter(Boolean)
            .map(String)
        );
        onHighlight?.(ids);
      } else {
        onHighlight?.(new Set());
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const chartData = result?.results ? detectChartData(result.results) : null;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 max-w-3xl mx-auto w-full">
      {/* Heading */}
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Ask your data</h1>
      <p className="text-sm text-gray-500 mb-6">Natural language queries over your SAP Order-to-Cash data</p>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-xl px-4 py-2.5 focus-within:border-blue-500 transition-colors bg-white shadow-sm">
          <svg className="text-gray-400 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Ask anything about your O2C data…"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
        </div>
        <button
          onClick={() => submit()}
          disabled={!query.trim() || loading}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </div>

      {/* Suggestions */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-2 mb-8">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-8 text-gray-400">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Analyzing your data…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
      )}

      {/* Answer card */}
      {result && !loading && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 font-bold text-sm">✦</span>
              <span className="text-sm font-semibold text-gray-900">Answer</span>
            </div>
            {result.sql && (
              <button
                onClick={() => setShowSql(v => !v)}
                className="text-xs text-blue-600 hover:text-blue-500 font-medium"
              >
                {showSql ? 'Hide SQL' : 'View SQL'}
              </button>
            )}
          </div>

          {/* Answer text */}
          <div className="px-5 py-4">
            <p className="text-sm text-gray-800 leading-relaxed">{result.answer}</p>
          </div>

          {/* SQL block */}
          {showSql && result.sql && (
            <div className="mx-5 mb-4 bg-gray-50 rounded-lg overflow-x-auto">
              <pre className="px-4 py-3 text-xs text-gray-700 font-mono whitespace-pre-wrap">{result.sql}</pre>
            </div>
          )}

          {/* Bar chart */}
          {chartData && result.results.length >= 2 && (
            <div className="px-5 pb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Chart</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={result.results.slice(0, 20)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey={chartData.strKey}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: '#f3f4f6' }}
                  />
                  <Bar dataKey={chartData.numKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Footer */}
          {result.resultCount != null && (
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400">
                Found <span className="font-medium text-gray-600">{result.resultCount}</span> record{result.resultCount !== 1 ? 's' : ''}
                {result.guarded && <span className="ml-2 text-amber-500">· Out of domain</span>}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
