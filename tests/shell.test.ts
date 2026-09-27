// App-shell rules that are easy to break without noticing (SPEC A §3–§6).
import { describe, expect, it } from 'vitest';
import { backTarget, headerTitle } from '../src/app/views';
import { PALETTES, paletteFor } from '../src/components/HeaderLandscape';

describe('in-app back map (SPEC A §6)', () => {
  it('follows the fixed map', () => {
    expect(backTarget('SELECT_HIVE', true)).toBe('DASHBOARD');
    expect(backTarget('SELECT_HIVE', false)).toBe('SELECT_APIARY');
    expect(backTarget('HIVE_DETAIL', true)).toBe('SELECT_HIVE');
    expect(backTarget('INSPECTION_PLUS', true)).toBe('INSPECTION_FORM');
    for (const v of ['INSPECTION_FORM', 'INTERVENTION_FORM', 'VARROA_FORM', 'TASK_FORM'] as const) expect(backTarget(v, true)).toBe('HIVE_DETAIL');
    for (const v of ['FORECAST', 'NECTAR_FLOW', 'ASK_AI', 'ROADMAP', 'PROFILE', 'UPDATE_PASSWORD'] as const) expect(backTarget(v, true)).toBe('DASHBOARD');
  });
});

describe('header titles (SPEC A §3)', () => {
  it('uses the table, and "Beekeeper" where there is no entry', () => {
    expect(headerTitle('SELECT_HIVE', true)).toBe('My Hives');
    expect(headerTitle('SELECT_HIVE', false)).toBe('Hives');
    expect(headerTitle('PROFILE', false)).toBe('Your Profile');
    expect(headerTitle('INSPECTION_PLUS', false)).toBe('Beekeeper');
    expect(headerTitle('VARROA_FORM', false)).toBe('Beekeeper');
  });
});

describe('header palette (SPEC A §4)', () => {
  const at = (month: number, hour: number) => paletteFor(new Date(2026, month, 15, hour));
  it('is dusk from 20:00 to before 06:00 whatever the month', () => {
    expect(at(6, 20)).toBe(PALETTES.dusk);
    expect(at(0, 5)).toBe(PALETTES.dusk);
    expect(at(0, 6)).toBe(PALETTES.winter);
  });
  it('follows northern-hemisphere months otherwise', () => {
    expect([11, 0, 1].map(m => at(m, 12))).toEqual([PALETTES.winter, PALETTES.winter, PALETTES.winter]);
    expect([2, 3, 4].map(m => at(m, 12))).toEqual([PALETTES.spring, PALETTES.spring, PALETTES.spring]);
    expect([5, 6, 7].map(m => at(m, 12))).toEqual([PALETTES.monsoon, PALETTES.monsoon, PALETTES.monsoon]);
    expect([8, 9, 10].map(m => at(m, 19))).toEqual([PALETTES.autumn, PALETTES.autumn, PALETTES.autumn]);
  });
});
