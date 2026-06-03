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

    // L1 ratio = 0.55/0.50 = 1.1
    // L1 max = max((0.50/0.70) * 70, min(70, 0.55*100)) = max(50, 55) = 55 points
    // L1 score = min(1.1 * 70, 55) = 55 points
    // Slope = 0.0 -> phenologyBoost = 0
    // Expected NFI = 55 + 0 = 55
    expect(result.layer1Max).toBeCloseTo(55);
    expect(result.layer1Score).toBeCloseTo(55);
    expect(result.slope).toBe(0.0);
    expect(result.phenologyBoost).toBe(0);
    expect(result.status).toBe('Stable Low');
    expect(result.nfi).toBe(55);
  });

  // Case 2: Pre-Flow / Startup (Rising Trend)
  test('applies pre-flow boost for rising vegetation trends', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.64  // previous (slope: +0.010 > +0.005)
    );

    // L1 score = 65
    // Slope = 0.010 -> phenologyBoost = 20
    // Expected NFI = 65 + 20 = 85
    expect(result.slope).toBeCloseTo(0.010);
    expect(result.phenologyBoost).toBe(20);
    expect(result.status).toBe('Pre-Flow');
    expect(result.nfi).toBe(85);
  });

  // Case 3: Flow Ending (Steep Decline)
  test('applies decline penalty when vegetation is drying up', () => {
    const result = calculateNFI(
      0.58, // current
      0.50, // historical
      0.60  // previous (slope: -0.020 < -0.010)
    );

    // Ratio = 0.58 / 0.50 = 1.16
    // L1 max = max((0.50/0.70) * 70, min(70, 58)) = max(50, 58) = 58
    // L1 score = min(1.16 * 70, 58) = 58
    // Slope = -0.020 -> phenologyBoost = -40
    // Expected NFI = 58 - 40 = 18
    expect(result.slope).toBeCloseTo(-0.020);
    expect(result.phenologyBoost).toBe(-40);
    expect(result.status).toBe('Flow Ending');
    expect(result.nfi).toBe(18);
  });

  // Case 4: Peak Flow (High & Stable)
  test('classifies peak flow when biomass is high and stable', () => {
    const result = calculateNFI(
      0.75, // current
      0.50, // historical
      0.75  // previous (slope: 0)
    );

    // Ratio = 0.75 / 0.50 = 1.5 (> 1.25)
    // L1 max = 70
    // L1 score = 70
    // Slope = 0 -> phenologyBoost = 0
    // Expected NFI = 70 + 0 = 70
    expect(result.ratio).toBeCloseTo(1.5);
    expect(result.status).toBe('Peak Flow');
    expect(result.nfi).toBe(70);
  });

  // Case 5: Dearth (Low & Stable)
  test('classifies dearth when biomass is low and stable', () => {
    const result = calculateNFI(
      0.40, // current (< 0.45)
      0.50, // historical
      0.40  // previous (slope: 0)
    );

    // Ratio = 0.40 / 0.50 = 0.8
    // L1 max = max(50, 40) = 50
    // L1 score = min(0.8 * 70, 50) = 50
    // Expected NFI = 50
    expect(result.status).toBe('Dearth');
    expect(result.nfi).toBe(50);
  });
});
