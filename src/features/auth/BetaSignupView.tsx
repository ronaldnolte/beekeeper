import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

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
      const apiUrl = Capacitor.isNativePlatform()
        ? 'https://beekeeper.beektools.com/api/beta'
        : '/api/beta';
      const response = await fetch(apiUrl, {
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
          <div className="text-center py-6 animate-in zoom-in duration-300">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-black text-[var(--color-text)] mb-3">Request Registered!</h2>
            <p className="text-[var(--color-text-muted)] font-bold text-sm leading-relaxed mb-6">
              We have received your request. We will whitelist your account for testing shortly (typically within 24 hours).
            </p>
            <div className="text-xs text-[var(--color-text-muted)] font-semibold bg-[var(--color-input-bg)] p-4 rounded-xl border border-[var(--color-card-border)]">
              📱 Keep an eye out for a welcome email from <strong>beta@beektools.com</strong> with direct download links and instructions once active!
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 relative z-10">
            <p className="text-xs text-[var(--color-text-muted)] font-semibold leading-relaxed">
              Enter your Google Account email address. We will add your account to our approved tester list and notify you.
            </p>

            {error && (
              <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20 font-bold">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-[var(--color-text)] mb-1.5 uppercase tracking-wide">Google Account Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 border-2 border-[var(--color-card-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold placeholder-[var(--color-text-muted)]"
                  placeholder="you@example.com"
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
