// Self-contained Nectar Flow Index (NFI) Serverless Handler for Vercel

// 1. Inlined GeoJSON Circle Generator
function generateCirclePolygon(lat: number, lng: number, radiusMiles: number = 1.0) {
  const EARTH_RADIUS_MILES = 3959;
  const numPoints = 32;
  const coordinates: [number, number][] = [];

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = radiusMiles / EARTH_RADIUS_MILES;

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (i * 2 * Math.PI) / numPoints;

    const destLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );

    const destLngRad =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad)
      );

    const destLat = (destLatRad * 180) / Math.PI;
    const destLng = (((destLngRad * 180) / Math.PI + 540) % 360) - 180;

    coordinates.push([destLng, destLat]);
  }

  return {
    type: 'Feature',
    properties: {
      center: [lng, lat],
      radiusMiles
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  };
}

// 2. Inlined NFI Calculation Engine
interface NFIBreakdown {
  nfi: number;
  ratio: number;
  layer1Score: number;
  layer1Max: number;
  slope: number;
  phenologyBoost: number;
  status: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low';
  transitionAdvice: string;
}

function calculateNFI(
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

// Helper to calculate 14-day moving average from a list of readings
function calculate14DayAvg(history: any[], targetUnix: number): number {
  const fourteenDaysSec = 14 * 24 * 60 * 60;
  const windowStart = targetUnix - fourteenDaysSec;
  const pointsInWindow = history.filter(pt => pt.dt >= windowStart && pt.dt <= targetUnix);
  
  if (pointsInWindow.length > 0) {
    const sum = pointsInWindow.reduce((acc, val) => acc + val.data.mean, 0);
    return sum / pointsInWindow.length;
  }
  
  // Fallback: find the closest point before targetUnix
  const pointsBefore = history.filter(pt => pt.dt <= targetUnix);
  if (pointsBefore.length > 0) {
    return pointsBefore[pointsBefore.length - 1].data.mean;
  }
  
  return 0.5; // Final default fallback
}

// 3. Inlined Fallback Baseline Database
const defaultBaselines: Record<string, number> = {
  "1": 0.35,
  "2": 0.38,
  "3": 0.45,
  "4": 0.58,
  "5": 0.72,
  "6": 0.78,
  "7": 0.74,
  "8": 0.65,
  "9": 0.55,
  "10": 0.46,
  "11": 0.38,
  "12": 0.34
};

// 4. Serverless Handler
export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let polygonId: string | null = null;
  const apiKey = process.env.AGRO_API_KEY;

  try {
    const isGet = req.method === 'GET';
    const latRaw = isGet ? req.query.lat : req.body.lat;
    const lngRaw = isGet ? req.query.lng : req.body.lng;
    const cachedBaselineRaw = isGet ? req.query.cachedBaseline : req.body.cachedBaseline;

    if (latRaw === undefined || lngRaw === undefined) {
      res.status(400).json({ error: 'Latitude and Longitude are required' });
      return;
    }

    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'Latitude and Longitude must be valid numbers' });
      return;
    }

    const cachedBaseline = cachedBaselineRaw !== undefined && cachedBaselineRaw !== null && cachedBaselineRaw !== 'null'
      ? parseFloat(cachedBaselineRaw)
      : null;

    if (!apiKey) {
      res.status(500).json({ error: 'Agromonitoring API key not configured on server.' });
      return;
    }

    let baselineNDVI = cachedBaseline;
    let currentNDVI = 0.6;
    let previousNDVI = 0.6;
    let isHistoryQueried = false;
    let isPolygonCreated = false;

    const currentMonth = new Date().getMonth() + 1; // 1-12
    const defaultBaselineForMonth = defaultBaselines[currentMonth.toString()] || 0.5;

    const currentEndUnix = Math.floor(Date.now() / 1000);
    const start365Unix = currentEndUnix - 365 * 24 * 60 * 60; // 365 days

    let currentJson: any[] = [];
    let currentRespOk = false;

    // 2. Find or Create Agromonitoring Polygon
    const geojson = generateCirclePolygon(lat, lng, 1.0); // 1.0 mile foraging radius
    let matchedPolyId: string | null = null;
    let shouldCreateNewPolygon = true;

    try {
      // Query existing active polygons
      const listResp = await fetch(
        `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}`
      );
      if (listResp.ok) {
        const polygons = await listResp.json();
        if (polygons && polygons.length > 0) {
          for (const poly of polygons) {
            if (poly.properties && poly.properties.center) {
              const [polyLng, polyLat] = poly.properties.center;
              // Check if coordinates match closely (within ~11 meters / 0.0001 deg)
              const distance = Math.sqrt(Math.pow(polyLat - lat, 2) + Math.pow(polyLng - lng, 2));
              if (distance < 0.0001) {
                matchedPolyId = poly.id;
                shouldCreateNewPolygon = false;
                console.log(`Reusing existing matching polygon ${poly.id} for location [${lat}, ${lng}]`);
                break;
              }
            }
          }

          // If no matching polygon but we have active ones, delete them to stay within 1-polygon limit
          if (shouldCreateNewPolygon) {
            for (const poly of polygons) {
              console.log(`Deleting non-matching polygon ${poly.id} to respect free-tier quota...`);
              await fetch(
                `https://api.agromonitoring.com/agro/1.0/polygons/${poly.id}?appid=${apiKey}`,
                { method: 'DELETE' }
              );
            }
          }
        }
      } else {
        const errText = await listResp.text();
        console.error(`Failed to list active polygons: ${errText}`);
      }

      if (shouldCreateNewPolygon) {
        const polyResp = await fetch(
          `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}&duplicated=true`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `NFI_Persist_${Date.now()}`, geo_json: geojson }),
          }
        );

        if (polyResp.ok) {
          const polyData = await polyResp.json();
          polygonId = polyData.id;
          isPolygonCreated = true;
          console.log(`Created new persistent polygon: ${polygonId}`);
        } else {
          const text = await polyResp.text();
          console.error(`Polygon registration failed: ${text}. Falling back to static baseline.`);
        }
      } else {
        polygonId = matchedPolyId;
        isPolygonCreated = false;
      }
    } catch (err: any) {
      console.error(`Polygon management failed: ${err.message}. Falling back to static baseline.`);
    }

    // 3. Obtain Baseline NDVI (if not cached and we have a valid polygonId)
    if (polygonId && (baselineNDVI === undefined || baselineNDVI === null)) {
      const currentYear = new Date().getFullYear();
      const jan1Unix = Math.floor(new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000);
      const jan31Unix = Math.floor(new Date(`${currentYear}-01-31T00:00:00Z`).getTime() / 1000);

      // Retry/polling loop if polygon is newly created
      const maxAttempts = isPolygonCreated ? 5 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const janResp = await fetch(
          `https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${jan1Unix}&end=${jan31Unix}&appid=${apiKey}`
        );

        if (janResp.ok) {
          const janJson = await janResp.json();
          if (janJson && janJson.length > 0) {
            const sum = janJson.reduce((acc: number, val: any) => acc + val.data.mean, 0);
            baselineNDVI = sum / janJson.length;
            console.log(`Successfully fetched baseline NDVI on attempt ${attempt}: ${baselineNDVI}`);
            break;
          }
        } else {
          const text = await janResp.text();
          console.warn(`Baseline NDVI attempt ${attempt} failed: ${text}`);
        }

        if (attempt < maxAttempts) {
          console.log(`Baseline NDVI empty/failed. Retrying in 1.5s (attempt ${attempt + 1}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      if (baselineNDVI === undefined || baselineNDVI === null) {
        baselineNDVI = defaultBaselines["1"]; // January baseline fallback
      }
      isHistoryQueried = true;
    } else if (!polygonId) {
      baselineNDVI = defaultBaselines["1"]; // Fallback if no polygon exists
    }

    // 4. Fetch 1-Year NDVI History from Agromonitoring
    if (polygonId) {
      const maxAttempts = isPolygonCreated ? 5 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const currentResp = await fetch(
          `https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${start365Unix}&end=${currentEndUnix}&appid=${apiKey}`
        );
        
        if (currentResp.ok) {
          currentJson = await currentResp.json();
          if (currentJson && currentJson.length > 0) {
            currentRespOk = true;
            console.log(`Successfully fetched 1-Year NDVI history on attempt ${attempt}.`);
            break;
          }
        } else {
          const text = await currentResp.text();
          console.warn(`1-Year NDVI history attempt ${attempt} failed: ${text}`);
        }

        if (attempt < maxAttempts) {
          console.log(`1-Year NDVI history empty/failed. Retrying in 1.5s (attempt ${attempt + 1}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    if (currentRespOk && currentJson && currentJson.length > 0) {
      currentNDVI = calculate14DayAvg(currentJson, currentEndUnix);
      previousNDVI = calculate14DayAvg(currentJson, currentEndUnix - 7 * 24 * 60 * 60);
    } else {
      currentNDVI = defaultBaselineForMonth;
      const prevDate = new Date();
      prevDate.setDate(prevDate.getDate() - 8);
      const prevMonth = prevDate.getMonth() + 1;
      previousNDVI = defaultBaselines[prevMonth.toString()] || 0.5;
    }

    // 5. Calculate current NFI via engine
    const breakdown = calculateNFI(
      currentNDVI,
      baselineNDVI,
      previousNDVI
    );

    // 6. Construct 1-Year NFI History from NDVI History
    const dailyNFIs: { date: string; nfi: number }[] = [];

    if (currentRespOk && currentJson && currentJson.length > 0) {
      currentJson.sort((a: any, b: any) => a.dt - b.dt);
      
      for (const pt of currentJson) {
        const dateStr = new Date(pt.dt * 1000).toISOString().slice(0, 10);
        const currentMA = calculate14DayAvg(currentJson, pt.dt);
        const prevMA = calculate14DayAvg(currentJson, pt.dt - 7 * 24 * 60 * 60);
        
        const ptBreakdown = calculateNFI(currentMA, baselineNDVI, prevMA);
        dailyNFIs.push({
          date: dateStr,
          nfi: ptBreakdown.nfi
        });
      }
    }

    // 7. Group the NFI values into weekly averages
    const weeklyHistory: { date: string; nfi: number }[] = [];
    if (dailyNFIs.length > 0) {
      dailyNFIs.sort((a, b) => a.date.localeCompare(b.date));
      // Chunk into blocks of 2 (approx weekly since satellite is every 3-5 days)
      for (let i = 0; i < dailyNFIs.length; i += 2) {
        const slice = dailyNFIs.slice(i, Math.min(i + 2, dailyNFIs.length));
        const sum = slice.reduce((acc, val) => acc + val.nfi, 0);
        const avg = Math.round(sum / slice.length);
        weeklyHistory.push({
          date: slice[slice.length - 1].date,
          nfi: avg
        });
      }
    } else {
      // Fallback: Generate mock history based on monthly default baselines
      const now = new Date();
      for (let i = 52; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const m = d.getMonth() + 1;
        const baselineVal = defaultBaselines["1"];
        const curVal = defaultBaselines[m.toString()] || 0.5;
        
        const prevDate = new Date(d);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevM = prevDate.getMonth() + 1;
        const prevVal = defaultBaselines[prevM.toString()] || 0.5;
        
        const mockBreakdown = calculateNFI(curVal, baselineVal, prevVal);
        weeklyHistory.push({
          date: d.toISOString().slice(0, 10),
          nfi: mockBreakdown.nfi
        });
      }
    }

    // 8. Return response
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
    }
    res.status(200).json({
      polygonId: null,
      baselineNDVI,
      currentNDVI,
      previousNDVI,
      ndviRawLatest: currentJson && currentJson.length > 0 ? currentJson[currentJson.length - 1].data.mean : currentNDVI,
      nfi: breakdown.nfi,
      status: breakdown.status,
      slope: breakdown.slope,
      transitionAdvice: breakdown.transitionAdvice,
      breakdown,
      isHistoryQueried,
      isPolygonCreated,
      history: weeklyHistory
    });

  } catch (error: any) {
    console.error('Nectar index service error:', error);
    res.status(500).json({
      error: 'Failed to calculate Nectar Flow Index: ' + (error.message || 'Unknown error')
    });
  } finally {
    // Persistent polygon is preserved in AgroMonitoring to avoid recalculation/polling delays on subsequent calls
  }
}
