import React, { useState } from 'react';
import { supabase } from '../../data/supabase';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
      if (errorDesc) return "Link Error: " + decodeURIComponent(errorDesc).replace(/\+/g, ' ');
    }
    return null;
  });
  const [message, setMessage] = useState<string | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isResetMode) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://beekeeper.beektools.com/auth/update-password'
      });
      if (error) {
        if (error.message === "{}" || error.status === 504) {
          setError("Connection timed out. Please try again.");
        } else {
          setError(error.message);
        }
      } else {
        setMessage('Check your email for the password reset link.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-[var(--color-bg)]">
      <div className="w-full max-w-md card p-6 sm:p-8 relative overflow-hidden">
        {/* Warm glow accent */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-[var(--color-primary)] opacity-10 rounded-full blur-3xl"></div>
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-24 h-24 mx-auto flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Beektools Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">TBH Beekeeper</h1>
          <p className="text-[var(--color-text-muted)] mt-1 font-medium text-sm sm:text-base">Manage your top-bar hives with ease.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20 font-bold">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-500/10 text-green-400 text-sm rounded-xl border border-green-500/20 font-bold">
            {message}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 relative z-10">
          <div>
            <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1.5 uppercase tracking-wide">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 border-2 border-[var(--color-card-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold placeholder-[var(--color-text-muted)]"
                placeholder="beekeeper@example.com"
                required
              />
            </div>
          </div>

          {!isResetMode && (
            <div>
              <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 border-2 border-[var(--color-card-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold placeholder-[var(--color-text-muted)]"
                  placeholder="••••••••"
                  required={!isResetMode}
                />
              </div>
            </div>
          )}

          {!isResetMode && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => { setIsResetMode(true); setError(null); setMessage(null); }}
                className="text-xs sm:text-sm font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {isResetMode && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => { setIsResetMode(false); setError(null); setMessage(null); }}
                className="text-xs sm:text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-bold text-lg shadow-lg shadow-[var(--color-primary)]/30 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98]"
          >
            {loading ? (isResetMode ? 'Sending...' : 'Logging in...') : (isResetMode ? 'Send Reset Link' : 'Log In')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};
