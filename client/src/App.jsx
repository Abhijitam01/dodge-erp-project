import { useState } from 'react';
import Header from './components/Header';
import GraphView from './components/GraphView';
import NodeCard from './components/NodeCard';
import ChatPanel from './components/ChatPanel';

export default function App() {
  const [selectedNode, setSelectedNode] = useState(null);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden">
          <GraphView onNodeSelect={setSelectedNode} />
          {selectedNode && (
            <NodeCard
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          )}
        </div>
        <ChatPanel />
      </div>
    </div>
  );
}
