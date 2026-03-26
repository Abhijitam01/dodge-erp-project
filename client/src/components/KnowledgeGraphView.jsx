import { useState } from 'react';
import GraphView from './GraphView';
import { fetchNode } from '../lib/api';
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
      {/* Header */}
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

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {entries.length === 0 && (
          <p className="text-xs text-gray-400 italic">No metadata available</p>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-xs text-gray-400 shrink-0 capitalize w-24 leading-relaxed">
              {key.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-gray-800 break-all leading-relaxed">{String(value)}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
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

export default function KnowledgeGraphView({ highlightedIds, onDegreeMap, onQueryNode }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [connections, setConnections] = useState(0);
  const [degreeMap, setDegreeMap] = useState({});

  function handleDegreeMap(dm) {
    setDegreeMap(dm);
    onDegreeMap?.(dm);
  }

  async function handleNodeSelect(node) {
    setSelectedNode(node);
    setConnections(degreeMap[node.id] ?? 0);

    // Optionally fetch richer data
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

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className="flex-1 overflow-hidden">
        <GraphView
          onNodeSelect={handleNodeSelect}
          onDegreeMap={handleDegreeMap}
          highlightedIds={highlightedIds}
        />
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
  );
}
