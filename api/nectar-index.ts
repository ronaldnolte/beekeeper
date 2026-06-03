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

// Helper to filter out sudden downward or upward spikes (cloud shadows / sensor anomalies)
function filterNDVIOutliers(history: any[]): any[] {
  if (history.length < 3) return history;
  const filtered: any[] = [];
  
  // Keep first point
  filtered.push(history[0]);
  
  for (let i = 1; i < history.length - 1; i++) {
    const prev = history[i - 1].data.mean;
    const cur = history[i].data.mean;
    const next = history[i + 1].data.mean;
    
    // Cloud/Shadow signature: drop of > 0.12 followed by recovery
    const isCloudDrop = (prev - cur > 0.12) && (next - cur > 0.12);
    
    // Sensor reflection spike signature: jump of > 0.15 followed by drop
    const isSensorSpike = (cur - prev > 0.15) && (cur - next > 0.15);
    
    if (!isCloudDrop && !isSensorSpike) {
      filtered.push(history[i]);
    } else {
      console.log(`Filtered out NDVI outlier: ${cur} on ${new Date(history[i].dt * 1000).toISOString().slice(0, 10)}`);
    }
  }
  
  // Keep last point
  filtered.push(history[history.length - 1]);
  return filtered;
}

// Helper to calculate 10-day moving average from a list of readings
function calculate10DayAvg(history: any[], targetUnix: number): number {
  const tenDaysSec = 10 * 24 * 60 * 60;
  const windowStart = targetUnix - tenDaysSec;
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

// Helper to linearly interpolate monthly baselines into smooth daily/weekly values
function getInterpolatedNDVI(date: Date, isSouthern: boolean = false): number {
  const midpoints = [
    { day: 15, val: 0.35 },   // Jan
    { day: 45, val: 0.38 },   // Feb
    { day: 74, val: 0.45 },   // Mar
    { day: 105, val: 0.58 },  // Apr
    { day: 135, val: 0.72 },  // May
    { day: 166, val: 0.78 },  // Jun
    { day: 196, val: 0.74 },  // Jul
    { day: 227, val: 0.65 },  // Aug
    { day: 258, val: 0.55 },  // Sep
    { day: 288, val: 0.46 },  // Oct
    { day: 319, val: 0.38 },  // Nov
    { day: 349, val: 0.34 }   // Dec
  ];

  let lookupDate = date;
  if (isSouthern) {
    lookupDate = new Date(date.getTime());
    lookupDate.setMonth(lookupDate.getMonth() + 6);
  }

  const startOfYear = new Date(lookupDate.getFullYear(), 0, 1);
  const diff = lookupDate.getTime() - startOfYear.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const dayOfYear = Math.floor(diff / oneDay);

  if (dayOfYear <= 15) {
    const t = (dayOfYear + (365 - 349)) / (15 + (365 - 349));
    return 0.34 + t * (0.35 - 0.34);
  }
  if (dayOfYear >= 349) {
    const t = (dayOfYear - 349) / (365 - 349 + 15);
    return 0.34 + t * (0.35 - 0.34);
  }

  for (let i = 0; i < midpoints.length - 1; i++) {
    const m1 = midpoints[i];
    const m2 = midpoints[i + 1];
    if (dayOfYear >= m1.day && dayOfYear <= m2.day) {
      const t = (dayOfYear - m1.day) / (m2.day - m1.day);
      return m1.val + t * (m2.val - m1.val);
    }
  }

  return 0.5;
}

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

    // 3. Fetch 1-Year NDVI History from Agromonitoring
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
            currentJson.sort((a: any, b: any) => a.dt - b.dt);
            currentJson = filterNDVIOutliers(currentJson);
            console.log(`Successfully fetched and outlier-filtered 1-Year NDVI history.`);
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

    const isSouthern = lat < 0;

    // 4. Determine Baseline, Current and Previous NDVI values
    if (currentRespOk && currentJson && currentJson.length > 0) {
      currentNDVI = calculate10DayAvg(currentJson, currentEndUnix);
      previousNDVI = calculate10DayAvg(currentJson, currentEndUnix - 7 * 24 * 60 * 60);
      
      if (baselineNDVI === undefined || baselineNDVI === null) {
        // Dynamic Baseline: Find the lowest NDVI value in the outlier-filtered 1-Year history
        const minPt = currentJson.reduce((min, pt) => pt.data.mean < min.data.mean ? pt : min, currentJson[0]);
        baselineNDVI = minPt.data.mean;
        console.log(`Dynamic baseline NDVI determined from 1-Year history minimum: ${baselineNDVI} on ${new Date(minPt.dt * 1000).toISOString().slice(0, 10)}`);
        isHistoryQueried = true;
      }
    } else {
      currentNDVI = getInterpolatedNDVI(new Date(), isSouthern);
      const prevDate = new Date();
      prevDate.setDate(prevDate.getDate() - 7);
      previousNDVI = getInterpolatedNDVI(prevDate, isSouthern);
      
      if (baselineNDVI === undefined || baselineNDVI === null) {
        // Fallback baseline: Winter low (July 15 for South, Jan 15 for North)
        const baselineDate = new Date(new Date().getFullYear(), isSouthern ? 6 : 0, 15);
        baselineNDVI = getInterpolatedNDVI(baselineDate, isSouthern);
      }
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
        const currentMA = calculate10DayAvg(currentJson, pt.dt);
        const prevMA = calculate10DayAvg(currentJson, pt.dt - 7 * 24 * 60 * 60);
        
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
      // Fallback: Generate mock history based on monthly default baselines with linear midpoint interpolation for smooth curves
      const now = new Date();
      const isSouthern = lat < 0;
      for (let i = 52; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const baselineVal = getInterpolatedNDVI(new Date(d.getFullYear(), isSouthern ? 6 : 0, 15), isSouthern); // mid-winter baseline
        const curVal = getInterpolatedNDVI(d, isSouthern);
        
        const prevDate = new Date(d);
        prevDate.setDate(prevDate.getDate() - 7); // 7 days ago
        const prevVal = getInterpolatedNDVI(prevDate, isSouthern);
        
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
      isMock: !currentRespOk || currentJson.length === 0,
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
