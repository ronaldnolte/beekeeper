import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import {
  fetchProfile,
  saveProfile,
  emptyProfile,
  type Profile,
} from '../../data/profileRepository';

/**
 * Who the beekeeper is and how they keep bees: name, experience, hive defaults,
 * treatment approach — the preferences that change what the app does.
 *
 * Privacy, password, log out and the app version live on the Settings screen;
 * both open from the menu under the header's initial button.
 */

const TREATMENTS: { value: NonNullable<Profile['treatmentApproach']>; label: string; blurb: string }[] = [
  { value: 'treatment_free', label: 'Treatment free', blurb: 'No miticides. Manage by genetics and husbandry.' },
  { value: 'organic',        label: 'Organic acids',  blurb: 'Oxalic, formic, thymol.' },
  { value: 'conventional',   label: 'Conventional',   blurb: 'Synthetic miticides where warranted.' },
  { value: 'undecided',      label: 'Still deciding', blurb: 'Show me everything.' },
];

export const ProfileView: React.FC = () => {
  const { user, goBack } = useAppStore();

  const [profile, setProfile] = useState<Profile>(emptyProfile(user?.id ?? ''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    </div>
  );
};
