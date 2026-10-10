import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Check, Download, KeyRound, LogOut, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../data/supabase';
import { passwordResetRedirect } from '../auth/Auth';
import { fetchProfile, saveAnalyticsOptOut, emptyProfile, type Profile } from '../../data/profileRepository';
import { setAnalyticsOptOut } from '../../shared/analytics';
import { installApp, installState, subscribeInstall, type InstallState } from '../../shared/installPrompt';
import { LogoutConfirm } from '../../shared/components/LogoutConfirm';

/** What the Install row says when there's no button to offer. */
const INSTALL_TEXT: Record<Exclude<InstallState, 'available'>, string> = {
  installed: 'Installed on this device ✓',
  native: "You're using the Android app.",
  ios: 'In Safari, tap Share, then "Add to Home Screen".',
  waiting: "Your browser isn't offering to install right now. If Beekeeper is already installed, open it from your home screen.",
  unsupported: "This browser can't install sites. Try Chrome or Edge.",
};

declare const __BUILD_TIME__: string;
declare const __APP_VERSION__: string;

/**
 * How the app behaves and the account itself: privacy, password, log out,
 * and which version is running. What the beekeeper *is* (name, hive defaults,
 * treatment approach) lives on the Profile screen instead.
 */
export const SettingsView: React.FC = () => {
  const { user, goBack } = useAppStore();

  const [profile, setProfile] = useState<Profile>(emptyProfile(user?.id ?? ''));
  const [loading, setLoading] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const install = useSyncExternalStore(subscribeInstall, installState, () => 'unsupported' as InstallState);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const loaded = await fetchProfile(user.id);
      if (!cancelled) {
        setProfile(loaded);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // The switch saves on its own (no Save button): flip it, it applies at once
  // on this device and is stored on the profile for the beekeeper's others.
  // It saves ONLY this choice, so a failed profile load here can never blank
  // the name, years, hive defaults or treatment saved on the Profile screen.
  const toggleAnalytics = async () => {
    if (!user?.id || savingPrivacy) return;
    const next = !profile.analyticsOptOut;
    setProfile({ ...profile, analyticsOptOut: next });
    setAnalyticsOptOut(next);
    setSavingPrivacy(true);
    setPrivacySaved(false);
    setError(null);
    try {
      await saveAnalyticsOptOut(user.id, next);
      setPrivacySaved(true);
    } catch (e) {
      setError((e as Error)?.message ?? 'Could not save that choice. It still applies on this device; try again to keep it on your others.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: passwordResetRedirect(),
    });
    if (resetError) setError(resetError.message);
    else setResetSent(true);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-bg)]">
        <Loader2 className="animate-spin text-[var(--color-primary)]" size={28} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-bg)] animate-[fade-in_var(--dur-base)_var(--ease-soft)]">
      <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4">

        <button
          onClick={goBack}
          className="mb-5 flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-muted)] transition-colors duration-[var(--dur-fast)] hover:text-[var(--color-text)]"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* Privacy ----------------------------------------------------------- */}
        <section className="card p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Privacy</h2>
          <button
            onClick={toggleAnalytics}
            className="mt-3 flex w-full items-center justify-between gap-4 text-left"
            role="switch"
            aria-checked={profile.analyticsOptOut}
          >
            <span>
              <span className="block font-black text-[var(--color-text)]">Don't count my usage</span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                Turns off anonymous analytics, starting now, on every device you sign in on.
              </span>
            </span>
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--dur-base)] ${
                profile.analyticsOptOut ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-divider)]'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-[var(--dur-base)] ${
                  profile.analyticsOptOut ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </span>
          </button>
          <p className="mt-2 h-4 text-xs font-bold text-[var(--color-text-muted)]" aria-live="polite">
            {savingPrivacy ? 'Saving…' : privacySaved ? <span className="inline-flex items-center gap-1"><Check size={12} /> Saved</span> : ''}
          </p>
        </section>

        {/* Account ----------------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Account</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Signed in as <span className="font-bold text-[var(--color-text)]">{user?.email}</span>
          </p>

          <button
            onClick={handlePasswordReset}
            disabled={resetSent}
            className="mt-3 flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-card-border)] px-4 py-3 text-left font-bold text-[var(--color-text)] transition-all duration-[var(--dur-fast)] hover:border-[var(--color-text-muted)] active:scale-[0.99] disabled:opacity-60"
          >
            <KeyRound size={18} className="text-[var(--color-text-muted)]" />
            {resetSent ? 'Check your email for the link' : 'Change password'}
          </button>

          <button
            onClick={() => setConfirmingLogout(true)}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-card-border)] px-4 py-3 text-left font-bold text-[var(--color-bad)] transition-all duration-[var(--dur-fast)] hover:border-[var(--color-bad)] active:scale-[0.99]"
          >
            <LogOut size={18} />
            Log out
          </button>
        </section>

        {/* About ------------------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">About</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-[var(--color-text-muted)]">Version</dt>
            <dd className="font-bold text-[var(--color-text)] tabular-nums">{__APP_VERSION__}</dd>
            <dt className="text-[var(--color-text-muted)]">Built</dt>
            <dd className="font-bold text-[var(--color-text)] tabular-nums">{__BUILD_TIME__} UTC</dd>
            <dt className="text-[var(--color-text-muted)]">Running as</dt>
            <dd className="font-bold text-[var(--color-text)]">{Capacitor.isNativePlatform() ? 'Android app' : 'Website'}</dd>
          </dl>
          {/* Install: always shown, so nobody has to wonder where it went. */}
          <div className="mt-4 border-t border-[var(--color-divider)] pt-4">
            <p className="text-sm font-black text-[var(--color-text)]">Install</p>
            {install === 'available' ? (
              <button
                onClick={() => void installApp()}
                className="mt-2 flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-card-border)] px-4 py-3 text-left font-bold text-[var(--color-text)] transition-all duration-[var(--dur-fast)] hover:border-[var(--color-text-muted)] active:scale-[0.99]"
              >
                <Download size={18} className="text-[var(--color-text-muted)]" />
                Install app on this device
              </button>
            ) : (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{INSTALL_TEXT[install]}</p>
            )}
          </div>
        </section>

        {error && (
          <p className="mt-4 rounded-xl bg-[var(--color-bad)]/10 px-4 py-3 text-sm font-bold text-[var(--color-bad)]">
            {error}
          </p>
        )}
      </div>

      {confirmingLogout && <LogoutConfirm onCancel={() => setConfirmingLogout(false)} />}
    </div>
  );
};
