// The full bloom calendar (bloom plan step 5): Ron's sample chart E:\Bloom\bloom_calendar.html (made by
// bloomCalendar.mjs) rebuilt as an app screen. One row per nearby plant ordered by start, a bar for its
// normal-year bloom across the year, a line for today, an asterisk on plants whose dates come from fewer or
// rougher records, and a table view. Phones cannot hover, so a tap on a row opens its details instead of the
// sample's hover box. Colours as in the "What's blooming" section (both = purple, not the sample's green).
import React, { useState } from 'react';
import { X, CalendarDays } from 'lucide-react';
import {
  type ApiaryBloom,
  type BloomKind,
  STATUS_LABEL,
  bloomStatus,
  doyOf,
  formatMonthDay,
  todayDoy,
} from './bloomStatus';

const KIND: Record<BloomKind, { color: string; label: string }> = {
  nectar: { color: '#2a78d6', label: 'Nectar' },
  pollen: { color: '#d95926', label: 'Pollen' },
  both: { color: '#7c3aed', label: 'Nectar and pollen' },
};
const TODAY_COLOR = '#e34948';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TRIGGER: Record<string, string> = { GDD: 'heat (moves with the season)', LOD: 'day length (fixed dates)' };

const pct = (doy: number) => `${(((doy - 1) / 365) * 100).toFixed(2)}%`;

