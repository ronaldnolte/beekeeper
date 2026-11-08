import { describe, it, expect } from '@jest/globals';
import { planFetch, mergeReadings, REFETCH_OVERLAP_DAYS, type SavedReadings } from '../_nectar-readings';

const scene = (date: string, v = 0.5) => ({ date, ndvi: v, evi: v, ndwi: v });
const wx = (t: number) => ({ tmax: t, tmin: t - 20, dew: 30 });

function saved(over: Partial<SavedReadings> = {}): SavedReadings {
  return {
    builtLat: 35.0123, builtLon: -106.6543,
    coveredFrom: '2021-01-01', fetchedThrough: '2026-11-01',
    scenes: [scene('2021-01-05'), scene('2025-06-01'), scene('2026-10-20', 0.1), scene('2026-10-30', 0.1)],
    passDates: ['2021-01-05', '2025-06-01', '2026-10-20', '2026-10-25', '2026-10-30'],
    weather: { '2021-01-01': wx(40), '2026-10-15': wx(60), '2026-10-31': wx(1), '2026-11-01': wx(2) },
    ...over,
  };
}

describe('planFetch', () => {
  it('does a full fetch when nothing is saved', () => {
    expect(planFetch(null, 35, -106, '2021-01-01')).toEqual({ mode: 'full', fetchFrom: '2021-01-01', reason: 'none-saved' });
  });

  it('does a full fetch when the apiary has moved', () => {
    const p = planFetch(saved(), 35.0124, -106.6543, '2021-01-01');
    expect(p).toMatchObject({ mode: 'full', reason: 'moved' });
  });

  it('treats coordinates equal to 4 decimal places as the same spot', () => {
    expect(planFetch(saved(), 35.01231, -106.65429, '2021-01-01').mode).toBe('recent');
  });

  it('does a full fetch when the window starts before the saved copy', () => {
    expect(planFetch(saved(), 35.0123, -106.6543, '2020-01-01')).toMatchObject({ mode: 'full', reason: 'window-earlier' });
  });

  it('otherwise fetches from three weeks before the last fetch', () => {
    const p = planFetch(saved(), 35.0123, -106.6543, '2021-01-01');
    expect(REFETCH_OVERLAP_DAYS).toBe(21);
    expect(p).toEqual({ mode: 'recent', fetchFrom: '2026-10-11' });
  });

  it('after New Year the window moves forward and still reuses the saved copy', () => {
    const p = planFetch(saved({ fetchedThrough: '2026-12-31' }), 35.0123, -106.6543, '2022-01-01');
    expect(p).toEqual({ mode: 'recent', fetchFrom: '2026-12-10' });
  });
});

describe('mergeReadings', () => {
  const fresh = {
    scenes: [scene('2026-10-20', 0.9), scene('2026-10-30', 0.9), scene('2026-11-05', 0.9)],
    passDates: ['2026-10-20', '2026-10-30', '2026-11-05'],
    weather: { '2026-10-31': wx(70), '2026-11-07': wx(71) },
  };

  it('replaces saved scenes from the fetch date on, without counting any twice', () => {
    const m = mergeReadings(saved(), fresh, '2026-10-11', '2021-01-01');
    expect(m.scenes.map(s => [s.date, s.ndvi])).toEqual([
      ['2021-01-05', 0.5], ['2025-06-01', 0.5],
      ['2026-10-20', 0.9], ['2026-10-30', 0.9], ['2026-11-05', 0.9],
    ]);
  });

  it('drops a saved pass that the fresh fetch no longer reports, keeps older passes', () => {
    const m = mergeReadings(saved(), fresh, '2026-10-11', '2021-01-01');
    expect(m.passDates).toEqual(['2021-01-05', '2025-06-01', '2026-10-20', '2026-10-30', '2026-11-05']);
  });

  it('lays fresh weather over saved weather, keeping saved days the fetch missed', () => {
    const m = mergeReadings(saved(), fresh, '2026-10-11', '2021-01-01');
    expect(m.weather['2026-10-31']).toEqual(wx(70));   // revised
    expect(m.weather['2026-11-01']).toEqual(wx(2));    // fetch missed it: kept
    expect(m.weather['2026-11-07']).toEqual(wx(71));   // new
    expect(m.weather['2026-10-15']).toEqual(wx(60));   // older: untouched
  });

  it('drops everything before the window start (the oldest year falls off)', () => {
    const m = mergeReadings(saved(), fresh, '2026-10-11', '2022-01-01');
    expect(m.scenes[0].date).toBe('2025-06-01');
    expect(m.passDates[0]).toBe('2025-06-01');
    expect(m.weather['2021-01-01']).toBeUndefined();
  });
});
