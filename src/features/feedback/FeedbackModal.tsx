import React, { useState } from 'react';
import { submitFeedback } from '../../data/feedbackRepository';
import { useAppStore } from '../../store/useAppStore';
import { Send, Lightbulb, MessageSquare, X } from 'lucide-react';

export const FeedbackModal: React.FC = () => {
  const { isFeedbackModalOpen, setFeedbackModalOpen, navigateTo } = useAppStore();
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // Reset form state when the modal is opened
  React.useEffect(() => {
    if (isFeedbackModalOpen) {
      setMessage('');
      setEmail('');
      setStatus('idle');
    }
  }, [isFeedbackModalOpen]);

  if (!isFeedbackModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('sending');

    try {
      await submitFeedback(message, email || undefined);

      setStatus('success');
      setTimeout(() => {
        setFeedbackModalOpen(false);
        setMessage('');
        setEmail('');
        setStatus('idle');
      }, 2000);

    } catch (error: any) {
      console.error('Error sending feedback:', error);
      setStatus('error');
    }
  };

  const handleGoToRoadmap = () => {
    setFeedbackModalOpen(false);
    navigateTo('ROADMAP');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="bg-[#F5A623] p-4 flex justify-between items-center text-white">
          <h3 className="font-black text-lg flex items-center gap-2">
            <MessageSquare size={20} /> Send Feedback
          </h3>
          <button
            onClick={() => setFeedbackModalOpen(false)}
            className="hover:bg-white/20 rounded-full p-1 transition-colors active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {status === 'success' ? (
            <div className="text-center py-10 animate-in zoom-in">
              <div className="text-5xl mb-4">✅</div>
              <h4 className="text-xl font-black text-[var(--color-card-text)] mb-2">Message Sent!</h4>
              <p className="text-gray-500 font-bold">Thanks for your feedback.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Roadmap CTA */}
              <div className="bg-amber-50 p-4 rounded-xl border-2 border-amber-100">
                <h4 className="font-black text-amber-900 flex items-center gap-2 mb-1">
                  Have a Feature Idea? <Lightbulb size={18} className="text-amber-500" />
                </h4>
                <p className="text-sm font-bold text-amber-800/80 mb-4">
                  Vote on existing requests or submit your own ideas to our public roadmap.
                </p>
                <button
                  type="button"
                  onClick={handleGoToRoadmap}
                  className="w-full text-center bg-white border-2 border-amber-300 text-amber-700 py-3 rounded-xl font-black hover:bg-amber-100 transition-colors active:scale-95 shadow-sm"
                >
                  View Roadmap & Vote →
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-bold uppercase tracking-wider">Or private message</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Message</label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Suggestions, bugs, or questions..."
                    className="w-full min-h-[120px] p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 placeholder-gray-400 focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 outline-none resize-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Your Email <span className="font-normal opacity-70">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="If you'd like a reply..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 placeholder-gray-400 focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 outline-none transition-all"
                  />
                </div>

                {status === 'error' && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold border border-red-100">
                    Failed to send. Please check your connection.
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedbackModalOpen(false)}
                    className="flex-1 py-4 text-gray-500 font-black hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === 'sending' || !message.trim()}
                    className="flex-[2] bg-[#8B4513] text-white py-4 rounded-xl font-black hover:bg-[#723910] transition-colors disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-md"
                  >
                    {status === 'sending' ? (
                      <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>Send Feedback <Send size={18} /></>
                    )}
                  </button>
                </div>
              </form>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
