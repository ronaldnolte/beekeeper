import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Check, KeyRound, Mail, LogOut, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../data/supabase';
import {
  fetchProfile,
  saveProfile,
  emptyProfile,
  type Profile,
} from '../../data/profileRepository';

/**
 * The beekeeper's own screen. Two jobs:
 *
 *  1. Hold the preferences that change what the app does — hive defaults,
 *     treatment approach, experience.
 *  2. Be the home for the account actions that had nowhere to live: changing a
 *     password without pretending you forgot it, opting out of analytics,
 *     sending feedback, and logging out. Log Out in particular was sitting one
 *     thumb-width from Ask AI in the nav bar.
 *
 * Built light from the start — cream and honey is the direction as of
 * 2026-08-31, so nothing here needs converting later.
 */

const TREATMENTS: { value: NonNullable<Profile['treatmentApproach']>; label: string; blurb: string }[] = [
  { value: 'treatment_free', label: 'Treatment free', blurb: 'No miticides. Manage by genetics and husbandry.' },
  { value: 'organic',        label: 'Organic acids',  blurb: 'Oxalic, formic, thymol.' },
  { value: 'conventional',   label: 'Conventional',   blurb: 'Synthetic miticides where warranted.' },
  { value: 'undecided',      label: 'Still deciding', blurb: 'Show me everything.' },
];

