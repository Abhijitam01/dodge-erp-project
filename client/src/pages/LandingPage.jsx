import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { icon: '⚡', label: 'NL to SQL', desc: 'Ask in plain English, get instant SQL-backed answers' },
  { icon: '🔗', label: 'Knowledge Graph', desc: 'Visualize relationships across your O2C entities' },
  { icon: '📊', label: 'Live Insights', desc: 'Real-time metrics from your SAP data pipeline' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="px-8 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-sm">Dodge AI</span>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Open Dashboard →
        </button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          SAP Order-to-Cash Explorer
        </div>

        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-4">
          Ask any business question,<br />
          <span className="text-blue-600">get instant answers</span>
        </h1>

        <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-xl">
          Natural language queries over your SAP Order-to-Cash data.
          Explore invoices, payments, customers, and deliveries — powered by AI.
        </p>

        <button
          onClick={() => navigate('/dashboard')}
          className="px-8 py-3.5 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-100"
        >
          Open Dashboard →
        </button>

        {/* Preview card */}
        <div className="mt-14 w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden text-left">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="ml-3 text-xs text-gray-400">Dodge AI — Ask a Question</span>
          </div>
          <div className="p-5">
            <div className="flex gap-2 mb-4">
              <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
                Which customer has the most invoices?
              </div>
              <div className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium">Ask</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-600 font-bold text-sm">✦</span>
                <span className="text-sm font-semibold text-gray-900">Answer</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Customer <span className="font-medium text-gray-900">Sunrise Corp</span> leads with{' '}
                <span className="font-medium text-gray-900">48 invoices</span>, followed by Nexus Industries (41) and Apex Trading (37).
              </p>
              <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">Found 8 records</p>
            </div>
          </div>
        </div>
      </main>

      {/* Feature pills */}
      <footer className="pb-12 pt-6">
        <div className="flex justify-center gap-4 flex-wrap px-8">
          {FEATURES.map(f => (
            <div key={f.label} className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-lg">{f.icon}</span>
              <div>
                <p className="text-xs font-semibold text-gray-900">{f.label}</p>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
