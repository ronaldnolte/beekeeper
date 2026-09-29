// Your Profile — SPEC C §5 (screenshots B39–B41).

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Check, KeyRound, LogOut, Mail } from 'lucide-react';
import { useApp } from '../../app/store';
import { Spinner } from '../../components/Chrome';
import { Overlay } from '../../components/Overlay';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { supabase } from '../../lib/supabase';
import { passwordResetRedirect } from '../../lib/platform';
import { EMPTY_PROFILE, clampInt, loadProfile, saveProfile, type ProfileFields } from '../../lib/profileData';

const TREATMENTS: [NonNullable<ProfileFields['treatment_approach']>, string, string][] = [
  ['treatment_free', 'Treatment free', 'No miticides. Manage by genetics and husbandry.'],
  ['organic', 'Organic acids', 'Oxalic, formic, thymol.'],
  ['conventional', 'Conventional', 'Synthetic miticides where warranted.'],
  ['undecided', 'Still deciding', 'Show me everything.'],
];

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="card px-5 py-5">
      <h2 className="text-[11px] font-black uppercase tracking-wider text-text-muted">{title}</h2>
      {sub && <p className="mt-1.5 text-[11px] text-text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const input = 'rounded-2xl bg-white/80 px-4 h-12 text-[13px] text-text outline-none focus:ring-4 focus:ring-primary-ring placeholder:text-text-muted';
const choice = (on: boolean) => `rounded-2xl border-2 transition-colors ${on ? 'border-primary bg-primary/15' : 'border-white/70 bg-white/40'}`;

function LogoutConfirm({ onStay, onLogout }: { onStay: () => void; onLogout: () => void }) {
  return (
    <Overlay>
      <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/40 p-5 animate-fade-quick" onClick={onStay}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="logout-title" className="w-full max-w-md rounded-3xl bg-white p-6 animate-sheet-in" onClick={e => e.stopPropagation()}>
          <h2 id="logout-title" className="text-[17px] font-black text-text">
            Log out of Beekeeper?
          </h2>
          <p className="mt-3 text-[13px] text-text-muted">You'll need your email and password to get back in. Nothing you've recorded is lost.</p>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onStay} className="flex-1 h-[52px] rounded-2xl text-[15px] font-bold text-text">
              Stay signed in
            </button>
            <button type="button" onClick={onLogout} className="flex-1 h-[52px] rounded-2xl bg-bad text-white text-[15px] font-bold">
              Log out
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

export default function ProfileScreen() {
  const { state, goBack, signOut } = useApp();
  const user = state.user!;
  const [p, setP] = useState<ProfileFields | null>(null);
  const [years, setYears] = useState('');
  const [bars, setBars] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    let live = true;
    void loadProfile(user.id).then(r => {
      if (!live) return;
      setP(r);
      setYears(r.experience_years == null ? '' : String(r.experience_years));
      setBars(r.default_bar_count == null ? '' : String(r.default_bar_count));
    });
    return () => {
      live = false;
    };
  }, [user.id]);

  const edit = (patch: Partial<ProfileFields>) => {
    setP(cur => ({ ...(cur ?? EMPTY_PROFILE), ...patch }));
    setSaveState('idle');
  };

  const save = async () => {
    if (!p) return;
    setSaveState('saving');
    setError(null);
    const fields: ProfileFields = {
      ...p,
      display_name: p.display_name?.trim() || null,
      experience_years: clampInt(years, 0, 80),
      default_bar_count: p.default_hive_type === 'Top Bar' ? clampInt(bars, 1, 60) : p.default_bar_count,
    };
    try {
      await saveProfile(user.id, fields);
      setP(fields);
      setYears(fields.experience_years == null ? '' : String(fields.experience_years));
      setBars(fields.default_bar_count == null ? '' : String(fields.default_bar_count));
      setSaveState('saved');
    } catch (err) {
      setError((err as Error).message || 'Could not save your profile. Check your connection and try again.');
      setSaveState('idle');
    }
  };

  const changePassword = async () => {
    setError(null);
    const { error: e } = await supabase.auth.resetPasswordForEmail(user.email!, { redirectTo: passwordResetRedirect() });
    if (e) setError(e.message);
    else setResetSent(true);
  };

  if (!p) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const row = 'w-full h-[50px] rounded-2xl border-2 border-white/70 bg-white/40 px-4 flex items-center gap-3 text-[15px] font-bold disabled:opacity-60';

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-36 space-y-4">
      <button type="button" onClick={goBack} className="flex items-center gap-1.5 py-1 text-[13px] font-bold text-text-muted">
        <ArrowLeft size={15} /> Back
      </button>

      <Section title="You">
        <label className="block">
          <span className="block mb-2 text-[13px] font-black text-text">Name</span>
          <input className={`${input} w-full`} value={p.display_name ?? ''} onChange={e => edit({ display_name: e.target.value })} placeholder="What should we call you?" />
        </label>
        <label className="mt-6 flex items-center gap-4">
          <span className="text-[13px] font-black text-text">Years keeping bees</span>
          <input
            className={`${input} w-28 text-center`}
            type="number"
            inputMode="numeric"
            min={0}
            max={80}
            value={years}
            onChange={e => {
              setYears(e.target.value);
              setSaveState('idle');
            }}
            placeholder="—"
          />
        </label>
        <p className="mt-3 text-[11px] text-text-muted">Used to pitch advice — more explanation in your first seasons, less once you know the ropes.</p>
        <p className="mt-4 text-[11px] text-text-muted">
          Signed in as <b className="text-text">{user.email}</b>
        </p>
      </Section>

      <Section title="Hive defaults" sub="Prefilled when you add a hive. Always changeable there.">
        <div className="flex gap-3">
          {(['Top Bar', 'Langstroth'] as const).map(t => (
            <button
              key={t}
              type="button"
              aria-pressed={p.default_hive_type === t}
              onClick={() => edit({ default_hive_type: p.default_hive_type === t ? null : t })}
              className={`flex-1 h-[50px] text-[15px] font-black ${choice(p.default_hive_type === t)} ${p.default_hive_type === t ? 'text-primary' : 'text-text-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>
        {p.default_hive_type === 'Top Bar' && (
          <label className="mt-5 flex items-center gap-4">
            <span className="text-[13px] font-black text-text">Bars, by default</span>
            <input
              className={`${input} w-28 text-center`}
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={bars}
              onChange={e => {
                setBars(e.target.value);
                setSaveState('idle');
              }}
              placeholder="30"
            />
          </label>
        )}
      </Section>

      <Section title="Varroa treatment" sub="Decides what the app suggests after a mite count. It never treats for you.">
        <div className="space-y-3">
          {TREATMENTS.map(([value, label, blurb]) => {
            const on = p.treatment_approach === value;
            return (
              <button key={value} type="button" aria-pressed={on} onClick={() => edit({ treatment_approach: on ? null : value })} className={`w-full text-left px-5 py-3.5 ${choice(on)}`}>
                <span className={`block text-[15px] font-black ${on ? 'text-primary-ink' : 'text-text'}`}>{label}</span>
                <span className="block text-[11px] text-text-muted">{blurb}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Privacy">
        <div className="flex items-center justify-between gap-4 -mt-2">
          <div>
            <p className="text-[15px] font-black text-text">Don't count my usage</p>
            <p className="text-[11px] text-text-muted">Turns off anonymous analytics. Takes effect next time the app starts.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={p.analytics_opt_out}
            aria-label="Don't count my usage"
            onClick={() => edit({ analytics_opt_out: !p.analytics_opt_out })}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${p.analytics_opt_out ? 'bg-primary' : 'bg-[#e0d8c8]'}`}
          >
            <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${p.analytics_opt_out ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </Section>

      <Section title="Account">
        <div className="space-y-3 -mt-1">
          <button type="button" onClick={() => void changePassword()} disabled={resetSent} className={`${row} text-text`}>
            <KeyRound size={18} className="text-text-muted" /> {resetSent ? 'Check your email for the link' : 'Change password'}
          </button>
          <button type="button" onClick={() => setFeedbackOpen(true)} className={`${row} text-text`}>
            <Mail size={18} className="text-text-muted" /> Send feedback
          </button>
          <button type="button" onClick={() => setConfirmLogout(true)} className={`${row} text-bad`}>
            <LogOut size={18} /> Log out
          </button>
        </div>
      </Section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}

      <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center pointer-events-none" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => void save()} disabled={saveState === 'saving'} className="pointer-events-auto btn-honey h-12 px-8 text-[15px] flex items-center gap-2">
          {saveState === 'saving' ? (
            <>
              <Spinner className="w-5 h-5" color="border-white" /> Saving
            </>
          ) : saveState === 'saved' ? (
            <>
              <Check size={20} /> Saved
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </div>

      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
      {confirmLogout && <LogoutConfirm onStay={() => setConfirmLogout(false)} onLogout={() => void signOut().then(() => window.location.reload())} />}
    </div>
  );
}
