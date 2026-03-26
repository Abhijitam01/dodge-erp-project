const NAV_ITEMS = [
  {
    id: 'ask',
    label: 'Ask a Question',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: 'dashboards',
    label: 'Dashboards',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'graph',
    label: 'Knowledge Graph',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
        <path d="M12 7v4M12 11l-5 6M12 11l5 6" />
      </svg>
    ),
  },
];

export default function Sidebar({ activeView, onNavigate, nodeCount }) {
  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-white border-r border-gray-200 h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 leading-none">Dodge AI</p>
          <p className="text-xs text-gray-400 mt-0.5">O2C Explorer</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="px-2 flex-1">
        <p className="px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Main</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(item => {
            const isActive = activeView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Connected sources */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Connected Sources</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-xs text-gray-600">SAP ERP</span>
          {nodeCount != null && (
            <span className="ml-auto text-[10px] text-gray-400">{nodeCount.toLocaleString()} nodes</span>
          )}
        </div>
      </div>
    </aside>
  );
}
