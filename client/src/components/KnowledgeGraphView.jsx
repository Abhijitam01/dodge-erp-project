import { useState, useEffect, useCallback } from 'react';
import GraphView from './GraphView';
import { fetchNode, sendChat } from '../lib/api';
import { NODE_LABELS } from '../lib/graphUtils';

const SKIP_KEYS = new Set(['raw_json', 'nodeType', 'color', 'label']);

function NodePanel({ node, connections, onClose, onQueryNode }) {
  const { nodeType, label, metadata = {} } = node.data;
  const typeLabel = NODE_LABELS[nodeType] ?? nodeType;

  const entries = Object.entries(metadata)
    .filter(([k, v]) => !SKIP_KEYS.has(k) && v != null && v !== '')
    .slice(0, 12);

  return (
    <aside className="w-[280px] shrink-0 flex flex-col bg-white border-l border-gray-200 h-full overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{typeLabel}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 break-all leading-snug">{label}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-md hover:bg-gray-100 text-gray-400 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {entries.length === 0 && (
          <p className="text-xs text-gray-400 italic">No metadata available</p>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="grid grid-cols-[40%_1fr] gap-x-2 gap-y-0.5">
            <span className="text-xs text-gray-400 capitalize leading-relaxed break-words">
              {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
            </span>
            <span className="text-xs text-gray-800 break-all leading-relaxed">{String(value)}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 space-y-2">
        <p className="text-xs text-gray-500">
          Connections: <span className="font-semibold text-gray-700">{connections}</span>
        </p>
        <button
          onClick={() => onQueryNode?.(label)}
          className="w-full py-2 px-3 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 transition-colors"
        >
          Query this node
        </button>
      </div>
    </aside>
  );
}

export default function KnowledgeGraphView({ highlightedIds, onDegreeMap, onQueryNode, onHighlight }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [connections, setConnections] = useState(0);
  const [degreeMap, setDegreeMap] = useState({});
  const [graphMode, setGraphMode] = useState('full');

  // Inline ask bar state
  const [askQuery, setAskQuery] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState(null);

  // Save toast
  const [savedToast, setSavedToast] = useState(false);

  // Auto-switch to highlighted mode when highlights arrive
  useEffect(() => {
    if (highlightedIds && highlightedIds.size > 0) {
      setGraphMode('highlighted');
    }
  }, [highlightedIds]);

  function handleDegreeMap(dm) {
    setDegreeMap(dm);
    onDegreeMap?.(dm);
  }

  const handleHighlightedSubsetEmpty = useCallback(() => {
    setGraphMode('full');
  }, []);

  async function handleNodeSelect(node) {
    setSelectedNode(node);
    setConnections(degreeMap[node.id] ?? 0);

    try {
      const data = await fetchNode(node.id);
      setSelectedNode(prev =>
        prev?.id === node.id
          ? { ...node, data: { ...node.data, metadata: data.data ?? {} } }
          : prev
      );
    } catch {
      // fall back to graph node data
    }
  }

  async function handleAsk() {
    const trimmed = askQuery.trim();
    if (!trimmed || askLoading) return;
    setAskLoading(true);
    setAskAnswer(null);

    try {
      const res = await sendChat(trimmed);
      setAskAnswer(res.answer ?? '');

      const ids = new Set(res.nodeIds ?? []);
      if (ids.size > 0) {
        onHighlight?.(ids);
        setGraphMode('highlighted');
      }
    } catch {
      setAskAnswer('Something went wrong. Please try again.');
    } finally {
      setAskLoading(false);
    }
  }

  function handleSaveGraph() {
    const saved = JSON.parse(localStorage.getItem('dodge_ai_saved_graphs') || '[]');
    const entry = {
      id: Date.now().toString(),
      query: askQuery.trim() || 'Highlighted graph',
      highlightedIds: Array.from(highlightedIds ?? []),
      nodeCount: (highlightedIds ?? new Set()).size,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('dodge_ai_saved_graphs', JSON.stringify([entry, ...saved]));
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  const hlSize = (highlightedIds ?? new Set()).size;

  return (
    <div className="flex flex-1 overflow-hidden h-full flex-col">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <button
          onClick={() => setGraphMode('full')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            graphMode === 'full'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Full Graph
        </button>
        <button
          type="button"
          onClick={() => hlSize > 0 && setGraphMode('highlighted')}
          disabled={hlSize === 0}
          title={
            hlSize === 0
              ? 'Ask a question on Ask or here first — highlights appear when the answer includes graph node IDs.'
              : `Show only ${hlSize} highlighted node${hlSize === 1 ? '' : 's'}`
          }
          aria-label={
            hlSize === 0
              ? 'Highlighted view disabled until a query returns nodes to highlight'
              : `Highlighted subgraph, ${hlSize} nodes`
          }
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
            graphMode === 'highlighted'
              ? 'bg-blue-600 text-white'
              : hlSize === 0
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Highlighted {hlSize > 0 ? `(${hlSize})` : ''}
        </button>

        {graphMode === 'highlighted' && hlSize > 0 && (
          <button
            onClick={handleSaveGraph}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
          >
            {savedToast ? (
              <span className="text-emerald-600 font-semibold">Saved!</span>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save to Dashboard
              </>
            )}
          </button>
        )}
      </div>

      {/* Graph + panel */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-hidden relative">
          <GraphView
            onNodeSelect={handleNodeSelect}
            onDegreeMap={handleDegreeMap}
            highlightedIds={highlightedIds}
            graphMode={graphMode}
            onHighlightedSubsetEmpty={handleHighlightedSubsetEmpty}
          />

          {/* Floating inline ask bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[420px] max-w-[80%] flex flex-col gap-2">
            <div className="flex gap-2 bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2">
              <svg className="text-gray-400 shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={askQuery}
                onChange={e => setAskQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAsk()}
                placeholder="Ask about this graph…"
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              />
              <button
                onClick={handleAsk}
                disabled={!askQuery.trim() || askLoading}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {askLoading ? '…' : 'Ask'}
              </button>
            </div>

            {askAnswer && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-800 leading-relaxed flex-1">
                    <span className="text-blue-600 font-bold mr-1">✦</span>
                    {askAnswer.length > 140 ? askAnswer.slice(0, 140) + '…' : askAnswer}
                  </p>
                  <button
                    onClick={() => setAskAnswer(null)}
                    className="text-gray-400 hover:text-gray-600 shrink-0 mt-0.5"
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 1l12 12M13 1L1 13" />
                    </svg>
                  </button>
                </div>
                <button
                  onClick={() => onQueryNode?.(askQuery)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-500 font-medium"
                >
                  See full answer →
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedNode && (
          <NodePanel
            node={selectedNode}
            connections={connections}
            onClose={() => setSelectedNode(null)}
            onQueryNode={onQueryNode}
          />
        )}
      </div>
    </div>
  );
}
