// Apiary/hive rules (SPEC B §5, §9, §10, §20).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { table: string; op: string; row?: unknown }[] = [];
vi.mock('../src/lib/supabase', () => {
  const chain = (table: string, op: string, row?: unknown) => {
    calls.push({ table, op, row });
    const c: Record<string, unknown> = {};
    c.eq = () => c;
    c.then = (res: (v: { error: null }) => unknown) => res({ error: null });
    return c;
  };
  return { supabase: { from: (t: string) => ({ insert: (row: unknown) => chain(t, 'insert', row), update: (row: unknown) => chain(t, 'update', row) }) } };
});

const { validateApiary, apiaryRow, coordinateWarning, parseBars, isLangstroth, saveHive, defaultBars } = await import('../src/lib/apiaryHiveData');

const base = { name: 'Yard', mode: 'coordinates' as const, zip: '', lat: '35', lng: '-106', notes: ' n ' };

beforeEach(() => {
  calls.length = 0;
});

describe('apiary rules', () => {
  it('validates in the spec order', () => {
    expect(validateApiary({ ...base, mode: 'postal', zip: ' ' })).toBe('Postal code is required.');
    expect(validateApiary({ ...base, lat: '' })).toBe('Both Latitude and Longitude are required when using Coordinates.');
    expect(validateApiary({ ...base, lat: 'abc' })).toBe('Coordinates must be valid numbers.');
    expect(validateApiary({ ...base, lat: '91' })).toBe('Latitude must be between -90 and 90 degrees.');
    expect(validateApiary({ ...base, lng: '-181' })).toBe('Longitude must be between -180 and 180 degrees.');
    expect(validateApiary(base)).toBeNull();
  });

  it('saving in one mode clears the other; zip is "" in coordinate mode', () => {
    expect(apiaryRow(base, 'u')).toEqual({ name: 'Yard', zip_code: '', latitude: 35, longitude: -106, notes: 'n', user_id: 'u' });
    expect(apiaryRow({ ...base, mode: 'postal', zip: ' 87105 ' }, 'u')).toMatchObject({ zip_code: '87105', latitude: null, longitude: null });
  });

  it('warns outside the continental US and offers the minus-sign fix', () => {
    expect(coordinateWarning('35', '-106')).toBeNull();
    expect(coordinateWarning('35', '106')).toEqual({ kind: 'flip', suggested: -106 });
    expect(coordinateWarning('35', '112.5')).toEqual({ kind: 'flip', suggested: -112.5 });
    expect(coordinateWarning('35', '50')).toEqual({ kind: 'outside' }); // −50 is in the Atlantic
    expect(coordinateWarning('51.5', '-0.1')).toEqual({ kind: 'outside' });
  });
});

describe('hive rules', () => {
  it('parses bars stored as JSON text or arrays', () => {
    expect(parseBars('[{"position":1,"status":"inactive"}]')).toEqual([{ position: 1, status: 'inactive' }]);
    expect(parseBars([{ id: 'a', type: 'deep' }])).toEqual([{ id: 'a', type: 'deep' }]);
    expect(parseBars('nonsense')).toBeNull();
    expect(parseBars(null)).toBeNull();
  });

  it('uses the Langstroth stack only when the type says langstroth and not long', () => {
    expect(['Langstroth', 'langstroth_10', 'langstroth_8'].map(isLangstroth)).toEqual([true, true, true]);
    expect(['long_langstroth', 'top_bar', 'Top Bar', 'layens', null].map(isLangstroth)).toEqual([false, false, false, false, false]);
  });

  it('never rewrites a stored type on edit unless a type button was tapped (Ron, 2026-09-25)', async () => {
    await saveHive({ name: ' Lang ', apiaryId: 'a1', notes: '', barCount: 30 }, 'h1');
    expect(calls[0]).toEqual({ table: 'hives', op: 'update', row: { name: 'Lang', apiary_id: 'a1', notes: '' } });
    await saveHive({ name: 'Lang', apiaryId: 'a1', notes: '', barCount: 30, type: 'Langstroth' }, 'h1');
    expect((calls[1].row as { type: string }).type).toBe('Langstroth');
  });

  it('a new top-bar hive gets N inactive bars; a new Langstroth gets none', async () => {
    await saveHive({ name: 'T', apiaryId: 'a1', notes: '', barCount: 3, type: 'Top Bar' });
    expect(calls[0].row).toMatchObject({ type: 'Top Bar', bars: defaultBars(3) });
    await saveHive({ name: 'L', apiaryId: 'a1', notes: '', barCount: 3, type: 'Langstroth' });
    expect(calls[1].row).not.toHaveProperty('bars');
  });
});
