import { describe, test, expect } from '@jest/globals';
import { interpolateDailyNDVI, smoothNDVISeries, type NDVIRecord } from '../../../../api/ndvi-fetcher';
import { computeBloomFactor, calculateTriangularValue, parseMonthDayToDoY, getDayOfYear } from '../bloomFactor';
import { computeWeatherSuitability } from '../weatherSuitability';
import { computeNectarStatus, calculateNFI, emaSeries, type Apiary, type DailyEnvironment } from '../engine';

describe('NDVI Fetcher Utility Helpers', () => {
  test('interpolateDailyNDVI handles gaps and linear interpolation', () => {
    const rawRecords: NDVIRecord[] = [
      { date: '2026-06-01', ndvi: 0.50 },
      { date: '2026-06-03', ndvi: 0.60 }
    ];
    
    const interpolated = interpolateDailyNDVI(rawRecords, '2026-06-01', '2026-06-03');
    
    expect(interpolated).toHaveLength(3);
    expect(interpolated[0]).toEqual({ date: '2026-06-01', ndvi: 0.50 });
    expect(interpolated[1]).toEqual({ date: '2026-06-02', ndvi: 0.55 }); // midpoint
    expect(interpolated[2]).toEqual({ date: '2026-06-03', ndvi: 0.60 });
  });

  test('interpolateDailyNDVI averages duplicates on the same day and clamps to [-1.0, 1.0]', () => {
    const rawRecords: NDVIRecord[] = [
      { date: '2026-06-01', ndvi: 0.40 },
      { date: '2026-06-01', ndvi: 0.60 },
      { date: '2026-06-02', ndvi: 2.50 } // out of range
    ];

    const interpolated = interpolateDailyNDVI(rawRecords, '2026-06-01', '2026-06-02');
    expect(interpolated[0]).toEqual({ date: '2026-06-01', ndvi: 0.50 }); // average
    expect(interpolated[1]).toEqual({ date: '2026-06-02', ndvi: 1.00 });  // clamped
  });

  test('smoothNDVISeries applies moving average window correctly', () => {
    const dailySeries: NDVIRecord[] = [
      { date: '2026-06-01', ndvi: 0.1 },
      { date: '2026-06-02', ndvi: 0.2 },
      { date: '2026-06-03', ndvi: 0.3 },
      { date: '2026-06-04', ndvi: 0.4 }
    ];

    const smoothed7 = smoothNDVISeries(dailySeries, '7day');
    expect(smoothed7[0].ndvi).toBeCloseTo(0.1);
    expect(smoothed7[1].ndvi).toBeCloseTo(0.15); // (0.1 + 0.2) / 2
    expect(smoothed7[2].ndvi).toBeCloseTo(0.2); // (0.1 + 0.2 + 0.3) / 3
  });
});

