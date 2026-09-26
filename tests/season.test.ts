import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dayLengthHours, daysLengthening, fallCentre } from '../shared/nectar/season';

const golden = JSON.parse(readFileSync(join(__dirname, 'golden/season/season-helpers.json'), 'utf8'));

describe('season helpers (golden/season)', () => {
  it('day length', () => {
    for (const c of golden.dayLength) {
      expect(Math.abs(dayLengthHours(c.lat, c.doy) - c.dayLengthHours), `${c.lat} ${c.doy}`).toBeLessThan(1e-9);
    }
  });
  it('days lengthening', () => {
    for (const c of golden.daysLengthening) expect(daysLengthening(c.date, c.lat), `${c.date} ${c.lat}`).toBe(c.daysLengthening);
  });
  it('fall bloom centre', () => {
    for (const c of golden.fallCenter) expect(fallCentre(c.lat), String(c.lat)).toBe(c.fallCenterDayOfYear);
  });
});
