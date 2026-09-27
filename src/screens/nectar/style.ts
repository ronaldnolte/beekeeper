// Nectar colours and labels (SPEC C §3, SCAR S-NEC-20: In Flow is green, never gold).

import type { Phase } from './data';

export const PHASE_COLOUR: Record<Phase, string> = {
  IN_FLOW: '#2ECC71',
  TRENDING_UP: '#58D68D',
  TRENDING_DOWN: '#1E8449',
  DEARTH: '#E74C3C',
};
export const UNKNOWN_COLOUR = '#95A5A6';
export const phaseColour = (p: string | undefined) => (p && p in PHASE_COLOUR ? PHASE_COLOUR[p as Phase] : UNKNOWN_COLOUR);

export const PHASE_LABEL: Record<Phase, string> = {
  IN_FLOW: 'In Flow',
  TRENDING_UP: 'Trending Up',
  TRENDING_DOWN: 'Trending Down',
  DEARTH: 'Dearth',
};
export const PHASE_EMOJI: Record<Phase, string> = { IN_FLOW: '🌼', TRENDING_UP: '🌱', TRENDING_DOWN: '🍂', DEARTH: '🏜️' };

/** Chip colours: Dearth is #C0392B with white text (5.4:1); dark fills keep white text. */
export function chipStyle(p: Phase): { background: string; color: string } {
  if (p === 'DEARTH') return { background: '#C0392B', color: '#FFFFFF' };
  if (p === 'TRENDING_DOWN') return { background: PHASE_COLOUR[p], color: '#FFFFFF' };
  return { background: PHASE_COLOUR[p], color: '#10131a' };
}

export const NORMAL_BLUE = '#2563eb';
export const PANEL = { bg: '#0f0f20', border: '#222240', strip: '#121226', grid: '#222240', zero: '#5b5b7a', label: '#8b8fb5' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Mon D" of a YYYY-MM-DD, as a UTC calendar date. */
export function monDay(date: string): string {
  return `${MONTHS[+date.slice(5, 7) - 1]} ${+date.slice(8, 10)}`;
}
/** "Mon D" for a 0-based chart day, on the non-leap reference year. */
export function monDayOfChartDay(day: number): string {
  const d = new Date(Date.UTC(2025, 0, 1) + day * 86_400_000).toISOString().slice(0, 10);
  return monDay(d);
}
export const pct = (v: number | null | undefined) => (v == null ? 'N/A' : `${Math.round(v * 100)}%`);
