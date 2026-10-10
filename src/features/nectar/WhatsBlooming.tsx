// "What's blooming" — the section under the Nectar charts (bloom plan step 4, E:\claude\bloom-integration\PLAN.md).
//
// Lists the nearby plants blooming within 3 weeks either side of today (Ron, 2026-10-08; it was the whole calendar
// season, which ran to 44 plants by mid-April), with today's status, current
// bloom first. Nectar, pollen and both are told apart by colour AND a text label (Ron, 2026-10-08): blue and
// orange as in his sample chart; "both" is purple here, not the sample's green, because green already means
// "in flow" on the Nectar chart above. When nothing is blooming around now it says so plainly and offers the
// next season's list.
//
// Bloom is a separate calculation and never holds up Nectar: this section loads on its own, and any failure
// stays inside it. Outside North America it is hidden.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { CalendarDays, ChevronDown, Flower2, RefreshCw } from 'lucide-react';
import { supabase } from '../../data/supabase';
import { useAppStore } from '../../store/useAppStore';
import { BloomCalendar } from './BloomCalendar';
import {
  type ApiaryBloom,
  type BloomKind,
  type SeasonName,
  NEXT_SEASON,
  STATUS_LABEL,
  firstBloomStart,
  formatMonthDay,
  seasonList,
  windowList,
  seasonOf,
  todayDoy,
} from './bloomStatus';

const KIND_STYLE: Record<BloomKind, { color: string; label: string }> = {
  nectar: { color: '#2a78d6', label: 'Nectar' },
  pollen: { color: '#d95926', label: 'Pollen' },
  both: { color: '#7c3aed', label: 'Both' },
};

type Load =
  | { state: 'loading' }
  | { state: 'ok'; bloom: ApiaryBloom }
  | { state: 'hidden' } // outside North America, or no map location
  | { state: 'unavailable'; message: string };

// Absolute host only in the packaged app (it loads from a localhost scheme); web stays same-origin so the
// Preview writes to its own database.
const API = Capacitor.isNativePlatform() ? 'https://beekeeper.beektools.com/api/apiary-bloom' : '/api/apiary-bloom';

