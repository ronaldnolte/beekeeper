// Join the Beta (public, /beta) — SPEC A §10 (screenshot A06).

import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Mail } from 'lucide-react';
import { useApp } from '../../app/store';
import { apiBase } from '../../lib/platform';
import { AuthCard, ErrorBox, FieldLabel, IconInput, Logo } from './AuthParts';

export function BetaSignupScreen() {
  const { navigate } = useApp();
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: only bots fill this
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/api/beta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
      if (res.ok) setDone(true);
      else {
        const body = await res.json().catch(() => null);
        setError(body?.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Connection failed. Please check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <AuthCard className="animate-rise-in">
        <div className="px-6 pt-6 pb-8">
          <button type="button" onClick={() => navigate('AUTH', { keepRecord: false })} className="flex items-center gap-1.5 text-xs text-text-muted font-bold">
            <ArrowLeft size={14} /> Back to Login
          </button>

          {done ? (
            <div className="text-center py-6">
              <div className="text-5xl" aria-hidden="true">
                ✅
              </div>
              <h1 className="mt-4 text-2xl font-black text-text">Request Registered!</h1>
              <p className="mt-3 text-text-muted">We have received your request. We will whitelist your account for testing shortly (typically within 24 hours).</p>
              <p className="mt-5 rounded-2xl bg-primary-wash px-4 py-3 text-sm text-text">
                📱 Keep an eye out for a welcome email from <strong>beta@beektools.com</strong> with direct download links and instructions once active!
              </p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="mt-4">
                <Logo size={80} />
              </div>
              <h1 className="mt-3 text-center text-2xl font-black text-text">Join the Beta</h1>
              <p className="mt-1 text-center text-xs text-text-muted">Get early access to Beekeeper on Android.</p>
              <p className="mt-6 text-xs text-text-muted leading-relaxed">
                Enter your Google Account email address. We will add your account to our approved tester list and notify you.
              </p>
              <div className="mt-5 space-y-4">
                {error && <ErrorBox>{error}</ErrorBox>}
                <div>
                  <FieldLabel htmlFor="beta-email">Google Account Email</FieldLabel>
                  <IconInput id="beta-email" type="email" icon={Mail} placeholder="you@example.com" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {/* Honeypot: off-screen, not focusable, not announced. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }}
                />
                <button type="submit" disabled={busy} className="btn-honey w-full h-14 text-base flex items-center justify-center gap-2">
                  {busy ? 'Submitting...' : '🚀 Request Beta Access'}
                  {!busy && <ArrowRight size={20} />}
                </button>
              </div>
            </form>
          )}
        </div>
      </AuthCard>
    </div>
  );
}
