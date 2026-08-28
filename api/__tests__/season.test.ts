import { describe, it, expect } from '@jest/globals';
import { dayLengthHours, daysLengthening, chartDayOfYear, MONTH_STARTS, MONTH_LABELS } from '../_season';

// Two presentation defects, both measured before they were fixed.
//
// 1. Advice switched on the nectar phase alone, so in late August a New Mexico beekeeper
//    was told "Queen egg-laying is stimulated. Colony is expanding — watch for swarm
//    preparations." Spring advice, in autumn.
// 2. Chart month labels were spread evenly edge to edge by flexbox while the data was
//    plotted at its true day-of-year fraction. The error grew through the year and reached
//    a full month by December, so late August read as the start of the month.

const ABQ = 35.04;      // South Valley
const SYDNEY = -33.87;  // southern hemisphere: proves the split is not calendar-based
const TROMSO = 69.65;   // inside the Arctic circle: the sun does not always rise

const on = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d));

describe('dayLengthHours', () => {
  it('gives roughly twelve hours at the equinoxes', () => {
    expect(dayLengthHours(ABQ, 80)).toBeGreaterThan(11.5);
    expect(dayLengthHours(ABQ, 80)).toBeLessThan(12.5);
    expect(dayLengthHours(ABQ, 266)).toBeGreaterThan(11.5);
    expect(dayLengthHours(ABQ, 266)).toBeLessThan(12.5);
  });

  it('is longest at midsummer and shortest at midwinter', () => {
    expect(dayLengthHours(ABQ, 172)).toBeGreaterThan(14);
    expect(dayLengthHours(ABQ, 355)).toBeLessThan(10);
  });

  it('is mirrored south of the equator', () => {
    expect(dayLengthHours(SYDNEY, 172)).toBeLessThan(11);
    expect(dayLengthHours(SYDNEY, 355)).toBeGreaterThan(13);
  });

  it('handles polar day and polar night without producing nonsense', () => {
    expect(dayLengthHours(TROMSO, 172)).toBeCloseTo(24, 1);
    expect(dayLengthHours(TROMSO, 355)).toBeCloseTo(0, 1);
  });
});

describe('daysLengthening', () => {
  it('is the case that started this: late August in New Mexico is NOT build-up', () => {
    expect(daysLengthening(on(8, 27), ABQ)).toBe(false);
  });

  it('reads spring in New Mexico as build-up', () => {
    expect(daysLengthening(on(4, 15), ABQ)).toBe(true);
    expect(daysLengthening(on(5, 20), ABQ)).toBe(true);
  });

  it('turns at the solstices', () => {
    expect(daysLengthening(on(6, 10), ABQ)).toBe(true);
    expect(daysLengthening(on(7, 5), ABQ)).toBe(false);
    expect(daysLengthening(on(12, 10), ABQ)).toBe(false);
    expect(daysLengthening(on(1, 5), ABQ)).toBe(true);
  });

  it('is reversed south of the equator', () => {
    // The whole reason this is day length and not a calendar month.
    expect(daysLengthening(on(8, 27), SYDNEY)).toBe(true);
    expect(daysLengthening(on(8, 27), ABQ)).toBe(false);
  });

  it('still resolves inside the Arctic circle', () => {
    expect(daysLengthening(on(4, 15), TROMSO)).toBe(true);
    expect(daysLengthening(on(10, 15), TROMSO)).toBe(false);
  });
});

describe('month axis positions', () => {
  const plotFraction = (month: number, day: number) =>
    Math.floor((Date.UTC(2025, month - 1, day) - Date.UTC(2025, 0, 1)) / 86_400_000) / 365;
  const labelFraction = (i: number) => MONTH_STARTS[i] / 365;
  const evenlySpaced = (i: number) => i / 11;   // the old flex layout

  it('puts every label exactly where the first of that month plots', () => {
    MONTH_LABELS.forEach((_, i) => {
      expect(labelFraction(i)).toBeCloseTo(plotFraction(i + 1, 1), 10);
    });
  });

  it('MONTH_STARTS matches a real calendar', () => {
    MONTH_STARTS.forEach((doy, i) => {
      const d = new Date(Date.UTC(2025, 0, 1 + doy));
      expect(d.getUTCMonth()).toBe(i);
      expect(d.getUTCDate()).toBe(1);
    });
  });

  it('fixes a drift that reached three weeks by August', () => {
    const wrongBy = (evenlySpaced(7) - labelFraction(7)) * 365;
    expect(wrongBy).toBeGreaterThan(19);
    expect(wrongBy).toBeLessThan(21);
  });

  it('was nearly a month out by December', () => {
    expect((evenlySpaced(11) - labelFraction(11)) * 365).toBeGreaterThan(29);
  });

  it('reads late August as late August, not the start of the month', () => {
    const throughAugust =
      (plotFraction(8, 25) - labelFraction(7)) / (labelFraction(8) - labelFraction(7));
    expect(throughAugust).toBeGreaterThan(0.7);
  });
});

describe('chartDayOfYear', () => {
  // The bug Ron spotted: a notch in the chart in March and a step in late October.
  // Reproduced here with the old local-time arithmetic, so the fix is demonstrated rather
  // than asserted. Uses the process timezone, so it only proves anything where DST exists —
  // hence the guard.
  const localVersion = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const diff = new Date(y, m - 1, d).getTime() - new Date(y, 0, 1).getTime();
    return Math.min(364, Math.max(0, Math.floor(diff / 86_400_000)));
  };

  const janOffset = new Date(2026, 0, 1).getTimezoneOffset();
  const julOffset = new Date(2026, 6, 1).getTimezoneOffset();
  const observesDst = janOffset !== julOffset;

  it('advances by exactly one per day across a daylight-saving boundary', () => {
    // March 2026: DST starts on the 8th in the US.
    for (let d = 1; d < 20; d++) {
      const a = chartDayOfYear(`2026-03-${String(d).padStart(2, '0')}`);
      const b = chartDayOfYear(`2026-03-${String(d + 1).padStart(2, '0')}`);
      expect(b - a).toBe(1);
    }
  });

  it('advances by exactly one per day when the clocks go back', () => {
    // November 2026: DST ends on the 1st in the US.
    for (let d = 1; d < 15; d++) {
      const a = chartDayOfYear(`2026-11-${String(d).padStart(2, '0')}`);
      const b = chartDayOfYear(`2026-11-${String(d + 1).padStart(2, '0')}`);
      expect(b - a).toBe(1);
    }
  });

  it('is stable for the whole year, which the local-time version was not', () => {
    let localGaps = 0;
    for (let doy = 0; doy < 364; doy++) {
      const d1 = new Date(Date.UTC(2026, 0, 1 + doy)).toISOString().slice(0, 10);
      const d2 = new Date(Date.UTC(2026, 0, 2 + doy)).toISOString().slice(0, 10);
      expect(chartDayOfYear(d2) - chartDayOfYear(d1)).toBe(1);
      if (localVersion(d2) - localVersion(d1) !== 1) localGaps++;
    }
    if (observesDst) {
      // Two discontinuities a year: one in spring, one in autumn. Exactly what was on screen.
      expect(localGaps).toBeGreaterThan(0);
    }
  });

  it('starts at zero and clamps at the end of the year', () => {
    expect(chartDayOfYear('2026-01-01')).toBe(0);
    expect(chartDayOfYear('2026-12-31')).toBe(364);
    expect(chartDayOfYear('2024-12-31')).toBe(364);   // leap year, clamped
  });
});
