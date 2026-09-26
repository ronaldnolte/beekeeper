// Varroa mite maths — FORMULAS §6, SPEC B §18. The database computes the stored mite_pct
// itself (generated column); the app must never send it.

/** HBHC seasonal threshold (%) by the test date's month (1–12). */
export function seasonalThreshold(month: number): number {
  if (month <= 3) return 1;
  if (month <= 8) return 3;
  if (month <= 10) return 2;
  return 1;
}

/** Mite load % = 100·mites/bees (0 when bees = 0). */
export const miteLoad = (mites: number, bees: number) => (bees === 0 ? 0 : (100 * mites) / bees);

export type VarroaStatus = 'Critical' | 'Above Limit' | 'OK';

export function varroaStatus(load: number, threshold: number): VarroaStatus {
  if (load >= 1.5 * threshold) return 'Critical';
  if (load >= threshold) return 'Above Limit';
  return 'OK';
}

/** Seasonal chart periods (months 1–12) and their thresholds, in calendar order. */
export const VARROA_PERIODS = [
  { label: 'Jan-Feb', months: [1, 2], threshold: 1 },
  { label: 'Mar', months: [3], threshold: 1 },
  { label: 'Apr-May', months: [4, 5], threshold: 3 },
  { label: 'Jun-Aug', months: [6, 7, 8], threshold: 3 },
  { label: 'Sep-Oct', months: [9, 10], threshold: 2 },
  { label: 'Nov-Dec', months: [11, 12], threshold: 1 },
] as const;

/** The six periods shown, ending with the one containing the current month. */
export function periodsEndingWith(month: number) {
  const k = VARROA_PERIODS.findIndex(p => (p.months as readonly number[]).includes(month));
  return [...VARROA_PERIODS.slice(k + 1), ...VARROA_PERIODS.slice(0, k + 1)];
}

/** Dot colour for the latest test in a period. */
export function loadColour(load: number, threshold: number): string {
  return load >= 1.5 * threshold ? '#EF4444' : load >= threshold ? '#F59E0B' : '#10B981';
}
