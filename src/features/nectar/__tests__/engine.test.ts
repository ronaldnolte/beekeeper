import { describe, test, expect } from '@jest/globals';
import { calculateNFI } from '../engine';

describe('Nectar Flow Index Calculation Engine', () => {
  // Case 1: Standard Stable Low/Moderate State (No trend)
  test('calculates standard stable state correctly', () => {
    const result = calculateNFI(
      0.55, // current (MA)
      0.50, // historical (Jan baseline)
      0.55  // previous (MA) (slope: 0.0)
    );

    // maxPossibleDelta = 0.85 - 0.50 = 0.35
    // growthDelta = 0.55 - 0.50 = 0.05
    // Expected NFI = Math.round((0.05 / 0.35) * 100) = 14
    expect(result.layer1Max).toBe(100);
    expect(result.slope).toBe(0.0);
    expect(result.status).toBe('Stable Low');
    expect(result.nfi).toBe(14);
  });

  // Case 2: Pre-Flow / Startup (Rising Trend)
  test('applies pre-flow status for rising vegetation trends', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.64  // previous (slope: +0.010 > +0.005)
    );

    // maxPossibleDelta = 0.35
    // growthDelta = 0.65 - 0.50 = 0.15
    // Expected NFI = Math.round((0.15 / 0.35) * 100) = 43
    expect(result.slope).toBeCloseTo(0.010);
    expect(result.status).toBe('Pre-Flow');
    expect(result.nfi).toBe(43);
  });

  // Case 2b: Cold Winter / Early Rise (Classified as Dearth due to absolute low level)
  test('classifies as Dearth when absolute vegetation greenness is too low', () => {
    const result = calculateNFI(
      0.40, // current (< 0.45, so classified as Dearth)
      0.35, // historical
      0.39  // previous (slope: +0.010)
    );

    // maxPossibleDelta = 0.85 - 0.35 = 0.50
    // growthDelta = 0.40 - 0.35 = 0.05
    // Expected NFI = Math.round((0.05 / 0.50) * 100) = 10
    expect(result.slope).toBeCloseTo(0.010);
    expect(result.status).toBe('Dearth');
    expect(result.nfi).toBe(10);
  });

  // Case 3: Flow Ending (Steep Decline)
  test('applies flow ending status when vegetation is drying up', () => {
    const result = calculateNFI(
      0.58, // current
      0.50, // historical
      0.60  // previous (slope: -0.020 < -0.010)
    );

    // maxPossibleDelta = 0.35
    // growthDelta = 0.08
    // Expected NFI = Math.round((0.08 / 0.35) * 100) = 23
    expect(result.slope).toBeCloseTo(-0.020);
    expect(result.status).toBe('Flow Ending');
    expect(result.nfi).toBe(23);
  });

  // Case 4: Peak Flow (High & Stable)
  test('classifies peak flow when biomass is high and stable', () => {
    const result = calculateNFI(
      0.75, // current
      0.50, // historical
      0.75  // previous (slope: 0)
    );

    // maxPossibleDelta = 0.35
    // growthDelta = 0.25
    // Expected NFI = Math.round((0.25 / 0.35) * 100) = 71 (>= 50)
    expect(result.status).toBe('Peak Flow');
    expect(result.nfi).toBe(71);
  });

  // Case 5: Dearth (Low & Stable)
  test('classifies dearth when biomass is low and stable', () => {
    const result = calculateNFI(
      0.40, // current (< 0.45)
      0.50, // historical
      0.40  // previous (slope: 0)
    );

    // growthDelta = 0.40 - 0.50 = -0.10 -> 0
    // Expected NFI = 0
    expect(result.status).toBe('Dearth');
    expect(result.nfi).toBe(0);
  });
});
