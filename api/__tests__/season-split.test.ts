import { describe, it, expect } from '@jest/globals';
import { dayLengthHours, daysLengthening } from '../_shared/season';

// The split that decides whether a colony gets build-up advice or store-for-winter advice.
//
// It exists because the advice used to switch on phase alone, so on 27 August 2026 a New
// Mexico beekeeper was told "Queen egg-laying is stimulated. Colony is expanding — watch for
// swarm preparations." Ron: "way off for sure."
//
// Day length rather than the calendar, because a calendar split would hand Northern
// Hemisphere autumn advice to someone in Australia in April, and because day length is what
// the bees are actually responding to.

const ABQ = 35.04;      // South Valley
const SYDNEY = -33.87;  // southern hemisphere, to prove the split is not calendar-based
const TROMSO = 69.65;   // inside the Arctic circle, where the sun does not always rise

const on = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d));

describe('dayLengthHours', () => {
  it('gives roughly twelve hours at the equinoxes', () => {
    expect(dayLengthHours(ABQ, 80)).toBeGreaterThan(11.5);   // ~21 March
    expect(dayLengthHours(ABQ, 80)).toBeLessThan(12.5);
    expect(dayLengthHours(ABQ, 266)).toBeGreaterThan(11.5);  // ~23 September
    expect(dayLengthHours(ABQ, 266)).toBeLessThan(12.5);
  });

  it('is longest at midsummer and shortest at midwinter', () => {
    const midsummer = dayLengthHours(ABQ, 172);
    const midwinter = dayLengthHours(ABQ, 355);
    expect(midsummer).toBeGreaterThan(14);
    expect(midwinter).toBeLessThan(10);
  });

  it('is mirrored in the southern hemisphere', () => {
    // June is midwinter in Sydney.
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

  it('reads autumn and winter in New Mexico as storing', () => {
    expect(daysLengthening(on(9, 15), ABQ)).toBe(false);
    expect(daysLengthening(on(11, 1), ABQ)).toBe(false);
  });

  it('turns at the solstices', () => {
    expect(daysLengthening(on(6, 10), ABQ)).toBe(true);    // before midsummer
    expect(daysLengthening(on(7, 5), ABQ)).toBe(false);    // after
    expect(daysLengthening(on(12, 10), ABQ)).toBe(false);  // before midwinter
    expect(daysLengthening(on(1, 5), ABQ)).toBe(true);     // after
  });

  it('is reversed south of the equator', () => {
    // The whole reason this is day length and not a calendar month. August in Sydney is
    // build-up; the same date in Albuquerque is not.
    expect(daysLengthening(on(8, 27), SYDNEY)).toBe(true);
    expect(daysLengthening(on(8, 27), ABQ)).toBe(false);
    expect(daysLengthening(on(4, 15), SYDNEY)).toBe(false);
  });

  it('still resolves inside the Arctic circle', () => {
    // Day length is pinned at 0 or 24 for part of the year there, so the comparison has to
    // be made over enough days to see a change rather than a flat pair.
    expect(typeof daysLengthening(on(4, 15), TROMSO)).toBe('boolean');
    expect(daysLengthening(on(4, 15), TROMSO)).toBe(true);
    expect(daysLengthening(on(10, 15), TROMSO)).toBe(false);
  });
});
