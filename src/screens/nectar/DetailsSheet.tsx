// "Behind this number" — SPEC C §3.8 (screenshots B08, B09).

import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Minus, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { trendPercent, type ChartModel } from '../../../shared/nectar/chart';
import type { NectarResponse } from './data';

const pctRound = (v: number) => `${Math.round(v * 100)}%`;

/** Date as the original shows it: parsed from YYYY-MM-DD (UTC) but displayed in local time,
 *  so it can read a day early west of UTC — kept on purpose (QUESTIONS #7). */
const weeklyDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-wider text-text-muted">{label}</p>
      <div className="text-2xl font-black text-text tabular-nums leading-8">{children}</div>
    </div>
  );
}

export function DetailsSheet({ open, onClose, data, model }: { open: boolean; onClose: () => void; data: NectarResponse; model: ChartModel }) {
  const [expanded, setExpanded] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [tips, setTips] = useState(false);
  const { v2, slope } = data;

  const up = slope > 0.002;
  const down = slope < -0.002;
  const TrendIcon = up ? TrendingUp : down ? TrendingDown : Minus;
  const trendColour = up ? 'text-good-deep' : down ? 'text-bad' : 'text-text';

  const weekly = model.current.filter((_, i, all) => i % 7 === 0 || i === all.length - 1);

  const rows: [string, number][] = [
    ['Greenness (NDVI/EVI)', v2.greenness],
    ['Vigor (above baseline)', v2.vigor],
    ['Moisture (NDWI)', v2.moisture],
    ['Rate norm (core signal)', v2.rate_norm],
    ['Fall term (photo×dew)', v2.fall_term],
    ['Warmth gate (14d temp)', v2.warmth],
  ];
  // Vigor is deliberately not a bar: it does not feed the index (SCAR S-NEC-21).
  const bars: [string, number, string, string][] = [
    ['Greenness', v2.greenness, '#10b981', 'NDVI/EVI fusion'],
    ['Moisture', v2.moisture, '#0ea5e9', 'NDWI canopy water'],
    ['Rate (core)', v2.rate_norm, '#f59e0b', 'greening velocity'],
    ['Fall term', v2.fall_term, '#f97316', 'photoperiod × dewpoint'],
    ['Warmth', v2.warmth, '#ef4444', '14-day mean temp ramp'],
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Behind this number" variant="plain" maxHeight="85vh">
      <div className="px-4 pb-6 space-y-4">
        <div className="rounded-[20px] bg-[#f8f6f2] shadow-sm p-5">
          <button type="button" onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-3 pb-4 border-b border-divider" aria-expanded={expanded}>
            <Activity size={20} className="text-primary" />
            <span className="flex-1 text-left font-black uppercase tracking-widest text-primary">Today at a glance</span>
            {expanded ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
          </button>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-4">
            <Stat label="Nectar index">{data.nfi}</Stat>
            <Stat label="Trend">
              <span className={`flex items-center gap-2 ${trendColour}`}>
                <TrendIcon size={22} />
                {trendPercent(slope)}
              </span>
            </Stat>
            <Stat label="Greening rate">{pctRound(v2.rate_norm)}</Stat>
            <Stat label="Warmth">{pctRound(v2.warmth)}</Stat>
          </div>

          {expanded && (
            <div className="mt-5 border-t border-divider">
              {rows.map(([label, v]) => (
                <div key={label} className="flex justify-between py-3 border-b border-divider">
                  <span className="text-text">{label}</span>
                  <span className="font-black tabular-nums">{pctRound(v)}</span>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={() => setWeeklyOpen(o => !o)} className="w-full flex items-center justify-between px-2 pt-2" aria-expanded={weeklyOpen}>
            <span className="text-sm font-black uppercase tracking-wider text-text-muted">{model.currentYear} weekly values</span>
            {weeklyOpen ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
          </button>
          {weeklyOpen && (
            <div className="mt-3 rounded-2xl border border-divider bg-white/70 px-3">
              {weekly.map(w => (
                <div key={w.date} className="flex justify-between py-2.5 border-b border-divider last:border-b-0">
                  <span>{weeklyDate(w.date)}</span>
                  <span className="font-black tabular-nums">{pctRound(w.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[20px] bg-[#f8f6f2] shadow-sm p-5">
          <button type="button" onClick={() => setTips(t => !t)} className="w-full flex items-center gap-3 pb-4 border-b border-divider" aria-expanded={tips}>
            <Sparkles size={20} className="text-primary" />
            <span className="flex-1 text-left font-black uppercase tracking-widest text-primary">Index components</span>
            {tips ? <ChevronUp size={20} className="text-text-muted" /> : <ChevronDown size={20} className="text-text-muted" />}
          </button>
          <div className="pt-4 space-y-3">
            {bars.map(([label, v, colour, tip]) => (
              <div key={label}>
                <div className="flex justify-between items-baseline">
                  <span className="font-bold text-text">
                    {label}
                    {tips && <span className="ml-2 text-xs font-normal text-text-muted">{tip}</span>}
                  </span>
                  <span className="font-black text-primary tabular-nums">{pctRound(v)}</span>
                </div>
                <div className="mt-1.5 h-2.5 rounded-full bg-divider overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, v * 100))}%`, background: colour }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