export const BloomCalendar: React.FC<{ bloom: ApiaryBloom; apiaryName: string; onClose: () => void }> = ({ bloom, apiaryName, onClose }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const now = new Date();
  const year = now.getFullYear(), today = todayDoy(now);
  const monthStarts = MONTHS.map((_, i) => doyOf(year, `${String(i + 1).padStart(2, '0')}-01`));
  const plants = bloom.plants
    .filter((p) => p.start && p.end)
    .map((p) => {
      const s = doyOf(year, p.start!), e = doyOf(year, p.end!);
      return { ...p, s, e, status: bloomStatus(today, s, e), wide: p.presence === 'Possible (wider area)', star: p.confidence === 'low' };
    })
    .sort((a, b) => a.s - b.s);
  const anyStar = plants.some((p) => p.star);

  const grid = (
    <>
      {monthStarts.map((d) => <i key={d} className="absolute inset-y-0 w-px bg-[var(--color-divider)]" style={{ left: pct(d) }} />)}
      <i className="absolute inset-y-0 w-0.5 z-[2]" style={{ left: pct(today), backgroundColor: TODAY_COLOR }} />
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col" role="dialog" aria-modal="true" aria-label="Bloom calendar">
      <div
        className="flex items-center justify-between gap-3 px-4 pb-3 border-b border-[var(--color-divider)] bg-[var(--color-bg-raised)]"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px) + var(--test-strip-h, 0px))' }}
      >
        <h2 className="text-base font-black flex items-center gap-2 min-w-0">
          <CalendarDays size={18} className="text-[var(--color-primary)] shrink-0" />
          <span className="truncate">{apiaryName} — bloom calendar</span>
        </h2>
        <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-divider)] active:scale-95" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-3">
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
          Expected bloom seasons in a normal year ({bloom.normal_years} weather) for {plants.length} plants recorded within {bloom.radius_mi} miles.
          Estimates, not measurements; this year's bloom can run early or late. Tap a plant for details.
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[var(--color-text-muted)]">
          {(Object.keys(KIND) as BloomKind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><i className="inline-block w-3.5 h-2.5 rounded-sm" style={{ backgroundColor: KIND[k].color }} />{KIND[k].label}</span>
          ))}
          <span className="flex items-center gap-1.5"><i className="inline-block w-3.5 h-2.5 rounded-sm border-2 border-dashed border-[var(--color-text-muted)]" />Wider area only</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-0.5 h-3" style={{ backgroundColor: TODAY_COLOR }} />Today</span>
        </div>

        {bloom.warning && (
          <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] bg-[var(--color-primary-wash)] rounded-lg p-2.5">{bloom.warning}</p>
        )}

        <div className="card px-2.5 py-2">
          {/* Month heading: initials on a phone, short names when there is room. */}
          <div className="grid grid-cols-[104px_1fr] sm:grid-cols-[180px_1fr] items-center h-5">
            <div />
            <div className="relative h-full text-[10px] text-[var(--color-text-muted)]">
              {monthStarts.map((d, i) => (
                <span key={d} className="absolute top-0.5 translate-x-0.5" style={{ left: pct(d) }}>
                  <span className="hidden sm:inline">{MONTHS[i]}</span><span className="sm:hidden">{MONTHS[i][0]}</span>
                </span>
              ))}
            </div>
          </div>

          {plants.map((p) => {
            const k = KIND[p.kind];
            const isOpen = open === p.plant;
            return (
              <div key={p.plant}>
                <button
                  onClick={() => setOpen(isOpen ? null : p.plant)}
                  className="w-full grid grid-cols-[104px_1fr] sm:grid-cols-[180px_1fr] items-center min-h-[22px] text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[11px] sm:text-xs truncate pr-2">
                    {p.plant}{p.star && '*'}
                  </span>
                  <span className="relative h-[22px] block">
                    {grid}
                    <span
                      className="absolute top-[5px] h-3 rounded z-[1]"
                      style={{
                        left: pct(p.s),
                        width: `${Math.max(0.6, ((p.e - p.s) / 365) * 100).toFixed(2)}%`,
                        ...(p.wide ? { border: `2px dashed ${k.color}` } : { backgroundColor: k.color }),
                        outline: isOpen ? '2px solid var(--color-text)' : undefined,
                        outlineOffset: 1,
                      }}
                    />
                  </span>
                </button>
                {isOpen && (
                  <div className="ml-1 mb-2 mt-1 rounded-lg bg-[var(--color-bg)] p-2.5 text-[11px] leading-relaxed space-y-0.5">
                    <p className="font-bold text-xs">{p.plant}{p.star && '*'} <span className="font-normal italic text-[var(--color-text-muted)]">{p.scientific}</span></p>
                    <p>{formatMonthDay(p.start!)} – {formatMonthDay(p.end!)} (peak {formatMonthDay(peakMd(year, p.s, p.e))}) · Today: {STATUS_LABEL[p.status].toLowerCase()}</p>
                    <p><span className="font-bold" style={{ color: k.color }}>{k.label}</span> · nectar {p.nectar}/3, pollen {p.pollen}/3</p>
                    <p className="text-[var(--color-text-muted)]">
                      {p.presence === 'Likely' ? 'Recorded nearby' : p.wide ? 'Recorded in the wider area only' : 'Possibly nearby (few records)'} · bloom set by {TRIGGER[p.trigger] ?? p.trigger}
                    </p>
                    {p.note && <p className="text-[var(--color-text-muted)]">{p.note}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {anyStar && (
          <p className="text-[11px] text-[var(--color-text-muted)]">* Bloom dates estimated from fewer records; actual timing may differ by a few weeks.</p>
        )}

        <button onClick={() => setShowTable((v) => !v)} className="text-xs font-bold text-[var(--color-primary-ink)]">
          {showTable ? 'Hide table view' : `Table view (${plants.length} plants)`}
        </button>
        {showTable && (
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-[11px] sm:text-xs border-collapse">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)]">
                  {['Plant', 'Start', 'End', 'Yield', 'Area', 'Today'].map((h) => <th key={h} className="px-2 py-1.5 font-semibold border-b border-[var(--color-divider)]">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {plants.map((p) => (
                  <tr key={p.plant} className="border-b border-[var(--color-divider)]">
                    <td className="px-2 py-1.5">{p.plant}{p.star && '*'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatMonthDay(p.start!)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{formatMonthDay(p.end!)}</td>
                    <td className="px-2 py-1.5" style={{ color: KIND[p.kind].color }}>{p.kind === 'both' ? 'Both' : KIND[p.kind].label}</td>
                    <td className="px-2 py-1.5">{p.presence === 'Likely' ? 'nearby' : p.wide ? 'wider area' : 'possible'}</td>
                    <td className="px-2 py-1.5">{STATUS_LABEL[p.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/** Month-day of the middle of a bloom window. */
function peakMd(year: number, s: number, e: number): string {
  const d = new Date(Date.UTC(year, 0, Math.round((s + e) / 2)));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
