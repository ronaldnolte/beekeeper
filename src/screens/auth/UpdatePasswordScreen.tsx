// Set New Password — SPEC A §9 (screenshots A07, A08). The "Min 6 characters" hint is wrong
// (the rule is 8) and is kept on purpose for the first release (QUESTIONS #7).

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Lock, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../app/store';
import { AuthCard, ErrorBox, FieldLabel, IconInput, MessageBox } from './AuthParts';

export function UpdatePasswordScreen() {
  const { navigate } = useApp();
  const [verifying, setVerifying] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  // Verify once (SCAR S-AUTH-3): session already there → done; else wait for the recovery event,
  // and after 4 s check again before giving up.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let settled = false;
    const done = () => {
      settled = true;
      setError(null);
      setVerifying(false);
    };
    const { data: sub } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') done();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) done();
    });
    const timer = setTimeout(async () => {
      if (settled) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) return done();
      setError('Unable to verify security token. The link may have expired.');
      setVerifying(false);
    }, 4000);
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      ran.current = false;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setError('Unexpected error: Security session missing! Please click the link in your email again.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return setError(error.message);
      setMessage('Success! Your password has been updated.');
      setTimeout(() => navigate('SELECT_APIARY', { keepRecord: false }), 2000);
    } finally {
      setBusy(false);
    }
  };

  const page = 'min-h-screen flex items-center justify-center px-4 py-10';
  const background = { background: 'linear-gradient(135deg, #FFFBF0, #f4ecd8)' };

  if (verifying) {
    return (
      <div className={page} style={background}>
        <AuthCard className="animate-rise-in">
          <div className="px-6 py-12 text-center">
            <div className="text-5xl animate-pulse" aria-hidden="true">
              🔑
            </div>
            <h1 className="mt-4 text-xl font-bold text-text">Verifying security link...</h1>
            <p className="mt-3 text-text-muted">Please wait</p>
          </div>
        </AuthCard>
      </div>
    );
  }

  return (
    <div className={`${page} relative`} style={background}>
      <button
        type="button"
        onClick={() => navigate('AUTH', { keepRecord: false })}
        aria-label="Close"
        className="absolute left-4 top-4 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-text-muted"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <span className="w-6 h-6 rounded-full border-2 border-current flex items-center justify-center">
          <X size={14} strokeWidth={3} />
        </span>
      </button>
      <AuthCard className="animate-rise-in min-h-[calc(100vh-10rem)] flex flex-col justify-center">
        <form onSubmit={submit} className="px-6 py-10">
          <div className="text-center text-5xl" aria-hidden="true">
            🔐
          </div>
          <h1 className="mt-4 text-center text-2xl font-black text-text">Set New Password</h1>
          <p className="mt-2 text-center text-text-muted">Enter your new secure password below.</p>
          <div className="mt-8 space-y-5">
            <div>
              <FieldLabel htmlFor="new-password">New Password</FieldLabel>
              <IconInput id="new-password" type="password" variant="outlined" icon={Lock} placeholder="Min 6 characters" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
              <IconInput id="confirm-password" type="password" variant="outlined" icon={Lock} placeholder="Re-type password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <div className="text-center [&_[role=alert]]:text-red-700 [&_[role=alert]]:text-[15px]"><ErrorBox>{error}</ErrorBox></div>}
            {message && <MessageBox>{message}</MessageBox>}
            <button
              type="submit"
              disabled={busy}
              className="w-full h-14 rounded-2xl text-white text-lg font-black flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #E99B1A, #C47F0A)' }}
            >
              {busy ? 'Updating...' : 'Update Password'}
              {!busy && <ArrowRight size={20} />}
            </button>
          </div>
        </form>
      </AuthCard>
    </div>
  );
}
