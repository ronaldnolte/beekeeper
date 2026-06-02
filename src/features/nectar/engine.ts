/**
 * Nectar Flow Index (NFI) Calculation Engine
 */

export interface NFIBreakdown {
  nfi: number;
  ratio: number;
  layer1Score: number;
  layer1Max: number;
  delta: number;
  phenologyMultiplier: number;
  tempMultiplier: number;
  humidityMultiplier: number;
  isWashout: boolean;
}

/**
 * Calculates the Nectar Flow Index (0-100) based on satellite and weather layers.
 * 
 * @param currentNDVI Current NDVI value (typically 0.15 to 0.85)
 * @param historicalNDVI Historical baseline NDVI value (typically Jan average)
 * @param previousNDVI NDVI value from 1-2 weeks ago
 * @param tempF Current temperature in Fahrenheit
 * @param relativeHumidity Relative humidity percentage (0-100)
 * @param precipitationMm Rainfall in millimeters in the last 24h
 * @returns Comprehensive NFI calculation breakdown
 */
export function calculateNFI(
  currentNDVI: number,
  historicalNDVI: number,
  previousNDVI: number,
  tempF: number,
  relativeHumidity: number,
  _precipitationMm: number
): NFIBreakdown {
  // --- Layer 1: Biomass Base ---
  const ratio = historicalNDVI > 0 ? currentNDVI / historicalNDVI : 1.0;
  
  // Cap potential if baseline drops below 70% (0.70), but allow high absolute greenness to lift the cap
  let layer1Max = 70;
  if (historicalNDVI < 0.70) {
    const localMax = (historicalNDVI / 0.70) * 70;
    layer1Max = Math.max(localMax, Math.min(70, currentNDVI * 100));
  }
  
  const layer1Score = Math.min(ratio * 70, layer1Max);

  // --- Layer 2: Phenology Trigger ---
  const delta = currentNDVI - previousNDVI;
  let phenologyMultiplier = 1.0;
  
  if (delta > 0.03) {
    phenologyMultiplier = 1.15; // Rising flow boost
  } else if (delta < -0.05) {
    phenologyMultiplier = 0.60; // Dearth drop penalty
  }

  const baseScore = layer1Score * phenologyMultiplier;

  // --- Layer 3: Weather Gatekeeper ---
  
  // Temperature Modifiers
  // Optimal: 75°F - 88°F (multiplier 1.2)
  // Thermal shutdown: under 65°F or over 98°F (multiplier 0.2, drops score by 80%)
  // Transitions are linearly interpolated.
  let tempMultiplier = 1.0;
  if (tempF < 65 || tempF > 98) {
    tempMultiplier = 0.2;
  } else if (tempF >= 75 && tempF <= 88) {
    tempMultiplier = 1.2;
  } else if (tempF >= 65 && tempF < 75) {
    // Interpolate between 0.2 (at 65) and 1.2 (at 75)
    tempMultiplier = 0.2 + ((tempF - 65) / 10) * 1.0;
  } else if (tempF > 88 && tempF <= 98) {
    // Interpolate between 1.2 (at 88) and 0.2 (at 98)
    tempMultiplier = 1.2 - ((tempF - 88) / 10) * 1.0;
  }

  // Humidity Modifier
  // Optimal: >= 40% (no penalty)
  // Low/Dry: 20% to 40% (linearly interpolate between 0.7 and 1.0)
  // Extreme Dry: < 20% (0.7 multiplier max penalty, acknowledging desert plant adaptations)
  let humidityMultiplier = 1.0;
  if (relativeHumidity < 20) {
    humidityMultiplier = 0.7;
  } else if (relativeHumidity < 40) {
    // Interpolate between 0.7 (at 20%) and 1.0 (at 40%)
    humidityMultiplier = 0.7 + ((relativeHumidity - 20) / 20) * 0.3;
  }

  // --- Final Score Assembly ---
  const rawNFI = baseScore * tempMultiplier * humidityMultiplier;
  const nfi = Math.min(100, Math.max(0, Math.round(rawNFI)));

  return {
    nfi,
    ratio,
    layer1Score,
    layer1Max,
    delta,
    phenologyMultiplier,
    tempMultiplier,
    humidityMultiplier,
    isWashout: false
  };
}
