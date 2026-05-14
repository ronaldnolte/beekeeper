import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../data/supabase';
import { ArrowLeft, Send, Sparkles, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AskAIView: React.FC = () => {
  const { selectedApiaryId } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      
      // 2. We use window.location.origin to hit the Vercel API route if deployed, 
      // or we can fallback to a local URL if running a local proxy.
      // For Vite development, we might need a proxy, but for Vercel deployment this works perfectly.
      const apiUrl = import.meta.env.DEV ? '/api/chat' : 'https://beekeeper.beektools.com/api/chat';
      
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

  return (
    <div className="w-full h-full flex flex-col bg-white animate-in slide-in-from-bottom-8">
      
      {/* Header */}
      <div className="w-full flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 shadow-sm bg-white z-10">
        <button 
          onClick={() => window.history.back()}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#E67E22]" />
            <h2 className="text-xl font-black text-gray-800">Ask AI</h2>
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Powered by Gemini</span>
        </div>
        <div className="w-10 h-10" /> {/* Spacer for centering */}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
        
        {/* Intro Message */}
        {messages.length === 0 && (
          <div className="w-full max-w-md mx-auto mt-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-[#E67E22]/10 rounded-full flex items-center justify-center text-[#E67E22]">
              <Sparkles size={32} />
            </div>
            <h3 className="font-black text-xl text-gray-800">Your AI Beekeeper</h3>
            <p className="text-gray-500 font-medium">
              Ask me anything about your hives! I automatically know your location, current weather, and hive types to give you the best advice.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <span className="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-xs font-bold text-gray-600 shadow-sm">"Do I need to feed them today?"</span>
              <span className="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-xs font-bold text-gray-600 shadow-sm">"When should I add a super?"</span>
              <span className="bg-white border border-gray-200 px-3 py-1.5 rounded-full text-xs font-bold text-gray-600 shadow-sm">"How do I treat for mites?"</span>
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
                    ? 'bg-[#E67E22] text-white rounded-tr-sm' 
                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm prose prose-sm prose-p:leading-snug prose-headings:font-bold prose-a:text-[#E67E22]'
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
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
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
      <div className="w-full flex-shrink-0 bg-white border-t border-gray-100 p-4 pb-8">
        <div className="w-full max-w-2xl mx-auto relative flex items-center gap-2">
          {!selectedApiaryId && (
            <div className="absolute -top-10 left-0 right-0 flex justify-center">
              <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm border border-red-200">
                <AlertTriangle size={14} /> Select an Apiary first
              </span>
            </div>
          )}
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            disabled={loading || !selectedApiaryId}
            placeholder="Ask about your bees..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full py-4 pl-6 pr-12 font-medium text-gray-800 placeholder-gray-400 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] outline-none transition-all disabled:opacity-50"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || loading || !selectedApiaryId}
            className="absolute right-2 w-10 h-10 bg-[#E67E22] text-white rounded-full flex items-center justify-center hover:bg-[#D35400] transition-colors disabled:opacity-50 disabled:hover:bg-[#E67E22] active:scale-95"
          >
            <Send size={18} className="ml-1" />
          </button>
        </div>
      </div>

    </div>
  );
};
