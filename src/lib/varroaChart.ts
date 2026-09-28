// "MITE LOAD BY SEASON (ROLLING)" geometry — FORMULAS §6. Tests are grouped by month only,
// any year (a copied quirk — FIX-LATER).

import { loadColour, periodsEndingWith } from '../../shared/varroa';

export const CHART_W = 260;
export const PLOT_H = 85;
export const LABEL_H = 25;
const COL_W = CHART_W / 6;

export interface ChartTest {
  tested_at: string;
  mite_pct: number | null;
}

export interface ChartColumn {
  label: string;
  current: boolean;
  x0: number;
  cx: number;
  threshold: number;
  thresholdY: number;
  bar: { x: number; y: number; w: number; h: number; fill: string } | null;
  dot: { cy: number; colour: string; label: string } | null;
  requeen: boolean;
}

const monthOf = (iso: string) => new Date(iso).getMonth() + 1;

export function buildVarroaChart(tests: ChartTest[], requeens: string[], now = new Date()) {
  const periods = periodsEndingWith(now.getMonth() + 1);
  const stats = periods.map(p => {
    const inside = tests.filter(t => (p.months as readonly number[]).includes(monthOf(t.tested_at)));
    if (!inside.length) return null;
    const vals = inside.map(t => Number(t.mite_pct ?? 0));
    const latest = inside.reduce((a, b) => (Date.parse(b.tested_at) > Date.parse(a.tested_at) ? b : a));
    return { count: inside.length, min: Math.min(...vals), max: Math.max(...vals), latest: Number(latest.mite_pct ?? 0) };
  });
  const maxVal = 1.25 * Math.max(...stats.map(s => s?.max ?? 0), ...periods.map(p => p.threshold), 4);
  const y = (v: number) => PLOT_H - (PLOT_H * v) / maxVal;

  const columns: ChartColumn[] = periods.map((p, i) => {
    const s = stats[i];
    const x0 = i * COL_W;
    const cx = x0 + COL_W / 2;
    let bar: ChartColumn['bar'] = null;
    if (s && s.count >= 2) {
      const top = y(s.max);
      bar = { x: cx - 7, y: top, w: 14, h: Math.max(3, y(s.min) - top), fill: s.latest >= p.threshold ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)' };
    }
    return {
      label: p.label.replace('-', '–'),
      current: i === periods.length - 1,
      x0,
      cx,
      threshold: p.threshold,
      thresholdY: y(p.threshold),
      bar,
      dot: s ? { cy: y(s.latest), colour: loadColour(s.latest, p.threshold), label: `${s.latest.toFixed(1)}%` } : null,
      requeen: requeens.some(r => (p.months as readonly number[]).includes(monthOf(r))),
    };
  });
  return { columns, colW: COL_W, maxVal, anyRequeen: columns.some(c => c.requeen) };
}
