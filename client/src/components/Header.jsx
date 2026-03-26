export default function Header() {
  return (
    <header className="h-11 flex items-center px-4 bg-white border-b border-gray-200 shrink-0">
      <button className="p-1.5 rounded hover:bg-gray-100 mr-3 text-gray-500">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <nav className="flex items-center gap-1 text-sm">
        <span className="text-gray-400">Mapping</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-semibold">Order to Cash</span>
      </nav>
    </header>
  );
}
