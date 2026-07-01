import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../data/supabase';
import { Send, Sparkles, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AskAIView: React.FC = () => {
  const { selectedApiaryId, apiariesList, selectedApiaryName } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select if there is exactly 1 apiary (matches ForecastView behavior)
  useEffect(() => {
    if (!selectedApiaryId && apiariesList.length === 1) {
      useAppStore.setState({ 
        selectedApiaryId: apiariesList[0].id, 
        selectedApiaryName: apiariesList[0].name 
      });
    }
  }, [selectedApiaryId, apiariesList]);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || !selectedApiaryId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // 1. Get the current user's session token to pass to the secure backend
      const { data: { session } } = await supabase.auth.getSession();
      
      // 2. Web (prod, preview, and dev via the Vite proxy) calls its own
      // same-origin function; only the packaged native app — which loads from
      // a localhost scheme with no backend — needs the absolute production URL.
      const apiUrl = Capacitor.isNativePlatform()
        ? 'https://beekeeper.beektools.com/api/chat'
        : '/api/chat';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: userMessage.content,
          apiaryId: selectedApiaryId,
          sessionToken: session?.access_token
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**Error:** ${error.message}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const currentApiary = apiariesList.find(a => a.id === selectedApiaryId);
  const apiaryName = currentApiary ? currentApiary.name : (selectedApiaryName || 'Select Location');

  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-input-bg)] animate-in slide-in-from-bottom-8">
      
      {/* Header */}
      <div className="w-full flex-shrink-0 flex items-center justify-center p-4 border-b border-[var(--color-card-border)] shadow-sm bg-[var(--color-input-bg)] z-10">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--color-primary)]" />
            <h2 className="text-xl font-black text-[var(--color-text)]">Ask AI</h2>
          </div>
          {selectedApiaryId && apiariesList.length > 1 ? (
            <div className="relative inline-flex items-center gap-1 mt-0.5 justify-center">
              <select
                value={selectedApiaryId}
                onChange={(e) => {
                  const selected = apiariesList.find(a => a.id === e.target.value);
                  if (selected) {
                    useAppStore.setState({ selectedApiaryId: selected.id, selectedApiaryName: selected.name });
                  }
                }}
                className="bg-transparent text-[11px] font-bold text-[var(--color-text-muted)] border-none focus:outline-none appearance-none pr-5 cursor-pointer text-center outline-none"
              >
                {apiariesList.map(a => (
                  <option key={a.id} value={a.id} className="text-black dark:text-white bg-[var(--color-bg)]">
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 pointer-events-none text-[var(--color-text-muted)]">
                <ChevronDown size={12} />
              </div>
            </div>
          ) : (
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
              {selectedApiaryId ? apiaryName : 'Powered by Gemini'}
            </span>
          )}
        </div>
      </div>

      {!selectedApiaryId ? (
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center bg-[var(--color-bg-raised)]/50">
          {apiariesList.length === 0 ? (
            <div className="bg-[var(--color-input-bg)] rounded-3xl p-8 text-center shadow-sm border border-[var(--color-card-border)] w-full max-w-md mx-auto animate-in fade-in duration-300">
              <p className="font-bold text-[var(--color-text)] mb-2">No Apiaries Found</p>
              <p className="text-sm text-[var(--color-text-muted)]">Please create an apiary yard first to use the Ask AI feature.</p>
            </div>
          ) : (
            <div className="bg-[var(--color-input-bg)] rounded-3xl p-8 flex flex-col items-center justify-center gap-6 shadow-sm border border-[var(--color-card-border)] w-full max-w-md mx-auto animate-in fade-in duration-300">
              <div className="text-center">
                <h3 className="text-lg font-black text-[var(--color-text)]">Select Apiary</h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1">
                  Choose an apiary to ask AI about.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2">
                {apiariesList.map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
                    }}
                    className="w-full card p-4 text-center font-bold text-sm hover:border-[var(--color-primary)] active:scale-98 transition-all"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[var(--color-bg-raised)]/50">
            
            {/* Intro Message */}
            {messages.length === 0 && (
              <div className="w-full max-w-md mx-auto mt-8 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center text-[var(--color-primary)]">
                  <Sparkles size={32} />
                </div>
                <h3 className="font-black text-xl text-[var(--color-text)]">Your AI Beekeeper</h3>
                <p className="text-[var(--color-text-muted)] font-medium">
                  Ask me anything about your hives! I automatically know your location, current weather, and hive types to give you the best advice.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className="bg-[var(--color-input-bg)] border border-[var(--color-card-border)] px-3 py-1.5 rounded-full text-xs font-bold text-[var(--color-text-muted)] shadow-sm">"Do I need to feed them today?"</span>
                  <span className="bg-[var(--color-input-bg)] border border-[var(--color-card-border)] px-3 py-1.5 rounded-full text-xs font-bold text-[var(--color-text-muted)] shadow-sm">"When should I add a super?"</span>
                  <span className="bg-[var(--color-input-bg)] border border-[var(--color-card-border)] px-3 py-1.5 rounded-full text-xs font-bold text-[var(--color-text-muted)] shadow-sm">"How do I treat for mites?"</span>
                </div>
              </div>
            )}

            {/* Message List */}
            <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-[var(--color-primary)] text-white rounded-tr-sm' 
                        : 'bg-[var(--color-input-bg)] border border-[var(--color-card-border)] text-[var(--color-text)] rounded-tl-sm prose prose-sm prose-p:leading-snug prose-headings:font-bold prose-a:text-[var(--color-primary)]'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="font-medium text-[15px]">{msg.content}</p>
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-input-bg)] border border-[var(--color-card-border)] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="w-full flex-shrink-0 bg-[var(--color-input-bg)] border-t border-[var(--color-card-border)] p-4 pb-8">
            <div className="w-full max-w-2xl mx-auto relative flex items-center gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                disabled={loading}
                placeholder="Ask about your bees..."
                className="flex-1 bg-[var(--color-bg-raised)] border border-[var(--color-card-border)] rounded-full py-4 pl-6 pr-12 font-medium text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none transition-all disabled:opacity-50"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="absolute right-2 w-10 h-10 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:hover:bg-[var(--color-primary)] active:scale-95"
              >
                <Send size={18} className="ml-1" />
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
};
