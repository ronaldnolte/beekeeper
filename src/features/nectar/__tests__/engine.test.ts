import { describe, test, expect } from '@jest/globals';
import { calculateNFI } from '../engine';

describe('Nectar Flow Index Calculation Engine', () => {
  // Case 1: Standard Optimal Day (No modifiers except normal temp boost)
  test('calculates optimal standard day correctly', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical (Jan baseline)
      0.64, // previous (neutral delta: 0.01)
      80,   // tempF (optimal: multiplier 1.2)
      50,   // relativeHumidity (normal)
      0.0   // precipitation (none)
    );

    // L1 ratio = 0.65/0.50 = 1.3
    // L1 max = (0.50/0.70) * 70 = 50 points
    // L1 score = min(1.3 * 70, 50) = 50 points
    // Phenology = 1.0 (neutral delta)
    // Temp multiplier = 1.2 (80F)
    // Humidity multiplier = 1.0 (50% RH)
    // Expected NFI = 50 * 1.0 * 1.2 * 1.0 = 60
    expect(result.layer1Max).toBeCloseTo(50);
    expect(result.layer1Score).toBeCloseTo(50);
    expect(result.phenologyMultiplier).toBe(1.0);
    expect(result.tempMultiplier).toBe(1.2);
    expect(result.humidityMultiplier).toBe(1.0);
    expect(result.isWashout).toBe(false);
    expect(result.nfi).toBe(60);
  });

  // Case 2: Nectar Surge / Rising Flow (Phenology Boost)
  test('applies nectar surge phenology boost', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.61, // previous (delta: +0.04 > +0.03)
      80,   // tempF
      50,   // relativeHumidity
      0.0   // precipitation
    );

    // L1 score = 50
    // Phenology = 1.15
    // Temp = 1.2
    // Expected raw = 50 * 1.15 * 1.2 = 69
    expect(result.phenologyMultiplier).toBe(1.15);
    expect(result.nfi).toBe(69);
  });

  // Case 3: Nectar Dearth (Phenology Decline)
  test('applies nectar dearth phenology penalty', () => {
    const result = calculateNFI(
      0.58, // current
      0.50, // historical
      0.64, // previous (delta: -0.06 < -0.05)
      80,   // temp
      50,   // humidity
      0.0   // rain
    );

    // Ratio = 0.58 / 0.50 = 1.16
    // L1 max = 50
    // L1 score = min(1.16 * 70, 50) = 50
    // Phenology = 0.60
    // Temp = 1.2
    // Expected raw = 50 * 0.60 * 1.2 = 36
    expect(result.phenologyMultiplier).toBe(0.60);
    expect(result.nfi).toBe(36);
  });

  // Case 4: Extreme Heatwave (Thermal Shutdown)
  test('applies thermal shutdown penalty for extreme heat', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.64, // previous
      100,  // tempF (shutdown: > 98F)
      50,   // relativeHumidity
      0.0   // precipitation
    );

    // L1 score = 50
    // Temp multiplier = 0.2 (80% drop)
    // Expected NFI = 50 * 1.0 * 0.2 * 1.0 = 10
    expect(result.tempMultiplier).toBe(0.2);
    expect(result.nfi).toBe(10);
  });

  // Case 5: Freezing / Cold Foraging Block
  test('applies thermal shutdown penalty for cold temperatures', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.64, // previous
      60,   // tempF (shutdown: < 65F)
      50,   // relativeHumidity
      0.0   // precipitation
    );

    expect(result.tempMultiplier).toBe(0.2);
    expect(result.nfi).toBe(10);
  });

  // Case 6: Transition Temp Linear Interpolation (Sub-optimal range)
  test('linearly interpolates transition temperatures', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.64, // previous
      70,   // tempF (halfway between 65F [0.2] and 75F [1.2])
      50,   // relativeHumidity
      0.0   // precipitation
    );

    // Expected tempMultiplier = 0.7
    // Expected raw = 50 * 1.0 * 0.7 * 1.0 = 35
    expect(result.tempMultiplier).toBeCloseTo(0.7);
    expect(result.nfi).toBe(35);
  });

  // Case 7: Nectar Drying Penalty (Low Humidity)
  test('applies penalty if relative humidity is below 35%', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.64, // previous
      80,   // tempF
      30,   // relativeHumidity (< 35%)
      0.0   // precipitation
    );

    // L1 score = 50
    // Temp multiplier = 1.2
    // Humidity multiplier = 0.5
    // Expected NFI = 50 * 1.0 * 1.2 * 0.5 = 30
    expect(result.humidityMultiplier).toBe(0.5);
    expect(result.nfi).toBe(30);
  });

  // Case 8: Foraging Washout (Rain > 2mm)
  test('returns 0 NFI score during rain washout', () => {
    const result = calculateNFI(
      0.65, // current
      0.50, // historical
      0.64, // previous
      80,   // tempF
      50,   // relativeHumidity
      2.5   // precipitation (washout: > 2.0mm)
    );

    expect(result.isWashout).toBe(true);
    expect(result.nfi).toBe(0);
  });

  // Case 9: Lush area without L1 cap
  test('allows full potential in lush areas (baseline >= 0.7)', () => {
    const result = calculateNFI(
      0.77, // current
      0.70, // historical (Jan baseline >= 0.70)
      0.77, // previous
      80,   // tempF
      50,   // humidity
      0.0   // rain
    );

    // Ratio = 0.77 / 0.7 = 1.1
    // L1 max = 70 (no cap)
    // L1 score = min(1.1 * 70, 70) = 70 points
    // Expected raw = 70 * 1.2 = 84
    expect(result.layer1Max).toBe(70);
    expect(result.layer1Score).toBe(70);
    expect(result.nfi).toBe(84);
  });
});