export const WhatsBlooming: React.FC<{ apiaryId: string }> = ({ apiaryId }) => {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [showNext, setShowNext] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const apiaryName = useAppStore((s) => s.selectedApiaryName);

  const fetchBloom = useCallback(async (signal?: AbortSignal) => {
    setLoad({ state: 'loading' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiaryId, sessionToken: session?.access_token }),
        signal,
      });
      const json = await res.json().catch(() => ({}));
      if (signal?.aborted) return;
      if (res.ok && json.status === 'ok') setLoad({ state: 'ok', bloom: json.bloom });
      else if (res.ok && (json.status === 'outside' || json.status === 'no_location')) setLoad({ state: 'hidden' });
      else setLoad({ state: 'unavailable', message: 'Bloom list not available right now. Try again later.' });
    } catch {
      if (!signal?.aborted) setLoad({ state: 'unavailable', message: 'Bloom list not available right now. Try again later.' });
    }
  }, [apiaryId]);

  useEffect(() => {
    const controller = new AbortController();
    setShowNext(false);
    setShowCalendar(false);
    fetchBloom(controller.signal);
    return () => controller.abort();
  }, [fetchBloom]);

  // The section sits below the charts, where nobody knew it was (Ron, 2026-10-09). A pill above the bottom
  // menu points to it until the section's top comes on screen, then gets out of the way.
  const cardRef = useRef<HTMLDivElement>(null);
  const [reached, setReached] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || load.state !== 'ok') return;
    // "Reached" means the section's top is in the upper half of the screen: a card edge peeking out just
    // above the bottom menu does not count, or the pill would hide before anyone saw the list.
    const io = new IntersectionObserver(([e]) => {
      const line = e.rootBounds?.bottom ?? window.innerHeight * 0.55;
      setReached(e.isIntersecting || e.boundingClientRect.top < line);
    }, { rootMargin: '0px 0px -45% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [load.state]);

  if (load.state === 'hidden') return null;

  const now = new Date();
  const season: SeasonName = seasonOf(now.getMonth() + 1);
  // Late fall and winter look ahead to spring; otherwise to the next season.
  const next: SeasonName = season === 'Fall' || season === 'Winter' ? 'Spring' : NEXT_SEASON[season];

  const inBloom = load.state === 'ok' ? windowList(load.bloom.plants, now).filter((r) => r.status === 'in_bloom').length : 0;

  return (
    <>
    <div ref={cardRef} className="card p-5 scroll-mt-3">
      <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-3 mb-4">
        <h3 className="text-sm uppercase font-extrabold text-[var(--color-primary)] tracking-wider flex items-center gap-2">
          <Flower2 size={16} /> What's blooming
        </h3>
        <span className="text-[11px] font-bold text-[var(--color-text-muted)]">3 weeks either side of today</span>
      </div>

      {load.state === 'loading' && (
        <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
          <RefreshCw size={12} className="animate-spin" /> Finding plants near this apiary… The first time takes a few seconds.
        </p>
      )}

      {load.state === 'unavailable' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">{load.message}</p>
          <button onClick={() => fetchBloom()} className="text-xs font-bold text-[var(--color-primary-ink)] shrink-0">Try again</button>
        </div>
      )}

      {load.state === 'ok' && (() => {
        const bloom = load.bloom;
        const rows = windowList(bloom.plants, now);
        const active = rows.some((r) => r.status !== 'finished');
        const first = firstBloomStart(bloom.plants);
        const nextRows = showNext ? seasonList(bloom.plants, next, now) : [];
        return (
          <div className="space-y-4">
            {bloom.warning && (
              <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] bg-[var(--color-primary-wash)] rounded-lg p-2.5">{bloom.warning}</p>
            )}

            {!active && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  Nothing in bloom right now.
                  {next === 'Spring' && first && <> Spring bloom usually starts around {formatMonthDay(first)} here.</>}
                </p>
                <button onClick={() => setShowNext((v) => !v)} className="text-xs font-bold text-[var(--color-primary-ink)]">
                  {showNext ? `Hide ${next.toLowerCase()}` : `Show ${next.toLowerCase()}`}
                </button>
              </div>
            )}

            {(active ? rows : nextRows).length > 0 && (
              <ul className="divide-y divide-[var(--color-divider)]">
                {(active ? rows : nextRows).map((r) => {
                  const k = KIND_STYLE[r.kind];
                  const statusText = r.status === 'finished' ? `Finished ${formatMonthDay(r.end!)}` : r.status === 'not_yet' && r.startDoy > todayDoy(now) ? `Starts ${formatMonthDay(r.start!)}` : STATUS_LABEL[r.status];
                  return (
                    <li key={r.plant} className="py-2 flex items-center gap-3">
                      <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: k.color }} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{r.plant}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          <span className="font-bold" style={{ color: k.color }}>{k.label}</span>
                          {' · '}{formatMonthDay(r.start!)} – {formatMonthDay(r.end!)}
                          {r.presence !== 'Likely' && ' · possibly nearby'}
                        </p>
                      </div>
                      <span
                        className={`text-[11px] font-bold shrink-0 text-right ${r.status === 'in_bloom' ? 'text-[var(--color-good-deep)]' : 'text-[var(--color-text-muted)]'}`}
                      >
                        {statusText}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[10px] leading-relaxed text-[var(--color-text-muted)]">
              Plants recorded within {bloom.radius_mi} miles (GBIF). Dates are for a normal year ({bloom.normal_years} weather); this year's bloom can run early or late.
            </p>

            <button onClick={() => setShowCalendar(true)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-[var(--color-primary-faint)] py-2 text-xs font-bold text-[var(--color-primary-ink)] active:scale-[0.99]">
              <CalendarDays size={14} /> See full bloom calendar
            </button>
            {/* Drawn at the page's top level so the card's styling cannot clip a full-screen view. */}
            {showCalendar && createPortal(<BloomCalendar bloom={bloom} apiaryName={apiaryName ?? 'Apiary'} onClose={() => setShowCalendar(false)} />, document.body)}
          </div>
        );
      })()}
    </div>
    {load.state === 'ok' && createPortal(
      // Fixed just above the bottom menu, measured the way BottomNavBar places itself (1.5rem + safe area
      // below, 4rem tall, 0.5rem above). A sticky version drifted up over the charts on Ron's phone.
      <div
        className="fixed inset-x-0 z-30 flex justify-center pointer-events-none"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 12px) + 4rem + 0.75rem)' }}
        aria-hidden={reached}
      >
        <button
          onClick={() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className={`flex items-center gap-1.5 rounded-full bg-[var(--color-bg-raised)] border border-[var(--color-primary-faint)] shadow-[0_4px_16px_rgba(0,0,0,0.18)] px-4 py-2 text-xs font-bold text-[var(--color-primary-ink)] transition-opacity duration-300 ${reached ? 'opacity-0' : 'opacity-100 pointer-events-auto'}`}
          tabIndex={reached ? -1 : 0}
        >
          <Flower2 size={14} />
          {inBloom > 0 ? `${inBloom} in bloom nearby` : "What's blooming"}
          <ChevronDown size={14} />
        </button>
      </div>,
      document.body
    )}
    </>
  );
};
