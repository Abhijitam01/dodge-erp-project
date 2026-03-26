export default function ChatMessage({ role, content, sql, resultCount }) {
  if (role === 'assistant') {
    return (
      <div className="flex gap-2.5 items-start">
        <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">D</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 leading-relaxed">{content}</p>
          {sql && (
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                View SQL
              </summary>
              <pre className="mt-1.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-all">
                {sql}
              </pre>
            </details>
          )}
          {resultCount != null && (
            <p className="text-xs text-gray-400 mt-1">Found {resultCount} record{resultCount !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 items-start justify-end">
      <div className="max-w-[80%] bg-gray-900 text-white text-sm px-3.5 py-2.5 rounded-2xl rounded-tr-sm leading-relaxed">
        {content}
      </div>
      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    </div>
  );
}
