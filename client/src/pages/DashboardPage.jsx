import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AskView from '../components/AskView';
import KnowledgeGraphView from '../components/KnowledgeGraphView';
import DashboardsView from '../components/DashboardsView';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('ask');
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [degreeMap, setDegreeMap] = useState({});
  const [nodeCount, setNodeCount] = useState(null);
  const [prefillQuery, setPrefillQuery] = useState('');

  function handleHighlight(ids) {
    setHighlightedIds(ids);
    // Auto-switch to graph if IDs are highlighted so user sees the effect
    // (do NOT auto-switch — let user navigate manually; just store state)
  }

  function handleDegreeMap(dm) {
    setDegreeMap(dm);
    setNodeCount(Object.keys(dm).length);
  }

  function handleQueryNode(label) {
    setPrefillQuery(label);
    setActiveView('ask');
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} nodeCount={nodeCount} />

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="h-11 shrink-0 flex items-center px-5 bg-white border-b border-gray-200 gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Home"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
            </svg>
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">
            {activeView === 'ask' ? 'Ask a Question' : activeView === 'graph' ? 'Knowledge Graph' : 'Dashboards'}
          </span>
          {highlightedIds.size > 0 && activeView !== 'graph' && (
            <button
              onClick={() => setActiveView('graph')}
              className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium rounded-full hover:bg-blue-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {highlightedIds.size} nodes highlighted — View on graph
            </button>
          )}
        </header>

        {/* View content */}
        <main className="flex-1 overflow-hidden flex">
          {activeView === 'ask' && (
            <AskView
              key={prefillQuery}
              initialQuery={prefillQuery}
              onHighlight={handleHighlight}
            />
          )}
          {activeView === 'graph' && (
            <KnowledgeGraphView
              highlightedIds={highlightedIds}
              onDegreeMap={handleDegreeMap}
              onQueryNode={handleQueryNode}
            />
          )}
          {activeView === 'dashboards' && <DashboardsView />}
        </main>
      </div>
    </div>
  );
}
