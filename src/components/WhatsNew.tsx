// What's New — SPEC C §8, text verbatim from APPENDIX-B B3 (screenshot B01).
// Bump CONTENT_VERSION only when there is something worth announcing: it re-shows the dialog to
// everyone once. One entry per release may carry the accent — the thing to DO.

import { useState, type ReactNode } from 'react';
import { ChartLine, MapPin, Snowflake, Sparkles, X, type LucideIcon } from 'lucide-react';
import { isAndroidApp } from '../lib/platform';

const STORAGE_KEY = 'beek_whats_new_seen';
const CONTENT_VERSION = '2026-09-nectar-charts';

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === CONTENT_VERSION;
  } catch {
    return true; // storage unavailable → skip the dialog
  }
}

function Entry({ icon: Icon, title, eyebrow, accent, children }: { icon: LucideIcon; title: string; eyebrow?: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={`rounded-2xl p-4 flex gap-4 ${accent ? 'border-2 border-primary bg-primary-wash' : 'bg-white'}`}>
      <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${accent ? 'bg-primary text-white' : 'bg-primary-wash text-primary'}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-wider text-primary-ink mb-1">{eyebrow}</p>}
        <h3 className="text-[15px] font-black text-text leading-snug">{title}</h3>
        <p className="mt-1.5 text-[13px] text-text-muted leading-normal">{children}</p>
      </div>
    </div>
  );
}

export function WhatsNew() {
  const [open, setOpen] = useState(() => !alreadySeen());
  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, CONTENT_VERSION);
    } catch {
      /* nothing to remember it in */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-quick" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="w-full max-w-md max-h-[92vh] flex flex-col rounded-[1.75rem] bg-[#EDEAE4]/95 shadow-2xl overflow-hidden animate-sheet-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-6 pt-6 pb-4 bg-white/70 border-b border-white">
          <div className="w-11 h-11 shrink-0 rounded-xl bg-primary-wash text-primary flex items-center justify-center">
            <Sparkles size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="whats-new-title" className="text-lg font-black text-text">
              What's New
            </h2>
            <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">A few things you may have missed</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Close" className="p-1 text-text-muted">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <Entry icon={ChartLine} title="Two new charts under Nectar Flow">
            The top chart still shows this season against the years behind it. Below it now sits the difference — green where you are running ahead of normal, red where you are behind — and under that, a season-to-date total that adds those daily differences up. The first tells you about today. The second tells you how the whole year has gone, which is the question most of us are actually asking in September.
          </Entry>
          <Entry icon={Snowflake} title="Winter reads zero now, and 'normal' means five years">
            Two changes to the index itself, so the numbers will not match what you saw last week. First: a warm January day used to show a little nectar. Greenness alone cannot tell evergreen from a flow, so it was counting sunshine the bees could not use — it now waits for real accumulated warmth before it reads anything. Second: your normal is averaged over five past seasons instead of three. Three good years in a row made an ordinary season look like a collapse.
          </Entry>
          <Entry icon={MapPin} accent eyebrow="If you haven't yet — takes a minute" title="Pin your apiaries on the map, or Nectar Flow is guessing">
            Without a pin, we read the satellite at the centre of your ZIP code — which can be miles from your hives, and in hill country lands on the wrong side of a ridge entirely. That is a different set of plants, a different water table, and a forage reading that is not yours. Open each apiary, tap Edit, and drop a pin on your actual hive stand. A few seconds per apiary, and every reading after that is about your bees instead of somebody else's.
          </Entry>
          {isAndroidApp() && (
            <div className="rounded-2xl border-2 border-primary p-4">
              <h3 className="text-[15px] font-black text-text">📱 Check for an update before you rely on this</h3>
              <p className="mt-1.5 text-[13px] text-text-muted leading-normal">
                The features above may not be in the version on your phone yet. The website updates itself; the app does not. Open <strong>Google Play → Beekeeper</strong> and tap <strong>Update</strong> if it's offered, and turn on auto-updates so you stay current without thinking about it.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 bg-white/70 border-t border-white">
          <button type="button" onClick={dismiss} className="btn-honey rounded-2xl px-8 h-[46px] text-base" style={{ borderRadius: '1rem' }}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
