// The app's day-by-day status must match the Bloom workshop's: replay the parity fixtures (built on
// 2026-10-08) and compare every plant's status with the scripts' table.

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { bloomStatus, doyOf, seasonList, seasonOf, windowList, STATUS_LABEL, type BloomPlant } from '../bloomStatus';

const DIR = join(__dirname, '..', '..', '..', '..', 'api', '__tests__', 'fixtures', 'bloom');
const fixtures = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')));

const plant = (start: string | null, end: string | null, name = 'x'): BloomPlant =>
  ({ plant: name, presence: 'Likely', trigger: 'GDD', start, end, note: '', scientific: '', kind: 'both', nectar: 2, pollen: 2 });

describe('bloom status', () => {
  it('matches the workshop status for every plant on 2026-10-08', () => {
    let checked = 0;
    for (const fx of fixtures) {
      const today = doyOf(2026, fx.asOf.slice(5));
      for (const r of fx.expectedTable.plants) {
        if (!r.start) continue;
        const label = STATUS_LABEL[bloomStatus(today, doyOf(2026, r.start.slice(5)), doyOf(2026, r.end.slice(5)))];
        expect(`${r.plant}: ${label}`).toBe(`${r.plant}: ${r.status}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it('uses calendar seasons', () => {
    expect([1, 2, 3, 5, 6, 8, 9, 11, 12].map(seasonOf)).toEqual(['Winter', 'Winter', 'Spring', 'Spring', 'Summer', 'Summer', 'Fall', 'Fall', 'Winter']);
  });

  it('lists plants overlapping the season, current bloom first', () => {
    const now = new Date(2026, 9, 8); // 8 October
    const rows = seasonList([plant('03-01', '04-15', 'spring only'), plant('09-20', '11-10', 'asters'), plant('08-01', '09-10', 'late summer'), plant('10-12', '11-25', 'late fall'), plant(null, null, 'never')], 'Fall', now);
    expect(rows.map((r) => `${r.plant} ${r.status}`)).toEqual(['asters in_bloom', 'late fall starting_soon', 'late summer finished']);
  });

  it('winter takes in both ends of the year', () => {
    const now = new Date(2026, 0, 15);
    const rows = seasonList([plant('02-10', '03-20', 'early'), plant('12-05', '12-30', 'december'), plant('04-01', '05-01', 'spring')], 'Winter', now);
    expect(rows.map((r) => r.plant).sort()).toEqual(['december', 'early']);
  });

  it('shows 3 weeks either side of today', () => {
    const now = new Date(2026, 3, 20); // 20 April
    const rows = windowList([
      plant('03-06', '03-28', 'finished 3+ weeks ago'),
      plant('03-27', '04-17', 'just finished'),
      plant('04-09', '04-30', 'in bloom'),
      plant('05-08', '05-30', 'starts within 3 weeks'),
      plant('05-24', '08-25', 'starts after 3 weeks'),
    ], now);
    expect(rows.map((r) => `${r.plant} ${r.status}`)).toEqual(['in bloom in_bloom', 'starts within 3 weeks not_yet', 'just finished finished']);
  });

  it('the window crosses New Year', () => {
    const late = windowList([plant('01-05', '02-20', 'january')], new Date(2026, 11, 25));
    expect(late.map((r) => `${r.plant} ${r.status}`)).toEqual(['january not_yet']);
    const early = windowList([plant('12-01', '12-28', 'december')], new Date(2026, 0, 10));
    expect(early.map((r) => `${r.plant} ${r.status}`)).toEqual(['december finished']);
  });
});