export const ProfileView: React.FC = () => {
  const { user, goBack, setFeedbackModalOpen } = useAppStore();

  const [profile, setProfile] = useState<Profile>(emptyProfile(user?.id ?? ''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

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

  const edit = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setSavedAt(null);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      const { id: _id, ...edits } = profile;
      await saveProfile(user.id, edits);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message ?? 'Could not save your profile. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setError(null);
    // On the web, come back to whichever site sent you — preview stays on
    // preview. In the packaged app the origin is capacitor://localhost, which
    // is not somewhere an email link can land, so send those to production.
    const redirectTo = Capacitor.isNativePlatform()
      ? 'https://beekeeper.beektools.com/auth/update-password'
      : `${window.location.origin}/auth/update-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
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

        {/* Who you are ------------------------------------------------------ */}
        <section className="card p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">You</h2>

          <label className="mt-4 block text-sm font-black text-[var(--color-text)]">
            Name
            <input
              type="text"
              value={profile.displayName ?? ''}
              onChange={(e) => edit('displayName', e.target.value || null)}
              placeholder="What should we call you?"
              className="mt-1.5 w-full rounded-xl border-2 border-[var(--color-card-border)] bg-[var(--color-input-bg)] p-3 font-bold text-[var(--color-text)] outline-none transition-all duration-[var(--dur-fast)] placeholder:font-normal placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-ring)]"
            />
          </label>

          <label className="mt-4 block text-sm font-black text-[var(--color-text)]">
            Years keeping bees
            <input
              type="number"
              min={0}
              max={80}
              value={profile.experienceYears ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                edit('experienceYears', v === '' ? null : Math.max(0, Math.min(80, parseInt(v, 10) || 0)));
              }}
              placeholder="—"
              className="mt-1.5 w-28 rounded-xl border-2 border-[var(--color-card-border)] bg-[var(--color-input-bg)] p-3 text-center font-black text-[var(--color-text)] outline-none transition-all duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-ring)]"
            />
            <span className="mt-1.5 block text-xs font-normal text-[var(--color-text-muted)]">
              Used to pitch advice — more explanation in your first seasons, less once you know the ropes.
            </span>
          </label>

          <p className="mt-4 text-xs text-[var(--color-text-muted)]">
            Signed in as <span className="font-bold text-[var(--color-text)]">{user?.email}</span>
          </p>
        </section>

        {/* Hive defaults ---------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Hive defaults</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Prefilled when you add a hive. Always changeable there.</p>

          <div className="mt-4 flex gap-3">
            {(['Top Bar', 'Langstroth'] as const).map((t) => (
              <button
                key={t}
                onClick={() => edit('defaultHiveType', profile.defaultHiveType === t ? null : t)}
                className={`flex-1 rounded-xl border-2 px-4 py-3 font-black transition-all duration-[var(--dur-fast)] active:scale-95 ${
                  profile.defaultHiveType === t
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-wash)] text-[var(--color-primary-ink)]'
                    : 'border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {profile.defaultHiveType === 'Top Bar' && (
            <label className="mt-4 block text-sm font-black text-[var(--color-text)] animate-[rise-in_var(--dur-base)_var(--ease-soft)]">
              Bars, by default
              <input
                type="number"
                min={1}
                max={60}
                value={profile.defaultBarCount ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  edit('defaultBarCount', v === '' ? null : Math.max(1, Math.min(60, parseInt(v, 10) || 1)));
                }}
                placeholder="30"
                className="mt-1.5 w-28 rounded-xl border-2 border-[var(--color-card-border)] bg-[var(--color-input-bg)] p-3 text-center font-black text-[var(--color-text)] outline-none transition-all duration-[var(--dur-fast)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-ring)]"
              />
            </label>
          )}
        </section>

        {/* Treatment approach ----------------------------------------------- */}
        <section className="card mt-4 p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Varroa treatment</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Decides what the app suggests after a mite count. It never treats for you.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {TREATMENTS.map((t) => (
              <button
                key={t.value}
                onClick={() => edit('treatmentApproach', profile.treatmentApproach === t.value ? null : t.value)}
                className={`flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all duration-[var(--dur-fast)] active:scale-[0.99] ${
                  profile.treatmentApproach === t.value
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-wash)]'
                    : 'border-[var(--color-card-border)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                <span>
                  <span className={`block font-black ${profile.treatmentApproach === t.value ? 'text-[var(--color-primary-ink)]' : 'text-[var(--color-text)]'}`}>
                    {t.label}
                  </span>
                  <span className="block text-xs text-[var(--color-text-muted)]">{t.blurb}</span>
                </span>
                {profile.treatmentApproach === t.value && (
                  <Check size={18} className="shrink-0 text-[var(--color-primary-ink)]" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Privacy ----------------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Privacy</h2>
          <button
            onClick={() => edit('analyticsOptOut', !profile.analyticsOptOut)}
            className="mt-3 flex w-full items-center justify-between gap-4 text-left"
            role="switch"
            aria-checked={profile.analyticsOptOut}
          >
            <span>
              <span className="block font-black text-[var(--color-text)]">Don't count my usage</span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                Turns off anonymous analytics. Takes effect next time the app starts.
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
        </section>

        {/* Account ----------------------------------------------------------- */}
        <section className="card mt-4 p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-muted)]">Account</h2>

          <button
            onClick={handlePasswordReset}
            disabled={resetSent}
            className="mt-3 flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-card-border)] px-4 py-3 text-left font-bold text-[var(--color-text)] transition-all duration-[var(--dur-fast)] hover:border-[var(--color-text-muted)] active:scale-[0.99] disabled:opacity-60"
          >
            <KeyRound size={18} className="text-[var(--color-text-muted)]" />
            {resetSent ? 'Check your email for the link' : 'Change password'}
          </button>

          <button
            onClick={() => setFeedbackModalOpen(true)}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-card-border)] px-4 py-3 text-left font-bold text-[var(--color-text)] transition-all duration-[var(--dur-fast)] hover:border-[var(--color-text-muted)] active:scale-[0.99]"
          >
            <Mail size={18} className="text-[var(--color-text-muted)]" />
            Send feedback
          </button>

          <button
            onClick={() => setConfirmingLogout(true)}
            className="mt-2 flex w-full items-center gap-3 rounded-xl border-2 border-[var(--color-card-border)] px-4 py-3 text-left font-bold text-[var(--color-bad)] transition-all duration-[var(--dur-fast)] hover:border-[var(--color-bad)] active:scale-[0.99]"
          >
            <LogOut size={18} />
            Log out
          </button>
        </section>

        {error && (
          <p className="mt-4 rounded-xl bg-[var(--color-bad)]/10 px-4 py-3 text-sm font-bold text-[var(--color-bad)]">
            {error}
          </p>
        )}
      </div>

      {/* Save bar — only once something has changed */}
      <div className="bottom-action-bar">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-honey px-8 py-3 disabled:opacity-70"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : savedAt ? <Check size={18} /> : null}
          {saving ? 'Saving' : savedAt ? 'Saved' : 'Save changes'}
        </button>
      </div>

      {confirmingLogout && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-5 sm:items-center animate-[fade-in_var(--dur-base)_var(--ease-soft)]"
          onClick={() => setConfirmingLogout(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[var(--color-bg-raised)] p-6 shadow-2xl animate-[rise-in_var(--dur-base)_var(--ease-soft)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-logout-title"
          >
            <h2 id="profile-logout-title" className="text-lg font-black text-[var(--color-text)]">
              Log out of Beekeeper?
            </h2>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
              You'll need your email and password to get back in. Nothing you've recorded is lost.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setConfirmingLogout(false)}
                className="flex-1 rounded-2xl border-2 border-[var(--color-card-border)] py-3 font-bold text-[var(--color-text)] transition-colors duration-[var(--dur-fast)] active:scale-95"
              >
                Stay signed in
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.reload();
                }}
                className="flex-1 rounded-2xl bg-[var(--color-bad)] py-3 font-bold text-white transition-colors duration-[var(--dur-fast)] active:scale-95"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
