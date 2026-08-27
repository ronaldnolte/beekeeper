import { describe, it, expect } from '@jest/globals';
import {
  satelliteStrength, applySatellite, combineSeries, DEFAULT_SATELLITE_FLOOR,
} from '../combineIndex';

describe('satelliteStrength', () => {
  it('is 1 when the ground is fully green and fully watered', () => {
    expect(satelliteStrength({ vigor: 1, moisture: 1, decline: 0 })).toBeCloseTo(1, 6);
  });

  it('is 0 when there is no growth and no canopy water', () => {
    // Moisture arrives from the engine already compressed into 0.7-1.0, so 0.7 is its floor.
    expect(satelliteStrength({ vigor: 0, moisture: 0.7, decline: 0 })).toBeCloseTo(0, 6);
  });

  it('re-expands moisture so it cannot dominate by never being small', () => {
    // Without re-expansion, moisture 0.7 would read as 0.7 and drag a dead site to 0.35.
    const dead = satelliteStrength({ vigor: 0, moisture: 0.7, decline: 0 });
    expect(dead).toBeLessThan(0.05);
  });

  it('lets green-but-dry and dry-but-green land in the middle', () => {
    expect(satelliteStrength({ vigor: 1, moisture: 0.7, decline: 0 })).toBeCloseTo(0.5, 6);
    expect(satelliteStrength({ vigor: 0, moisture: 1.0, decline: 0 })).toBeCloseTo(0.5, 6);
  });

  it('clamps readings outside the expected range', () => {
    expect(satelliteStrength({ vigor: 5, moisture: 5, decline: 0 })).toBeCloseTo(1, 6);
    expect(satelliteStrength({ vigor: -3, moisture: 0, decline: 0 })).toBeCloseTo(0, 6);
  });

  // The signal that gets flow ENDINGS right, and the reason this function was rewritten.
  it('cuts a green, watered landscape that is browning off', () => {
    const holding = satelliteStrength({ vigor: 1, moisture: 1, decline: 0 });
    const fading  = satelliteStrength({ vigor: 1, moisture: 1, decline: 0.5 });
    const gone    = satelliteStrength({ vigor: 1, moisture: 1, decline: 1 });
    expect(holding).toBeCloseTo(1, 6);
    expect(fading).toBeCloseTo(0.5, 6);
    expect(gone).toBeCloseTo(0, 6);
  });

  it('does NOT punish a plateau', () => {
    // Alfalfa in steady full bloom produces no green-up at all. Scoring that as weak is the
    // blind spot that made greenness-level scoring useless, so decline must be the signal
    // rather than the greening rate: flat ground is not declining ground.
    expect(satelliteStrength({ vigor: 0.9, moisture: 1, decline: 0 })).toBeGreaterThan(0.9);
  });

  it('treats a missing decline as not declining', () => {
    // Production's endpoint predates this field and must keep working.
    expect(satelliteStrength({ vigor: 1, moisture: 1 } as never)).toBeCloseTo(1, 6);
  });
});

describe('applySatellite', () => {
  const good = { vigor: 1, moisture: 1, decline: 0 };
  const bad = { vigor: 0, moisture: 0.7, decline: 0 };

  it('leaves a bloom untouched when the ground is green and watered', () => {
    expect(applySatellite(2.0, good, 0.4)).toBeCloseTo(2.0, 6);
  });

  it('cuts to the floor, and no further, when the ground is dead', () => {
    // The bound that matters: a cloudy stretch or a bad pixel must not erase a flow the
    // beekeeper can watch happening in the yard.
    expect(applySatellite(2.0, bad, 0.4)).toBeCloseTo(0.8, 6);
    expect(applySatellite(2.0, bad, 0.7)).toBeCloseTo(1.4, 6);
  });

  it('can zero the number when given full authority', () => {
    expect(applySatellite(2.0, bad, 0)).toBeCloseTo(0, 6);
  });

  it('is disabled at a floor of 1', () => {
    expect(applySatellite(2.0, bad, 1)).toBeCloseTo(2.0, 6);
  });

  it('passes the bloom through untouched when there is no reading at all', () => {
    // A missing satellite observation is not evidence of a missing flow.
    expect(applySatellite(2.0, null, 0)).toBeCloseTo(2.0, 6);
  });

  it('never increases a bloom above what the plant list says', () => {
    for (const v of [0, 0.3, 0.7, 1]) {
      for (const m of [0.7, 0.85, 1]) {
        expect(applySatellite(1.5, { vigor: v, moisture: m, decline: 0 }, 0.4)).toBeLessThanOrEqual(1.5 + 1e-9);
      }
    }
  });

  it('defaults to a floor that bites but does not erase', () => {
    expect(DEFAULT_SATELLITE_FLOOR).toBeGreaterThan(0);
    expect(DEFAULT_SATELLITE_FLOOR).toBeLessThan(1);
    expect(applySatellite(1, bad)).toBeCloseTo(DEFAULT_SATELLITE_FLOOR, 6);
  });
});

describe('combineSeries', () => {
  const bloom = [
    { date: '2026-06-01', potential: 2.0 },
    { date: '2026-06-02', potential: 2.0 },
    { date: '2026-06-03', potential: 2.0 },
  ];

  it('joins on date and reports the factor it used', () => {
    const out = combineSeries(bloom, [
      { date: '2026-06-01', vigor: 1, moisture: 1, decline: 0 },
      { date: '2026-06-02', vigor: 0, moisture: 0.7, decline: 0 },
    ], 0.4);

    expect(out[0].combined).toBeCloseTo(2.0, 6);
    expect(out[0].factor).toBeCloseTo(1, 6);
    expect(out[1].combined).toBeCloseTo(0.8, 6);
    expect(out[1].factor).toBeCloseTo(0, 6);
  });

  it('leaves days with no satellite reading untouched', () => {
    // The satellite record starts at its first usable scene and can have cloudy gaps.
    const out = combineSeries(bloom, [{ date: '2026-06-01', vigor: 1, moisture: 1, decline: 0 }], 0.4);
    expect(out[2].combined).toBeCloseTo(2.0, 6);
    expect(out[2].factor).toBeNull();
  });

  it('ignores satellite rows missing either reading', () => {
    const out = combineSeries(bloom, [
      { date: '2026-06-01', vigor: 0.5 },
      { date: '2026-06-02', moisture: 0.9 },
    ], 0.4);
    expect(out[0].factor).toBeNull();
    expect(out[1].factor).toBeNull();
  });

  it('always keeps the untouched bloom value alongside the combined one', () => {
    const out = combineSeries(bloom, [{ date: '2026-06-01', vigor: 0, moisture: 0.7, decline: 0 }], 0);
    expect(out[0].combined).toBeCloseTo(0, 6);
    expect(out[0].bloom).toBeCloseTo(2.0, 6);
  });
});
