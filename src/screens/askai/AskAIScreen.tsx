// Ask AI — SPEC C §4 (screenshots B04, B16). No memory: each question is sent alone, and the
// conversation is lost when leaving the screen.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Markdown from 'react-markdown';
import { ChevronDown, Send, Sparkles } from 'lucide-react';
import { useApp } from '../../app/store';
import { supabase } from '../../lib/supabase';
import { apiBase } from '../../lib/platform';
import { ApiaryButtonsCard, EmptyApiariesCard } from '../../components/ApiaryPicker';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

// Display only — not tappable (kept as is; QUESTIONS #7).
const EXAMPLES = ['"Do I need to feed them today?"', '"When should I add a super?"', '"How do I treat for mites?"'];

function Thinking() {
  return (
    <div className="flex gap-1.5 px-4 py-3" role="status" aria-label="Thinking">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-text-muted" style={{ animation: `thinking 1.4s ${i * 0.2}s infinite both` }} />
      ))}
    </div>
  );
}

export default function AskAIScreen() {
  const { state, selectApiary } = useApp();
  const { apiaries } = state;
  const apiary = apiaries.find(a => a.id === state.selectedApiaryId) ?? null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [waiting, setWaiting] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.selectedApiaryId && apiaries.length === 1) selectApiary(apiaries[0]);
  }, [state.selectedApiaryId, apiaries, selectApiary]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, waiting]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const question = input.trim();
    if (!question || waiting || !apiary) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: question }]);
    setWaiting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`${apiBase()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, apiaryId: apiary.id, sessionToken: data.session?.access_token }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
      setMessages(m => [...m, { role: 'assistant', text: body.answer ?? '' }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', text: `**Error:** ${(err as Error).message}` }]);
    } finally {
      setWaiting(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#fcfaf9]" style={{ height: 'calc(100dvh - 76px - env(safe-area-inset-top) - 96px - env(safe-area-inset-bottom))' }}>
      <div className="shrink-0 bg-white/90 border-b border-divider shadow-sm px-4 py-3.5 text-center">
        <h2 className="flex items-center justify-center gap-2 text-xl font-black text-text">
          <Sparkles size={18} className="text-primary" /> Ask AI
        </h2>
        {apiary && apiaries.length > 1 ? (
          <div className="relative inline-flex items-center mt-0.5">
            <select
              aria-label="Apiary"
              value={apiary.id}
              onChange={e => selectApiary(apiaries.find(a => a.id === e.target.value) ?? null)}
              className="appearance-none bg-transparent text-[11px] font-bold text-text-muted pr-7 pl-2 outline-none"
            >
              {apiaries.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-1 text-text-muted pointer-events-none" />
          </div>
        ) : apiary ? (
          <p className="mt-0.5 text-[11px] font-bold text-text-muted">{apiary.name}</p>
        ) : (
          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-text-muted">Powered by Gemini</p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4">
        <div className="max-w-2xl mx-auto py-6">
          {apiaries.length === 0 ? (
            <EmptyApiariesCard message="Please create an apiary yard first to use the Ask AI feature." />
          ) : !apiary ? (
            <div className="pt-16">
              <ApiaryButtonsCard apiaries={apiaries} subtitle="Choose an apiary to ask AI about." onPick={selectApiary} />
            </div>
          ) : messages.length === 0 ? (
            <div className="pt-6 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary-wash flex items-center justify-center">
                <Sparkles size={32} className="text-primary" />
              </div>
              <h3 className="mt-5 text-lg font-black text-text">Your AI Beekeeper</h3>
              <p className="mt-3 px-6 text-base leading-relaxed text-text-muted">
                Ask me anything about your hives! I automatically know your location, the season, and your hive types to give you the best advice.
              </p>
              <div className="mt-7 flex flex-col items-center gap-2">
                {EXAMPLES.map(q => (
                  // Deliberate change #19 (Ron, 2026-09-29): tapping an example puts it in the box.
                  <button
                    key={q}
                    type="button"
                    onClick={() => setInput(q.replace(/^"|"$/g, ''))}
                    className="rounded-full bg-white px-4 py-2 text-xs font-bold text-text-muted shadow-sm active:scale-[0.97] transition-transform"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end animate-rise-in">
                    <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-white whitespace-pre-wrap break-words">{m.text}</p>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start animate-rise-in">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-text shadow-sm prose-chat">
                      <Markdown>{m.text}</Markdown>
                    </div>
                  </div>
                ),
              )}
              {waiting && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-white shadow-sm">
                    <Thinking />
                  </div>
                </div>
              )}
              <div ref={bottom} />
            </div>
          )}
        </div>
      </div>

      {apiary && (
        <form onSubmit={send} className="shrink-0 px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-2 rounded-full bg-white/80 pl-6 pr-2 py-2 shadow-sm">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={waiting}
              placeholder="Ask about your bees..."
              aria-label="Ask about your bees"
              className="flex-1 min-w-0 h-10 bg-transparent text-base outline-none placeholder:text-text-muted disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={waiting || !input.trim()}
              aria-label="Send"
              className="w-10 h-10 shrink-0 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
