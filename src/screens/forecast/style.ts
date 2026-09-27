import type { Classification } from '../../../shared/forecast/scoring';

export const TIER: Record<Classification, { bg: string; label: string }> = {
  Optimal: { bg: 'bg-green-600', label: 'Optimal' },
  Viable: { bg: 'bg-primary', label: 'Viable' },
  Inadvisable: { bg: 'bg-red-500', label: 'Inadvisable' },
};

/** 6am, 12pm, 1pm … */
export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
