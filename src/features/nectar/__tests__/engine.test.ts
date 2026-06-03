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
    // L1 score = (0.05 / 0.35) * 80 = 11.428...
    // Slope = 0.0 -> phenologyBoost = 0
    // Expected NFI = 11
    expect(result.layer1Max).toBe(80);
    expect(result.layer1Score).toBeCloseTo(11.43, 1);
    expect(result.slope).toBe(0.0);
    expect(result.phenologyBoost).toBe(0);
    expect(result.status).toBe('Stable Low');
    expect(result.nfi).toBe(11);
  });

  // Case 2: Pre-Flow / Startup (Rising Trend)
  test('applies pre-flow boost for rising vegetation trends', () => {
    const result = calculateNFI(
      0.65, // current (>= 0.45, so boost is allowed)
      0.50, // historical
      0.64  // previous (slope: +0.010 > +0.005)
    );

    // maxPossibleDelta = 0.35
    // growthDelta = 0.65 - 0.50 = 0.15
    // L1 score = (0.15 / 0.35) * 80 = 34.28
    // Slope = 0.010 -> phenologyBoost = 20
    // Expected NFI = 34 + 20 = 54
    expect(result.slope).toBeCloseTo(0.010);
    expect(result.phenologyBoost).toBe(20);
    expect(result.status).toBe('Pre-Flow');
    expect(result.nfi).toBe(54);
  });

  // Case 2b: Cold Winter / Early Rise (Gatekeeper blocks boost)
  test('blocks pre-flow boost when absolute vegetation greenness is too low', () => {
    const result = calculateNFI(
      0.40, // current (< 0.45, so boost is blocked)
      0.35, // historical
      0.39  // previous (slope: +0.010 > 0.005)
    );

    // maxPossibleDelta = 0.85 - 0.35 = 0.50
    // growthDelta = 0.40 - 0.35 = 0.05
    // L1 score = (0.05 / 0.50) * 80 = 8.0
    // Slope = 0.010 -> phenologyBoost is BLOCKED (0) because currentNDVI < 0.45
    // Expected NFI = 8 + 0 = 8
    expect(result.slope).toBeCloseTo(0.010);
    expect(result.phenologyBoost).toBe(0);
    expect(result.status).toBe('Stable Low');
    expect(result.nfi).toBe(8);
  });

  // Case 3: Flow Ending (Steep Decline)
  test('applies decline penalty when vegetation is drying up', () => {
    const result = calculateNFI(
      0.58, // current
      0.50, // historical
      0.60  // previous (slope: -0.020 < -0.010)
    );

    // maxPossibleDelta = 0.35
    // growthDelta = 0.08
    // L1 score = (0.08 / 0.35) * 80 = 18.28
    // Slope = -0.020 -> phenologyBoost = -40
    // Expected NFI = max(0, 18 - 40) = 0
    expect(result.slope).toBeCloseTo(-0.020);
    expect(result.phenologyBoost).toBe(-40);
    expect(result.status).toBe('Flow Ending');
    expect(result.nfi).toBe(0);
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
    // L1 score = (0.25 / 0.35) * 80 = 57.14 (>= 40)
    // Slope = 0 -> phenologyBoost = 0
    // Expected NFI = 57
    expect(result.layer1Score).toBeCloseTo(57.14, 1);
    expect(result.status).toBe('Peak Flow');
    expect(result.nfi).toBe(57);
  });

  // Case 5: Dearth (Low & Stable)
  test('classifies dearth when biomass is low and stable', () => {
    const result = calculateNFI(
      0.40, // current (< 0.45)
      0.50, // historical
      0.40  // previous (slope: 0)
    );

    // growthDelta = 0.40 - 0.50 = -0.10 -> 0
    // L1 score = 0
    // Slope = 0 -> phenologyBoost = 0
    // Expected NFI = 0
    expect(result.status).toBe('Dearth');
    expect(result.nfi).toBe(0);
  });
});
