import React, { useState } from 'react';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const PLAY_CONSOLE_JOIN_URL = 'https://play.google.com/apps/testing/com.beektools.beekeeper';

export const BetaSignupView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/beta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch (err: any) {
      console.error('Error submitting beta signup:', err);
      setStatus('error');
      setError('Connection failed. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-[var(--color-bg)]">
      <div className="w-full max-w-md card p-6 sm:p-8 relative overflow-hidden">
        {/* Warm glow accent */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-[var(--color-primary)] opacity-10 rounded-full blur-3xl"></div>
        
        {/* Go Back button to Login */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={() => useAppStore.getState().setCurrentView('AUTH')}
            className="flex items-center gap-1 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors active:scale-95"
          >
            <ArrowLeft size={14} /> Back to Login
          </button>
        </div>

        <div className="text-center mb-6 mt-4 relative z-10">
          <div className="w-20 h-20 mx-auto flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Beektools Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">Join the Beta</h1>
          <p className="text-[var(--color-text-muted)] mt-1 font-medium text-xs sm:text-sm">Get early access to Beekeeper on Android.</p>
        </div>

        {status === 'success' ? (
          <div className="text-center py-4 animate-in zoom-in duration-300">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-xl font-black text-[var(--color-text)] mb-2">You are ready!</h2>
            <p className="text-[var(--color-text-muted)] font-bold text-xs sm:text-sm leading-relaxed mb-4">
              To download Beekeeper instantly, follow these <strong>2 quick steps</strong>:
            </p>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="p-3.5 bg-[var(--color-input-bg)] border border-[var(--color-card-border)] rounded-xl text-left">
                <h3 className="text-xs sm:text-sm font-black text-[var(--color-text)] flex items-center gap-1.5 mb-1">
                  <span>👥</span> Step 1: Join the Google Group
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)] font-semibold mb-2.5">
                  Click below and select <strong>"Join Group"</strong> to instantly authorize your Gmail account.
                </p>
                <a
                  href="https://groups.google.com/g/beekeeper-bata"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 btn-honey text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform"
                >
                  Join Google Group
                </a>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 bg-[var(--color-input-bg)] border border-[var(--color-card-border)] rounded-xl text-left">
                <h3 className="text-xs sm:text-sm font-black text-[var(--color-text)] flex items-center gap-1.5 mb-1">
                  <span>📱</span> Step 2: Download the App
                </h3>
                <p className="text-[11px] text-[var(--color-text-muted)] font-semibold mb-2.5">
                  Once you have joined the group, click below to opt-in and download the app on Google Play.
                </p>
                <a
                  href={PLAY_CONSOLE_JOIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 rounded-xl shadow-md active:scale-95 transition-transform"
                >
                  Download on Google Play
                </a>
              </div>
            </div>

            <p className="text-[9px] text-[var(--color-text-muted)] font-medium mt-4">
              Make sure you are logged in to Google Play with the exact same Gmail address used to join the group.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 relative z-10">
            <p className="text-xs text-[var(--color-text-muted)] font-semibold leading-relaxed">
              Enter your Google Play / Gmail address. We will add you to our approved testers and notify you as soon as your access is active!
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20 font-bold">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-[var(--color-text)] mb-1.5 uppercase tracking-wide">Gmail Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 border-2 border-[var(--color-card-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold placeholder-[var(--color-text-muted)]"
                  placeholder="you@gmail.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 btn-honey text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {loading ? 'Submitting...' : '🚀 Request Beta Access'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}
      </div>
      {/* Dark background bar under the system navigation buttons */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] z-[9999] pointer-events-none" 
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />
    </div>
  );
};
