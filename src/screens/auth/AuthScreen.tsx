// Sign-in screen — SPEC A §7 (screenshots A01–A05).

import { useState, type FormEvent } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { passwordResetRedirect } from '../../lib/platform';
import { AuthCard, ErrorBox, FieldLabel, IconInput, Logo, MessageBox } from './AuthParts';

type Mode = 'login' | 'signup' | 'reset';

const LABELS: Record<Mode, { idle: string; busy: string }> = {
  login: { idle: 'Log In', busy: 'Logging in...' },
  signup: { idle: 'Create Account', busy: 'Creating Account...' },
  reset: { idle: 'Send Reset Link', busy: 'Sending...' },
};

/** "Link Error: …" from error_description in the URL hash or query (SCAR S-AUTH-4). */
function linkErrorFromUrl(): string | null {
  const read = (s: string) => new URLSearchParams(s.replace(/^[#?]/, '')).get('error_description');
  const raw = read(window.location.hash) ?? read(window.location.search);
  return raw ? `Link Error: ${raw.replace(/\+/g, ' ')}` : null;
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => linkErrorFromUrl());
  const [message, setMessage] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setMessage(null);
    setConfirm('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === 'signup') {
      if (password.length < 8) return setError('Password must be at least 8 characters.');
      if (password !== confirm) return setError('Passwords do not match.');
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        // Success: the sign-in listener moves to Dashboard.
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setError(error.message);
        else setMessage('Account created! Check your email to confirm, then log in.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: passwordResetRedirect() });
        if (error) {
          // Existing mapping — see DESIGN-REQUIREMENTS §3 (it once hid a real SMTP failure).
          setError(error.message === '{}' || error.status === 504 ? 'Connection timed out. Please try again.' : error.message);
        } else setMessage('Check your email for the password reset link.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <AuthCard className="animate-rise-in">
        <form onSubmit={submit} className="px-6 pt-6 pb-6">
          <Logo size={96} />
          <h1 className="mt-3 text-center text-2xl font-black text-text">Beekeeper</h1>
          <p className="mt-1 text-center text-sm text-text-muted">Manage your bees with ease.</p>

          <div className="mt-8 space-y-4">
            {error && <ErrorBox>{error}</ErrorBox>}
            {message && <MessageBox>{message}</MessageBox>}

            <div>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <IconInput id="email" type="email" required icon={Mail} placeholder="beekeeper@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            {mode !== 'reset' && (
              <div>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <IconInput
                  id="password"
                  type="password"
                  required
                  icon={Lock}
                  placeholder="••••••••"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <FieldLabel htmlFor="confirm">Confirm Password</FieldLabel>
                <IconInput id="confirm" type="password" required icon={Lock} placeholder="••••••••" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => switchMode('reset')} className="text-xs font-bold text-primary">
                  Forgot Password?
                </button>
              </div>
            )}
            {mode === 'reset' && (
              <div className="text-right">
                <button type="button" onClick={() => switchMode('login')} className="text-xs font-bold text-text-muted">
                  Back to Login
                </button>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-honey w-full h-[58px] text-lg flex items-center justify-center gap-2">
              {busy ? LABELS[mode].busy : LABELS[mode].idle}
              {!busy && <ArrowRight size={20} />}
            </button>

            {mode === 'login' && (
              <p className="pt-1 text-center text-xs text-text-muted">
                Don't have an account?{' '}
                <button type="button" onClick={() => switchMode('signup')} className="font-bold text-primary">
                  Create Account
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="pt-1 text-center text-xs text-text-muted">
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')} className="font-bold text-primary">
                  Log In
                </button>
              </p>
            )}
          </div>
        </form>
      </AuthCard>
    </div>
  );
}
