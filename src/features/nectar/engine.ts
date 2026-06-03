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
 * @param currentNDVI 10-day moving average NDVI (latest)
 * @param historicalNDVI January dormant baseline NDVI
 * @param previousNDVI 10-day moving average NDVI (7 days ago)
 * @returns Comprehensive NFI calculation breakdown
 */
export function calculateNFI(
  currentNDVI: number,
  historicalNDVI: number,
  previousNDVI: number
): NFIBreakdown {
  // 1. Calculate Forage Biomass Base (Layer 1)
  // Scale the 14-day moving average NDVI directly between the winter dormant baseline and a peak of 0.85.
  const maxPossibleDelta = Math.max(0.15, 0.85 - historicalNDVI);
  const growthDelta = currentNDVI - historicalNDVI;
  const nfi = Math.min(100, Math.max(0, Math.round((growthDelta / maxPossibleDelta) * 100)));

  // 2. Calculate weekly slope of the 14-day moving average
  const slope = currentNDVI - previousNDVI;

  // 3. Classify status and advice directly from the 14-day MA value and its slope
  let status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low' = 'Stable Low';
  let transitionAdvice = 'Stable low forage availability. Brood rearing is moderate. Monitor reserves.';

  if (currentNDVI < 0.45) {
    status = 'Dearth';
    transitionAdvice = 'Colony is in a dearth or dormant winter state. Monitor food reserves closely. Supplemental feeding may be required to maintain colony strength.';
  } else if (slope < -0.010) {
    status = 'Flow Ending';
    transitionAdvice = 'Nectar flow is shutting down rapidly. Queen egg-laying will slow down. Robbing behavior may rise; check honey stores.';
  } else if (slope > 0.005) {
    status = 'Pre-Flow';
    transitionAdvice = 'Greening up rapidly. Queen egg-laying is stimulated. Colony is building comb and expanding the brood nest. Queen cells and swarm preparation risk are rising.';
  } else if (nfi >= 50) {
    status = 'Peak Flow';
    transitionAdvice = 'Peak nectar flow is active. Ensure honey supers are in place. Colony is actively storing surplus honey.';
  }

  return {
    nfi,
    ratio: historicalNDVI > 0 ? currentNDVI / historicalNDVI : 1.0,
    layer1Score: nfi,
    layer1Max: 100,
    slope,
    phenologyBoost: 0,
    status,
    transitionAdvice
  };
}
