import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { X, MapPin, Sparkles, Snowflake, Flower2, UserRound, KeyRound, Zap } from 'lucide-react';

// Bump this string whenever there's new content worth announcing. Anyone whose
// stored value doesn't match sees the modal once, then it's marked as read.
// Kept as a content id (not the app version) so a release with nothing
// user-facing to say doesn't have to trigger the popup.
// Bumping this shows the modal once more to everyone who has already dismissed
// it. Earned here: the nectar index now returns DIFFERENT NUMBERS than it did
// yesterday — winter reads zero and "normal" is a five-year average — and a
// reading that changes under someone without explanation is worse than no
// reading at all.
// 2026-10 (1.5.35): the bloom section is new, and the nectar heat gate change (base 32F) moves spring
// numbers again, so everyone sees this once more.
export const WHATS_NEW_VERSION = '2026-10-bloom';
const SEEN_KEY = 'beek_whats_new_seen';

// One-time "What's New" modal. Self-managing: on mount it checks localStorage
// and shows itself once per WHATS_NEW_VERSION. Mounted globally for signed-in
// users, so it appears over the dashboard on first load after an update.
export const WhatsNewModal: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== WHATS_NEW_VERSION) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable (e.g. private mode) — just skip the modal.
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, WHATS_NEW_VERSION);
    } catch {
      // Ignore — worst case the modal shows again next load.
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fade-in_var(--dur-base)_var(--ease-soft)]"
      onClick={dismiss}
    >
      <div
        className="bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-[sheet-in_var(--dur-slow)_var(--ease-soft)] sm:zoom-in-95 duration-300 border border-[var(--color-card-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-[var(--color-input-bg)] border-b border-[var(--color-card-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary)]/15 flex items-center justify-center text-[var(--color-primary)]">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-xl font-black text-[var(--color-text)]">What's New</h3>
              <p className="text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wider mt-0.5">
                A few things you may have missed
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            className="p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)] transition-colors active:scale-95"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm custom-scrollbar">
          <Feature
            icon={<Flower2 size={20} />}
            title="What may be blooming, under Nectar Flow"
            body="A new section under the Nectar charts lists the plants recorded near your apiary that may be in bloom, starting soon or just finished, within three weeks either side of today. Blue means nectar, orange pollen, and purple both. Tap &quot;See full bloom calendar&quot; for the whole year at a glance. The dates are for a normal year, so a warm or wet season can move them; treat it as a guide to what to look for, not a promise."
          />
          <Feature
            icon={<Snowflake size={20} />}
            title="Spring opens a little earlier on the Nectar chart"
            body="The index now starts counting warmth from 32°F instead of 50°F, so early spring trees show up sooner and winter still reads close to zero. Summer and fall readings are unchanged, but your spring numbers will look different from last week, including in past years."
          />
          <Feature
            icon={<UserRound size={20} />}
            title="Your profile and settings"
            body="Tap your initial at the top right. Profile holds your name (the dashboard now greets you by it) and your hive and treatment preferences. Settings has a real switch to turn off anonymous usage statistics, plus app information."
          />
          <Feature
            icon={<KeyRound size={20} />}
            title="Password reset works everywhere"
            body="The reset link in the email now works whichever browser or app opens it, including on Android phones, where it used to fail."
          />
          <Feature
            icon={<Zap size={20} />}
            title="Faster screens"
            body="The dashboard and lists load once and stay loaded, so moving between screens is quicker and uses less data."
          />
          <Feature
            icon={<MapPin size={20} />}
            accent
            eyebrow="If you haven't yet — takes a minute"
            title="Pin your apiaries on the map"
            body="The bloom list needs a pin too: without one, both Nectar Flow and the plant list are guessing from the middle of your ZIP code. Open each apiary, tap Edit, and drop a pin on your hive stand."
          />
          {/* Testers on the packaged Android build. Hidden on web/PWA, which
              updates itself on every visit.

              Worded firmly on purpose. The installed app can lag the website by
              weeks — the features described above may simply not exist in the
              build someone is holding — and nothing else in the app tells them
              so. Ron hit exactly this on 2026-08-31: a phone running a build a
              month old, with the same version number showing as the site. */}
          {Capacitor.isNativePlatform() && (
            <div className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10 p-4">
              <p className="text-sm font-black text-[var(--color-text)]">
                📱 Check for an update before you rely on this
              </p>
              <p className="mt-1.5 text-xs font-bold leading-relaxed text-[var(--color-text-muted)]">
                The features above may not be in the version on your phone yet. The website
                updates itself; the app does not. Open <strong>Google Play → Beekeeper</strong> and
                tap <strong>Update</strong> if it's offered, and turn on auto-updates so you stay
                current without thinking about it.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--color-input-bg)] border-t border-[var(--color-card-border)] flex justify-end">
          <button
            onClick={dismiss}
            className="px-8 py-3 btn-honey rounded-xl font-black active:scale-95"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

function Feature({ icon, title, body, accent, eyebrow }: {
  icon: React.ReactNode;
  title: string;
  body: string;
  /** One entry per release may carry the accent — the thing to do, not just read. */
  accent?: boolean;
  eyebrow?: string;
}) {
  return (
    <div className={`flex gap-4 rounded-2xl p-4 ${accent
      ? 'border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10'
      : 'border border-[var(--color-card-border)] bg-[var(--color-bg-raised)]'}`}>
      <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center gap-0.5 ${accent
        ? 'bg-[var(--color-primary)] text-white'
        : 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'}`}>
        {icon}
      </div>
      <div>
        {eyebrow && (
          <p className="text-[10px] uppercase font-black tracking-wider text-[var(--color-primary-ink)] mb-1">
            {eyebrow}
          </p>
        )}
        <h4 className="font-black text-[var(--color-text)] mb-1">{title}</h4>
        <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
