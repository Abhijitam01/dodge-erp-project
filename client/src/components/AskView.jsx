import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { sendChat } from '../lib/api';

const SUGGESTIONS = [
  'Top 10 customers by revenue',
  'Month-over-month sales growth',
  'Outstanding invoices over 60 days',
  'Show all payments above 10000',
];

function detectChartData(results) {
  if (!results || results.length < 2) return null;
  const keys = Object.keys(results[0]);
  const strKey = keys.find(k => typeof results[0][k] === 'string');
  const numKey = keys.find(k => typeof results[0][k] === 'number');
  if (!strKey || !numKey) return null;
  return { strKey, numKey };
}

function extractMetricCards(results) {
  if (!results?.length) return [];
  const row = results[0];
  return Object.entries(row)
    .filter(([, v]) => typeof v === 'number')
    .slice(0, 4)
    .map(([key, value]) => ({ key, value }));
}

function humanize(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatMetricValue(v) {
  if (typeof v !== 'number') return v;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function inferSources(results) {
  if (!results?.length) return ['SAP'];
  const keys = Object.keys(results[0]).join(' ').toLowerCase();
  const sources = [];
  if (keys.includes('customer') || keys.includes('name')) sources.push('Customers');
  if (keys.includes('invoice') || keys.includes('amount')) sources.push('Invoices');
  if (keys.includes('payment')) sources.push('Payments');
  if (keys.includes('delivery')) sources.push('Deliveries');
  if (!sources.length) sources.push('SAP');
  return sources;
}

const SOURCE_COLORS = {
  Customers: '#2563eb',
  Invoices: '#f97316',
  Payments: '#16a34a',
  Deliveries: '#7c3aed',
  SAP: '#6b7280',
};

function DataLineagePanel({ results, onExploreGraph }) {
  const sources = inferSources(results);

  return (
    <div className="border border-gray-200 rounded-xl p-4 w-64 shrink-0">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-blue-600 font-bold text-sm">✦</span>
        <span className="text-sm font-semibold text-gray-900">Data Lineage</span>
      </div>

      {/* Mini bubble diagram */}
      <div className="relative h-24 mb-3">
        {/* Result bubble on right */}
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center"
        >
          <span className="text-[9px] font-bold text-white text-center leading-tight">Result</span>
        </div>

        {/* Source bubbles on left */}
        {sources.slice(0, 4).map((src, i) => {
          const total = Math.min(sources.length, 4);
          const top = total === 1 ? 50 : 10 + (80 / (total - 1)) * i;
          const color = SOURCE_COLORS[src] ?? '#6b7280';
          return (
            <div key={src} style={{ position: 'absolute', left: 4, top: `${top}%`, transform: 'translateY(-50%)' }}>
              {/* Connection line */}
              <svg
                style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', overflow: 'visible' }}
                width="80" height="2"
              >
                <line x1="0" y1="1" x2="80" y2="1" stroke="#e5e7eb" strokeWidth="1.5" />
              </svg>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center relative z-10"
                style={{ background: color }}
              >
                <span className="text-[7px] font-bold text-white text-center leading-tight">{src.slice(0, 3)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {sources.map(src => (
          <span key={src} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
            {src}
          </span>
        ))}
      </div>

      <button
        onClick={onExploreGraph}
        className="text-sm text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1"
      >
        Explore full graph →
      </button>
    </div>
  );
}

function loadHistory() {
  try {
    return JSON.parse(sessionStorage.getItem('dodge_ai_chat_history') || '[]');
  } catch { return []; }
}

function saveHistory(history) {
  try {
    sessionStorage.setItem('dodge_ai_chat_history', JSON.stringify(history.slice(0, 50)));
  } catch { /* ignore quota errors */ }
}

export default function AskView({ onHighlight, initialQuery, onExploreGraph }) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showSql, setShowSql] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [showHistory, setShowHistory] = useState(false);

  // Sync when parent pushes a new prefill query (e.g. "Query this node")
  const prevInitialQuery = useRef(initialQuery);
  useEffect(() => {
    if (initialQuery && initialQuery !== prevInitialQuery.current) {
      prevInitialQuery.current = initialQuery;
      setQuery(initialQuery);
    }
  }, [initialQuery]);

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

      // Persist to session history
      const entry = { id: Date.now().toString(), query: trimmed, result: res, timestamp: new Date().toISOString() };
      const updated = [entry, ...history].slice(0, 50);
      setHistory(updated);
      saveHistory(updated);

      // Use server-provided nodeIds for accurate graph highlighting
      const ids = new Set(res.nodeIds ?? []);
      onHighlight?.(ids);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleNew() {
    setQuery('');
    setResult(null);
    setError(null);
    setShowSql(false);
    setShowHistory(false);
    onHighlight?.(new Set());
  }

  const chartData = result?.results ? detectChartData(result.results) : null;
  const metricCards = result?.results ? extractMetricCards(result.results) : [];
  const sourceCount = result?.results ? inferSources(result.results).length : 0;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Ask your data</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowHistory(v => !v)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title="History"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </button>
            {showHistory && history.length > 0 && (
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent queries</span>
                  <button
                    onClick={() => { setHistory([]); saveHistory([]); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {history.map(item => (
                    <button
                      key={item.id}
                      onClick={() => { setQuery(item.query); setResult(item.result); setShowSql(false); setError(null); setShowHistory(false); onHighlight?.(new Set(item.result?.nodeIds ?? [])); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <p className="text-sm text-gray-800 truncate">{item.query}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(item.timestamp).toLocaleTimeString()}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
          >
            New
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 border border-gray-300 rounded-xl px-4 py-3 focus-within:border-blue-500 transition-colors bg-white shadow-sm">
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
          <button
            onClick={() => submit()}
            disabled={!query.trim() || loading}
            className="px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </div>

      {/* TRY suggestions */}
      {!result && !loading && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Try:</span>
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
            <div className="flex items-center gap-3">
              {sourceCount > 0 && (
                <span className="text-xs text-gray-400">
                  Queried <span className="font-medium text-gray-600">{sourceCount}</span> data source{sourceCount !== 1 ? 's' : ''}
                </span>
              )}
              {result.sql && (
                <>
                  <span className="text-gray-200">|</span>
                  <button
                    onClick={() => setShowSql(v => !v)}
                    className="text-xs text-blue-600 hover:text-blue-500 font-medium"
                  >
                    {showSql ? 'Hide SQL' : 'View SQL'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Answer text */}
          <div className="px-5 py-4">
            <p className="text-base font-semibold text-gray-900 leading-relaxed">{result.answer}</p>
          </div>

          {/* SQL block */}
          {showSql && result.sql && (
            <div className="mx-5 mb-4 bg-gray-50 rounded-lg overflow-x-auto">
              <pre className="px-4 py-3 text-xs text-gray-700 font-mono whitespace-pre-wrap">{result.sql}</pre>
            </div>
          )}

          {/* Mini metric cards */}
          {metricCards.length > 0 && (
            <div className="px-5 pb-4 flex gap-3 flex-wrap">
              {metricCards.map(({ key, value }) => (
                <div key={key} className="border border-gray-200 rounded-xl px-4 py-3 min-w-[120px]">
                  <p className="text-2xl font-bold text-gray-900">{formatMetricValue(value)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{humanize(key)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Chart + Data Lineage */}
          {(chartData && result.results.length >= 2) && (
            <div className="px-5 pb-5 flex gap-4">
              <div className="flex-1">
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

              <DataLineagePanel
                results={result.results}
                onExploreGraph={onExploreGraph}
              />
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
