// Deliberate change #10: the forecast grid shows the hours the sun is up.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
const { daylightHours } = await import('../src/screens/forecast/ForecastScreen');

describe('forecast daylight rows', () => {
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  it('drops the dark sunrise hour and keeps the last hour before sunset', () => {
    // Sunrise 6:59, sunset 18:55 (Albuquerque, late September).
    expect(daylightHours(hours, ['2026-09-29T06:59', '2026-09-30T07:00'], ['2026-09-29T18:55', '2026-09-30T18:54'])).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });
  it('keeps an hour when the sun is up at its start on any day', () => {
    expect(daylightHours([6, 7], ['2026-06-01T05:58', '2026-06-02T06:01'], ['2026-06-01T20:20', '2026-06-02T20:21'])).toEqual([6, 7]);
  });
  it('never empties the grid', () => {
    expect(daylightHours([3, 4], ['2026-01-01T07:10'], ['2026-01-01T17:10'])).toEqual([3, 4]);
  });
});