describe('Bloom Factor Calculation Module', () => {
  test('getDayOfYear handles basic date translation', () => {
    expect(getDayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(getDayOfYear(new Date(2026, 11, 31))).toBe(365); // 2026 is non-leap
  });

  test('parseMonthDayToDoY correctly maps MM-DD to day of year', () => {
    const doy = parseMonthDayToDoY('02-01', 2026);
    expect(doy).toBe(32); // Jan (31) + Feb 1st (1)
  });

  test('calculateTriangularValue calculates date curve intensity', () => {
    // peak = 100, start = 80, end = 120
    expect(calculateTriangularValue(80, 80, 100, 120)).toBe(0.0);
    expect(calculateTriangularValue(90, 80, 100, 120)).toBe(0.5);
    expect(calculateTriangularValue(100, 80, 100, 120)).toBe(1.0);
    expect(calculateTriangularValue(110, 80, 100, 120)).toBe(0.5);
    expect(calculateTriangularValue(121, 80, 100, 120)).toBe(0.0);
  });

  test('calculateTriangularValue handles calendar year-wrapping', () => {
    // Plant blooms from Dec 15 (349) to Jan 15 (15) with peak at Dec 31 (365)
    // 349 (0) -> 365 (1) -> 15 (0)
    expect(calculateTriangularValue(349, 349, 365, 15)).toBe(0.0);
    expect(calculateTriangularValue(357, 349, 365, 15)).toBe(0.5); // midpoint rising
    expect(calculateTriangularValue(365, 349, 365, 15)).toBe(1.0); // peak
    expect(calculateTriangularValue(5, 349, 365, 15)).toBe(0.625); // on the falling side: (381 - 371) / (381 - 365) = 10 / 16 = 0.625
    expect(calculateTriangularValue(15, 349, 365, 15)).toBe(0.0);
  });

  test('computeBloomFactor processes plant profiles and averages active sources', () => {
    const plants = [
      { name: 'A', bloom_start: '04-01', bloom_peak: '05-01', bloom_end: '06-01' },
      { name: 'B', bloom_start: '05-01', bloom_peak: '06-01', bloom_end: '07-01' }
    ];

    // On 2026-05-01 (Day 121)
    // Plant A: Peak (1.0)
    // Plant B: Start (0.0)
    // Expected average = 0.5
    const result = computeBloomFactor({
      date: '2026-05-01',
      lat: 39,
      lon: -98,
      plant_profile: plants
    });

    expect(result.bloom_factor).toBeCloseTo(0.5);
  });
});

describe('Weather Suitability Module', () => {
  test('calculates correct temperature suitability curve', () => {
    // 70 - 90 mean temperature should score 1.0
    const resultIdeal = computeWeatherSuitability({
      date: '2026-06-01', lat: 39, lon: -98,
      temperature_max: 90, temperature_min: 70, // mean = 80
      rain_last_7_days: 0.6, wind_speed_avg: 5
    });
    expect(resultIdeal.temp_suitability).toBe(1.0);

    // mean temp < 55 should score 0.3
    const resultCold = computeWeatherSuitability({
      date: '2026-06-01', lat: 39, lon: -98,
      temperature_max: 50, temperature_min: 40, // mean = 45
      rain_last_7_days: 0.6, wind_speed_avg: 5
    });
    expect(resultCold.temp_suitability).toBe(0.3);

    // mean temp 62.5 (midpoint of 55 and 70) should score 0.65
    const resultCool = computeWeatherSuitability({
      date: '2026-06-01', lat: 39, lon: -98,
      temperature_max: 70, temperature_min: 55, // mean = 62.5
      rain_last_7_days: 0.6, wind_speed_avg: 5
    });
    expect(resultCool.temp_suitability).toBeCloseTo(0.65);
  });

  test('calculates correct rain suitability and drought penalties', () => {
    // Rain >= 0.5 with no drought -> 1.0
    const resultWet = computeWeatherSuitability({
      date: '2026-06-01', lat: 39, lon: -98,
      temperature_max: 80, temperature_min: 80,
      rain_last_7_days: 0.5, wind_speed_avg: 5
    });
    expect(resultWet.rain_suitability).toBe(1.0);

    // Rain < 0.1 with USDM drought index 2 -> 0.4 * (1.0 - 2 * 0.15) = 0.4 * 0.7 = 0.28
    const resultDryDrought = computeWeatherSuitability({
      date: '2026-06-01', lat: 39, lon: -98,
      temperature_max: 80, temperature_min: 80,
      rain_last_7_days: 0.05, wind_speed_avg: 5,
      drought_index: 2
    });
    expect(resultDryDrought.rain_suitability).toBeCloseTo(0.28);
  });

  test('propagates null values and returns null weather suitability on missing data', () => {
    const resultNull = computeWeatherSuitability({
      date: '2026-06-01', lat: 39, lon: -98,
      temperature_max: null, temperature_min: null, // missing temp
      rain_last_7_days: 0.6, wind_speed_avg: 5
    });
    expect(resultNull.temp_suitability).toBeNull();
    expect(resultNull.weather_suitability).toBeNull();
  });
});

describe('Nectar Flow Detection Module (computeNectarStatus)', () => {
  const apiary: Apiary = {
    id: 'test-apiary',
    name: 'Test Yard',
    lat: 39,
    lon: -98,
    forage_radius_km: 1.6
  };

  test('exponentially smooths a rising series and flags flow building', () => {
    const history: DailyEnvironment[] = [];
    const baseDate = new Date('2026-06-01');

    for (let i = 0; i < 15; i++) {
      const d = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
      const ndvi = 0.50 + (i * 0.02); // steadily greening
      history.push({
        date: d.toISOString().slice(0, 10),
        ndvi,
        ndvi_min: 0.30,
        ndvi_max: 0.70,
        bloom_factor: 1.0,
        temp_suitability: 1.0,
        rain_suitability: 1.0,
        wind_suitability: 1.0
      });
    }

    const statuses = computeNectarStatus(apiary, history);
    expect(statuses).toHaveLength(15);

    // Exponential averaging seeds immediately — the smoothed index exists from
    // day one (no 7-day warmup), but the first day has no prior to diff against.
    expect(statuses[0].forage_index_smoothed).not.toBeNull();
    expect(statuses[0].delta_forage).toBeNull();
    expect(statuses[1].delta_forage).not.toBeNull();

    // Rising greenness under perfect weather -> index climbs and ends building flow.
    expect(statuses[14].forage_index_smoothed!).toBeGreaterThan(statuses[2].forage_index_smoothed!);
    expect(statuses[14].delta_forage!).toBeGreaterThan(0);
    expect(['FLOW_STARTING', 'IN_FLOW']).toContain(statuses[14].phase);
  });

  test('scores current greenness relative to the typical-year baseline', () => {
    const mk = (ndvi: number, typical: number, date: string): DailyEnvironment => ({
      date, ndvi, ndvi_min: 0.3, ndvi_max: 0.8, typical_ndvi: typical,
      bloom_factor: 1.0, temp_suitability: 1.0, rain_suitability: 1.0, wind_suitability: 1.0
    });

    const above: DailyEnvironment[] = [];
    const below: DailyEnvironment[] = [];
    const base = new Date('2026-05-01');
    for (let i = 0; i < 10; i++) {
      const d = new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10);
      above.push(mk(0.75, 0.55, d)); // well above the typical 0.55
      below.push(mk(0.45, 0.55, d)); // below the typical 0.55
    }

    const aLatest = computeNectarStatus(apiary, above).slice(-1)[0];
    const bLatest = computeNectarStatus(apiary, below).slice(-1)[0];
    expect(aLatest.forage_index_smoothed!).toBeGreaterThan(bLatest.forage_index_smoothed!);
  });

  test('correctly triggers phase transitions on hysteresis rules', () => {
    // Mock days where smoothed index rises and falls
    // We mock the status computations using the backward compatibility wrapper test to check rules
    
    // 1. FLOW_STARTING (smoothed > 0.40 and delta > +0.02)
    // currentNDVI = 0.70, previousNDVI = 0.50, historicalNDVI = 0.30
    const resultStarting = calculateNFI(0.70, 0.30, 0.50);
    expect(resultStarting.status).toBe('Pre-Flow'); // Pre-Flow = FLOW_STARTING

    // 2. IN_FLOW (smoothed > 0.40 and delta <= +0.02)
    // currentNDVI = 0.70, previousNDVI = 0.69, historicalNDVI = 0.30
    const resultInFlow = calculateNFI(0.70, 0.30, 0.69);
    expect(resultInFlow.status).toBe('Peak Flow'); // Peak Flow = IN_FLOW

    // 3. DEARTH (smoothed < 0.30)
    // currentNDVI = 0.32, previousNDVI = 0.32, historicalNDVI = 0.30
    const resultDearth = calculateNFI(0.32, 0.30, 0.32);
    expect(resultDearth.status).toBe('Dearth'); // Dearth = DEARTH
  });
});

describe('Exponential Moving Average helper', () => {
  test('weights the latest point most and holds through gaps', () => {
    // span 7 -> alpha = 2/8 = 0.25
    const s = emaSeries([0.2, 0.2, 0.2, 1.0], 7);
    expect(s[0]).toBeCloseTo(0.2);
    expect(s[3]).toBeCloseTo(0.4); // 0.25*1.0 + 0.75*0.2

    // Nulls hold the previous smoothed value rather than resetting.
    const withGap = emaSeries([0.5, null, 0.5], 7);
    expect(withGap[1]).toBeCloseTo(0.5);
  });
});
