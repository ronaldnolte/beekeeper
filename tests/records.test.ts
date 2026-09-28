// Varroa season chart (FORMULAS §6) and task rules (SPEC B §2–§3).
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
const { buildVarroaChart } = await import('../src/lib/varroaChart');
const { defaultDueDay, dueDateIso, placeLine, taskScope, thresholdForDay } = await import('../src/lib/records');

describe('varroa season chart', () => {
  // Screenshot B33: three tests, viewed in September.
  const tests = [
    { tested_at: '2026-03-12T18:00:00Z', mite_pct: 1.67 },
    { tested_at: '2025-11-12T18:00:00Z', mite_pct: 1.33 },
    { tested_at: '2025-06-11T18:00:00Z', mite_pct: 1.0 },
  ];
  const chart = buildVarroaChart(tests, [], new Date('2026-09-25T12:00:00Z'));

  it('shows six periods ending with the current one', () => {
    expect(chart.columns.map(c => c.label)).toEqual(['Nov–Dec', 'Jan–Feb', 'Mar', 'Apr–May', 'Jun–Aug', 'Sep–Oct']);
    expect(chart.columns.map(c => c.current)).toEqual([false, false, false, false, false, true]);
  });

  it('scales to 1.25 × max(maxima, thresholds, 4)', () => {
    expect(chart.maxVal).toBe(5);
    expect(chart.columns[3].thresholdY).toBeCloseTo(85 - (85 * 3) / 5, 9);
    expect(chart.columns[0].thresholdY).toBeCloseTo(68, 9);
  });

  it('dots the latest test with its colour and 1-dp label; no bar for a single test', () => {
    const [novDec, janFeb, mar, , junAug] = chart.columns;
    expect(novDec.dot).toMatchObject({ colour: '#F59E0B', label: '1.3%' });
    expect(mar.dot).toMatchObject({ colour: '#EF4444', label: '1.7%' });
    expect(junAug.dot).toMatchObject({ colour: '#10B981', label: '1.0%' });
    expect(janFeb.dot).toBeNull();
    expect(chart.columns.every(c => c.bar === null)).toBe(true);
    expect(mar.cx).toBeCloseTo(2.5 * (260 / 6), 9);
  });

  it('draws a range bar for 2+ tests (min height 3) and groups months across years', () => {
    const c = buildVarroaChart(
      [
        { tested_at: '2024-03-02T18:00:00Z', mite_pct: 0.5 },
        { tested_at: '2026-03-20T18:00:00Z', mite_pct: 0.52 },
      ],
      ['2023-03-15T18:00:00Z'],
      new Date('2026-09-25T12:00:00Z'),
    ).columns[2];
    expect(c.bar).toMatchObject({ w: 14, h: 3, fill: 'rgba(16,185,129,0.2)' });
    expect(c.dot?.label).toBe('0.5%');
    expect(c.requeen).toBe(true);
  });
});

describe('tasks', () => {
  it('derives scope hive → apiary → user; edit keeps the stored one', () => {
    expect(taskScope('h', 'a')).toBe('hive');
    expect(taskScope(null, 'a')).toBe('apiary');
    expect(taskScope(null, null)).toBe('user');
    expect(taskScope('h', null, 'general')).toBe('general');
  });

  it('stores due dates at 00:00 UTC, defaults to today + 7', () => {
    expect(dueDateIso('2026-10-02')).toBe('2026-10-02T00:00:00.000Z');
    expect(dueDateIso('')).toBeNull();
    expect(defaultDueDay(new Date(2026, 8, 25, 15))).toBe('2026-10-02');
  });

  it('names the place', () => {
    expect(placeLine({ apiaryName: 'A', hiveName: 'H' })).toBe('A / H');
    expect(placeLine({ apiaryName: null, hiveName: 'H' })).toBe('H');
    expect(placeLine({ apiaryName: 'A', hiveName: null })).toBe('A');
    expect(placeLine({ apiaryName: null, hiveName: null })).toBe('General Task');
  });

  it('takes the varroa threshold from the chosen day', () => {
    expect(thresholdForDay('2026-03-31')).toBe(1);
    expect(thresholdForDay('2026-04-01')).toBe(3);
    expect(thresholdForDay('2026-09-25')).toBe(2);
    expect(thresholdForDay('2026-12-01')).toBe(1);
  });
});
