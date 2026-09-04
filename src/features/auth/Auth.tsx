import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../../data/supabase';
import { Mail, Lock, ArrowRight } from 'lucide-react';

/**
 * Where a password-reset link should land.
 *
 * This used to be hardcoded to production, which is right for real users and
 * wrong for testing: a reset started on preview is issued against the Dev v2
 * database, and the link then dropped you on production, whose Supabase project
 * has never heard of that recovery token. The reset simply failed, and it looked
 * like the email was broken rather than the destination.
 *
 * Web comes back to whichever site sent you. The packaged app cannot — its
 * origin is capacitor://localhost, which no email link can reach — so it keeps
 * pointing at production.
 *
 * Note: Supabase only honours redirects on its allow list (Authentication ->
 * URL Configuration). A preview URL that is not listed falls back to the
 * project's Site URL rather than erroring.
 */
export function passwordResetRedirect(): string {
  return Capacitor.isNativePlatform()
    ? 'https://beekeeper.beektools.com/auth/update-password'
    : `${window.location.origin}/auth/update-password`;
}

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');

  const switchMode = (newMode: 'login' | 'signup' | 'reset') => {
    setMode(newMode);
    setError(null);
    setMessage(null);
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: passwordResetRedirect()
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
    } else if (mode === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Account created! Check your email to confirm, then log in.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    
    setLoading(false);
  };

  const submitLabel = mode === 'reset' 
    ? (loading ? 'Sending...' : 'Send Reset Link') 
    : mode === 'signup' 
      ? (loading ? 'Creating Account...' : 'Create Account') 
      : (loading ? 'Logging in...' : 'Log In');

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 bg-[var(--color-bg)]">
      <div className="w-full max-w-md card p-6 sm:p-8 relative overflow-hidden">
        {/* Warm glow accent */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-[var(--color-primary)] opacity-10 rounded-full blur-3xl"></div>
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-24 h-24 mx-auto flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Beektools Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">Beekeeper</h1>
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

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 relative z-10">
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

          {mode !== 'reset' && (
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
                  required
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs sm:text-sm font-black text-[var(--color-text)] mb-1.5 uppercase tracking-wide">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 border-2 border-[var(--color-card-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold placeholder-[var(--color-text-muted)]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => switchMode('reset')}
                className="text-xs sm:text-sm font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {mode === 'reset' && (
            <div className="flex justify-end">
              <button 
                type="button" 
                onClick={() => switchMode('login')}
                className="text-xs sm:text-sm font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 btn-honey text-lg"
          >
            {submitLabel}
            {!loading && <ArrowRight size={18} />}
          </button>

          {/* Toggle between Login and Sign Up */}
          {mode !== 'reset' && (
            <div className="text-center pt-1">
              <p className="text-xs text-[var(--color-text-muted)] font-medium">
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="font-bold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
                >
                  {mode === 'login' ? 'Create Account' : 'Log In'}
                </button>
              </p>
            </div>
          )}
        </form>
      </div>
      {/* Dark background bar under the system navigation buttons */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] z-[9999] pointer-events-none" 
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />
    </div>
  );
};
