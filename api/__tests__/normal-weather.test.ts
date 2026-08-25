import { describe, it, expect } from '@jest/globals';
import { withNormals, isLeapYear } from '../_shared/normal';
import { expectedDayCount, isComplete, type WeatherDay } from '../_shared/weather';

const DAY_MS = 86_400_000;

/** Every day from start to end inclusive. */
function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(start + 'T00:00:00Z'); t <= Date.parse(end + 'T00:00:00Z'); t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

describe('isLeapYear', () => {
  it('follows the century rules', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });
});

describe('withNormals — leap years', () => {
  // Value encodes the month-day so a mispairing is visible in the number itself.
  const encode = (d: string) => Number(d.slice(5, 7)) * 100 + Number(d.slice(8, 10));

  it('compares 1 March against 1 March, not 2 March', () => {
    // The bug this replaces: day-of-year put 2024-03-01 (leap, doy 61) in the same bucket
    // as 2023-03-02, shifting every date after February for ten months of the year.
    const dates = daysBetween('2023-01-01', '2025-12-31');
    const values = dates.map(encode);
    const out = withNormals(dates, values);

    const i = dates.indexOf('2025-03-01');
    // Prior years contributing are 2023-03-01 and 2024-03-01, both encoding 301.
    expect(out[i].normal).toBeCloseTo(301, 6);
    expect(out[i].deviation).toBeCloseTo(0, 6);
    expect(out[i].normalYears).toBe(2);
  });

  it('keeps every date paired correctly across a leap year', () => {
    const dates = daysBetween('2023-01-01', '2025-12-31');
    const values = dates.map(encode);
    const out = withNormals(dates, values);

    // Any current-year day with history must deviate by exactly zero, because the encoded
    // value depends only on month-day. A non-zero deviation anywhere means a mispairing.
    let checked = 0;
    dates.forEach((d, i) => {
      if (!d.startsWith('2025')) return;
      if (out[i].normal == null) return;
      expect(out[i].deviation).toBeCloseTo(0, 6);
      checked++;
    });
    expect(checked).toBeGreaterThan(360);
  });

  it('drops 29 February from history when the current year has none', () => {
    // The beekeeper's rule: no substituting 28 February, no pairing with a day that did
    // not happen. 2024 has a 29th; 2025 does not, so it contributes nothing.
    const dates = daysBetween('2024-01-01', '2025-12-31');
    const values = dates.map(encode);
    const out = withNormals(dates, values);

    const leapDay = dates.indexOf('2024-02-29');
    expect(leapDay).toBeGreaterThan(-1);
    expect(out[leapDay].normal).toBeNull();
    expect(out[leapDay].normalYears).toBe(0);

    // And it must not have leaked into 28 February or 1 March.
    const feb28 = dates.indexOf('2025-02-28');
    expect(out[feb28].normal).toBeCloseTo(228, 6);
    const mar1 = dates.indexOf('2025-03-01');
    expect(out[mar1].normal).toBeCloseTo(301, 6);
  });

  it('keeps 29 February in history when the current year has one', () => {
    const dates = daysBetween('2020-01-01', '2024-12-31');
    const values = dates.map(encode);
    const out = withNormals(dates, values);

    const i = dates.indexOf('2024-02-29');
    // 2020 is the only prior leap year in range.
    expect(out[i].normal).toBeCloseTo(229, 6);
    expect(out[i].normalYears).toBe(1);
  });
});

describe('weather completeness', () => {
  const mk = (dates: string[]): Record<string, WeatherDay> =>
    Object.fromEntries(dates.map(d => [d, { tmax: 70, tmin: 50, dew: 45 }]));

  it('counts calendar days inclusively, including the leap day', () => {
    expect(expectedDayCount('2025-01-01', '2025-01-01')).toBe(1);
    expect(expectedDayCount('2025-01-01', '2025-12-31')).toBe(365);
    expect(expectedDayCount('2024-01-01', '2024-12-31')).toBe(366);
  });

  it('accepts a whole series', () => {
    const d = daysBetween('2021-01-01', '2025-12-31');
    expect(isComplete(mk(d), '2021-01-01', '2025-12-31')).toBe(true);
  });

  it('tolerates the archive lagging by a couple of days', () => {
    const d = daysBetween('2021-01-01', '2025-12-29');
    expect(isComplete(mk(d), '2021-01-01', '2025-12-31')).toBe(true);
  });

  it('rejects a badly short series rather than computing on it', () => {
    // An index built on 401 of 1826 days is garbage that looks fine.
    const d = daysBetween('2021-01-01', '2022-02-05');
    expect(isComplete(mk(d), '2021-01-01', '2025-12-31')).toBe(false);
  });

  it('rejects an empty response', () => {
    expect(isComplete({}, '2021-01-01', '2025-12-31')).toBe(false);
  });
});
