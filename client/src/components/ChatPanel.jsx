import { useState, useRef, useEffect } from 'react';
import { sendChat } from '../lib/api';
import ChatMessage from './ChatMessage';

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'Hi! I can answer questions about your SAP Order-to-Cash data. Try asking "Which customer has the most invoices?" or "Show me all payments above 10000."',
};

export default function ChatPanel() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function submit() {
    const trimmed = input.trim();
    if (!trimmed || thinking) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setThinking(true);

    try {
      const res = await sendChat(trimmed);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer ?? 'No answer returned.',
          sql: res.sql,
          resultCount: res.resultCount,
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <aside className="w-[300px] flex flex-col border-l border-gray-200 bg-white shrink-0">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Chat with Graph</p>
        <p className="text-xs text-gray-400 mt-0.5">Order to Cash</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} {...msg} />
        ))}
        {thinking && (
          <div className="flex gap-2.5 items-start">
            <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">D</span>
            </div>
            <div className="flex gap-1 pt-2">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${thinking ? 'bg-yellow-400' : 'bg-green-400'}`} />
        <span className="text-xs text-gray-400">
          {thinking ? 'Dodge AI is thinking…' : 'Dodge AI is awaiting instructions'}
        </span>
      </div>

      <div className="px-3 pb-3">
        <div className="flex gap-2 items-end border border-gray-200 rounded-xl px-3 py-2 focus-within:border-gray-400 transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data…"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 resize-none outline-none bg-transparent leading-5 max-h-20"
            style={{ fieldSizing: 'content' }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || thinking}
            className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
