import { NODE_LABELS } from '../lib/graphUtils';

const SKIP_KEYS = new Set(['raw_json', 'nodeType', 'color', 'label']);

export default function NodeCard({ node, onClose, connections = 0 }) {
  const { nodeType, label, metadata = {} } = node.data;
  const typeLabel = NODE_LABELS[nodeType] ?? nodeType;

  const entries = Object.entries(metadata)
    .filter(([k, v]) => !SKIP_KEYS.has(k) && v != null && v !== '')
    .slice(0, 12);

  const hasMore = Object.keys(metadata).length > 12;

  return (
    <div className="absolute top-16 left-4 z-10 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{typeLabel}</p>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 break-all">{label}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
        {entries.length === 0 && (
          <p className="text-xs text-gray-400 italic">No metadata available</p>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="text-xs text-gray-400 shrink-0 capitalize w-28">
              {key.replace(/_/g, ' ')}
            </span>
            <span className="text-xs text-gray-800 break-all">{String(value)}</span>
          </div>
        ))}
        {hasMore && (
          <p className="text-xs text-gray-400 italic pt-1">Additional fields hidden for readability</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500">
          Connections: <span className="font-medium text-gray-700">{connections}</span>
        </p>
      </div>
    </div>
  );
}
