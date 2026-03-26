import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { fetchGraph } from '../lib/api';
import { layoutNodes, transformEdges, buildDegreeMap } from '../lib/graphUtils';

function DotNode({ data }) {
  return (
    <div style={{ width: 10, height: 10, borderRadius: '50%', background: data.color, cursor: 'pointer' }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  );
}

const nodeTypes = { dot: DotNode };

const defaultEdgeOptions = {
  style: { stroke: '#93c5fd', strokeWidth: 1, opacity: 0.6 },
  type: 'straight',
};

function GraphCanvas({ onNodeSelect }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [hideGranular, setHideGranular] = useState(false);
  const [degreeMap, setDegreeMap] = useState({});
  const [allNodes, setAllNodes] = useState([]);
  const [allEdges, setAllEdges] = useState([]);

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
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hideGranular) {
      const filtered = allNodes.filter(n => (degreeMap[n.id] ?? 0) >= 2);
      const visibleIds = new Set(filtered.map(n => n.id));
      setNodes(filtered);
      setEdges(allEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)));
    } else {
      setNodes(allNodes);
      setEdges(allEdges);
    }
  }, [hideGranular, allNodes, allEdges, degreeMap]);

  const onNodeClick = useCallback((_, node) => {
    onNodeSelect(node);
  }, [onNodeSelect]);

  return (
    <div className={`relative h-full transition-all duration-300 ${minimized ? 'w-12' : 'flex-1'}`}>
      {minimized ? (
        <div className="h-full flex items-center justify-center bg-gray-100 border-r border-gray-200">
          <button
            onClick={() => setMinimized(false)}
            className="text-gray-500 hover:text-gray-800 rotate-90"
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
            defaultEdgeOptions={defaultEdgeOptions}
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
                hideGranular
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
              {hideGranular ? 'Show All' : 'Hide Granular Overlay'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function GraphView({ onNodeSelect }) {
  return (
    <ReactFlowProvider>
      <GraphCanvas onNodeSelect={onNodeSelect} />
    </ReactFlowProvider>
  );
}
