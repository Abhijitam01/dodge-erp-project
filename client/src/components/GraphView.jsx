import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { fetchGraph } from '../lib/api';
import { layoutNodes, transformEdges, buildDegreeMap } from '../lib/graphUtils';

function DotNode({ data }) {
  const { color, isHighlighted, isDimmed } = data;

  const size = isHighlighted ? 14 : 10;
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: color,
    cursor: 'pointer',
    opacity: isDimmed ? 0.12 : 1,
    transition: 'all 0.2s',
    boxShadow: isHighlighted ? `0 0 0 2px white, 0 0 0 4px ${color}` : 'none',
  };

  return (
    <div style={style}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  );
}

const nodeTypes = { dot: DotNode };

function GraphCanvas({ onNodeSelect, onDegreeMap, highlightedIds, graphMode = 'full' }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [hideGranular, setHideGranular] = useState(false);
  const [degreeMap, setDegreeMap] = useState({});
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);

  const { fitView } = useReactFlow();

  // Re-fit when the container becomes visible (e.g. switching to graph tab
  // dispatches a resize event from handleNavigate in DashboardPage)
  useEffect(() => {
    function onResize() {
      if (!loading) fitView({ padding: 0.1, duration: 300 });
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [loading, fitView]);

  useEffect(() => {
    fetchGraph().then(data => {
      const laid = layoutNodes(data.nodes ?? []);
      const edged = transformEdges(data.edges ?? []);
      const dm = buildDegreeMap(data.edges ?? []);
      setAllNodes(laid);
      setAllEdges(edged);
      setDegreeMap(dm);
      setNodes(laid);
      setEdges(edged);
      setLoading(false);
      onDegreeMap?.(dm);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;

    const isHL = highlightedIds && highlightedIds.size > 0;

    if (graphMode === 'highlighted' && isHL) {
      const hlNodes = allNodes
        .filter(n => highlightedIds.has(n.id))
        .map(n => ({
          ...n,
          data: { ...n.data, isHighlighted: true, isDimmed: false, nodeId: n.id },
        }));

      // If no nodes matched (ID format mismatch), fall through to full mode with dimming
      if (hlNodes.length > 0) {
        const hlEdges = allEdges
          .filter(e => highlightedIds.has(e.source) && highlightedIds.has(e.target))
          .map(e => ({
            ...e,
            style: { stroke: '#3b82f6', strokeWidth: 2.5, opacity: 1 },
          }));

        setNodes(hlNodes);
        setEdges(hlEdges);

        // fitView is also triggered via the resize listener when the graph tab becomes visible
        setTimeout(() => fitView({ padding: 0.3, duration: 600 }), 50);
        return;
      }
    }

    // Full mode — all nodes with pre-computed isHighlighted/isDimmed booleans
    const base = hideGranular
      ? allNodes.filter(n => (degreeMap[n.id] ?? 0) >= 2)
      : allNodes;

    const updated = base.map(n => ({
      ...n,
      data: {
        ...n.data,
        isHighlighted: isHL && highlightedIds.has(n.id),
        isDimmed: isHL && !highlightedIds.has(n.id),
        nodeId: n.id,
      },
    }));
    setNodes(updated);

    const visibleIds = new Set(updated.map(n => n.id));
    const updatedEdges = allEdges
      .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map(e => {
        const edgeHighlighted = isHL && (highlightedIds.has(e.source) || highlightedIds.has(e.target));
        return {
          ...e,
          style: {
            stroke: edgeHighlighted ? '#3b82f6' : '#93c5fd',
            strokeWidth: edgeHighlighted ? 2.5 : 1.5,
            opacity: isHL ? (edgeHighlighted ? 1 : 0.04) : 0.7,
          },
        };
      });
    setEdges(updatedEdges);
  }, [hideGranular, allNodes, allEdges, degreeMap, highlightedIds, graphMode, loading]);

  const onNodeClick = useCallback((_, node) => {
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  return (
    <div className={`relative h-full transition-all duration-300 ${minimized ? 'w-12' : 'flex-1'}`}>
      {minimized ? (
        <div className="h-full flex items-center justify-center bg-gray-100 border-r border-gray-200">
          <button
            onClick={() => setMinimized(false)}
            className="text-gray-500 hover:text-gray-800"
            title="Expand"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#f0f0f0]">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.1 }}
            style={{ background: '#f0f0f0' }}
          >
            <Background variant="dots" color="#d1d5db" gap={40} size={1} />
          </ReactFlow>

          {/* Toolbar */}
          <div className="absolute top-4 left-4 flex gap-2 z-10">
            <button
              onClick={() => setMinimized(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full hover:bg-gray-700 transition-colors shadow-sm"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
              </svg>
              Minimize
            </button>
            <button
              onClick={() => setHideGranular(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors shadow-sm ${
                hideGranular ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {hideGranular ? 'Show All' : 'Hide Granular Overlay'}
            </button>
            {highlightedIds && highlightedIds.size > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium rounded-full shadow-sm">
                {highlightedIds.size} highlighted
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function GraphView({ onNodeSelect, onDegreeMap, highlightedIds, graphMode = 'full' }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas
        onNodeSelect={onNodeSelect}
        onDegreeMap={onDegreeMap}
        highlightedIds={highlightedIds}
        graphMode={graphMode}
      />
    </ReactFlowProvider>
  );
}
