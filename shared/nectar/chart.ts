// Nectar chart maths (client) — FORMULAS §4. Input: the API's full_history (3-dp values).

import { clamp } from './math';

export interface HistoryPoint {
  date: string;
  forage_index_smoothed: number;
  phase: string;
}

const DAY = 86_400_000;

/** §4.1 chart day of year: 0-based, UTC, clamped 0–364 (leap-year 31 Dec shares 364). */
export function chartDayOfYear(date: string): number {
  const y = +date.slice(0, 4);
  const t = Date.UTC(y, +date.slice(5, 7) - 1, +date.slice(8, 10));
  return clamp(Math.floor((t - Date.UTC(y, 0, 1)) / DAY), 0, 364);
}

export interface ChartModel {
  currentYear: number;
  baseYearLabel: string;
  /** Normal (blue line) by chart day; days with no samples are absent. */
  normal: Map<number, { normal: number; samples: number }>;
  current: { date: string; day: number; value: number; phase: string }[];
  yAxisMax: number;
  difference: { date: string; day: number; current: number; normal: number; difference: number; seasonToDate: number }[];
  differenceSpan: number | null;
  seasonToDate: number | null;
  seasonToDateSpan: number | null;
  seasonToDateCaption: string | null;
}

export function buildChartModel(history: readonly HistoryPoint[]): ChartModel | null {
  if (history.length === 0) return null;

  // §4.2 years and labels
  const years = [...new Set(history.map(h => +h.date.slice(0, 4)))].sort((a, b) => a - b);
  const currentYear = years[years.length - 1];
  const historical = years.slice(0, -1);
  const baseYearLabel =
    historical.length > 1
      ? `${historical[0]}-${historical[historical.length - 1]} Avg`
      : String(historical[0] ?? currentYear - 1);

  // §4.3 normal: mean over historical-year entries per chart day
  const sums = new Map<number, { sum: number; n: number }>();
  const current: ChartModel['current'] = [];
  for (const h of history) {
    const y = +h.date.slice(0, 4);
    const day = chartDayOfYear(h.date);
    if (y === currentYear) current.push({ date: h.date, day, value: h.forage_index_smoothed, phase: h.phase });
    else {
      const s = sums.get(day) ?? { sum: 0, n: 0 };
      s.sum += h.forage_index_smoothed;
      s.n++;
      sums.set(day, s);
    }
  }
  const normal = new Map<number, { normal: number; samples: number }>();
  [...sums.keys()].sort((a, b) => a - b).forEach(d => {
    const s = sums.get(d)!;
    normal.set(d, { normal: s.sum / s.n, samples: s.n });
  });

  // §4.4 y axis
  const m = Math.max(...[...normal.values()].map(v => v.normal), ...current.map(c => c.value), 0.2);
  const t = 1.1 * m;
  const yAxisMax = t <= 0.2 ? 0.2 : t <= 0.4 ? 0.4 : t <= 0.6 ? 0.6 : t <= 0.8 ? 0.8 : 1.0;

  // §4.5 difference and §4.6 season to date
  const difference: ChartModel['difference'] = [];
  let running = 0;
  for (const c of current) {
    const n = normal.get(c.day);
    if (!n) continue;
    const diff = c.value - n.normal;
    running += 100 * diff;
    difference.push({ date: c.date, day: c.day, current: c.value, normal: n.normal, difference: diff, seasonToDate: running });
  }
  const enough = difference.length >= 2;
  const maxAbsDiff = Math.max(0, ...difference.map(d => Math.abs(d.difference)));
  const maxAbsRun = Math.max(0, ...difference.map(d => Math.abs(d.seasonToDate)));
  const seasonToDate = enough ? Math.round(running) : null;

  return {
    currentYear,
    baseYearLabel,
    normal,
    current,
    yAxisMax,
    difference,
    differenceSpan: enough ? Math.max(0.1, Math.ceil(10 * maxAbsDiff) / 10) : null,
    seasonToDate,
    seasonToDateSpan: enough ? Math.ceil(Math.max(maxAbsRun, 1) / 50) * 50 : null,
    seasonToDateCaption:
      seasonToDate === null ? null : seasonToDate >= 0 ? 'running above a normal year' : 'running below a normal year',
  };
}

/** §4.7 "Trend" percent in the details panel. */
export function trendPercent(slope: number): string {
  if (Math.abs(slope) <= 0.002) return '0.0%';
  return `${slope > 0 ? '+' : ''}${(100 * slope).toFixed(1)}%`;
}
