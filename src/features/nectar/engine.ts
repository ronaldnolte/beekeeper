/**
 * Nectar Flow Index (NFI) Calculation Engine
 */

export interface NFIBreakdown {
  nfi: number;
  ratio: number;
  layer1Score: number;
  layer1Max: number;
  slope: number;
  phenologyBoost: number;
  status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low';
  transitionAdvice: string;
}

/**
 * Calculates the Nectar Flow Index (0-100) based on satellite NDVI trends.
 * 
 * @param currentNDVI 14-day moving average NDVI (latest)
 * @param historicalNDVI January dormant baseline NDVI
 * @param previousNDVI 14-day moving average NDVI (7 days ago)
 * @returns Comprehensive NFI calculation breakdown
 */
export function calculateNFI(
  currentNDVI: number,
  historicalNDVI: number,
  previousNDVI: number
): NFIBreakdown {
  const ratio = historicalNDVI > 0 ? currentNDVI / historicalNDVI : 1.0;
  
  // 1. Calculate Forage Biomass Base (Layer 1)
  // Scale the greenness increase above the historical dormant baseline.
  // We estimate the maximum possible greenup delta as (0.85 - baseline), capped at a minimum of 0.15 to avoid division by zero.
  const maxPossibleDelta = Math.max(0.15, 0.85 - historicalNDVI);
  const growthDelta = currentNDVI - historicalNDVI;
  
  // Layer 1 score is out of 80 points.
  const layer1Score = Math.max(0, Math.min(80, (growthDelta / maxPossibleDelta) * 80));
  const layer1Max = 80;

  // 2. Calculate Phenology Trend (Layer 2)
  const slope = currentNDVI - previousNDVI;
  let phenologyBoost = 0;
  
  // Apply positive phenology boosts only if the absolute greenness is above a dormant threshold (0.45).
  // Tiny slope changes at low dormant levels are just winter cover crop fluctuations/noise.
  if (currentNDVI >= 0.45) {
    if (slope > 0.005) {
      phenologyBoost = 20; // Upward trend / startup boost
    } else if (slope > 0.002) {
      phenologyBoost = 10;
    }
  }
  
  // Penalties are always active (though capped by NFI >= 0 floor)
  if (slope < -0.010) {
    phenologyBoost = -40; // Steep downward trend / dearth penalty
  } else if (slope < -0.005) {
    phenologyBoost = -20; // Moderate downward trend / decline penalty
  }

  const rawNFI = layer1Score + phenologyBoost;
  const nfi = Math.min(100, Math.max(0, Math.round(rawNFI)));

  // 3. Classify Status & Advice (Layer 3)
  let status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low' = 'Stable Low';
  let transitionAdvice = 'Stable low forage availability. Brood rearing is moderate. Monitor reserves.';

  if (slope < -0.010) {
    status = 'Flow Ending';
    transitionAdvice = 'Nectar flow is shutting down rapidly. Queen egg-laying will slow down. Robbing behavior may rise; check honey stores.';
  } else if (currentNDVI < 0.45 && Math.abs(slope) <= 0.005) {
    status = 'Dearth';
    transitionAdvice = 'Colony is in a dearth. Monitor food reserves closely. Supplemental feeding may be required to maintain colony strength.';
  } else if (slope > 0.005 && currentNDVI >= 0.45) {
    status = 'Pre-Flow';
    transitionAdvice = 'Greening up rapidly. Queen egg-laying is stimulated. Colony is building comb and expanding the brood nest. Queen cells and swarm preparation risk are rising.';
  } else if (layer1Score >= 40 && Math.abs(slope) <= 0.005 && currentNDVI >= 0.45) {
    status = 'Peak Flow';
    transitionAdvice = 'Peak nectar flow is active. Ensure honey supers are in place. Colony is actively storing surplus honey.';
  }

  return {
    nfi,
    ratio,
    layer1Score,
    layer1Max,
    slope,
    phenologyBoost,
    status,
    transitionAdvice
  };
}
