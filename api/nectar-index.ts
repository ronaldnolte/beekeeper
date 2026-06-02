import { generateCirclePolygon } from '../src/features/nectar/geo';
import { calculateNFI } from '../src/features/nectar/engine';
import fallbackHistory from '../src/features/nectar/ndviHistory.json';

export default async function handler(req: any, res: any) {
  // 1. CORS headers
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

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { lat, lng, cachedBaseline, polygonId: clientPolygonId } = req.body;

    if (lat === undefined || lng === undefined) {
      res.status(400).json({ error: 'Latitude and Longitude are required' });
      return;
    }

    const apiKey = process.env.AGRO_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Agromonitoring API key not configured on server.' });
      return;
    }

    // 1. Fetch weather from Open-Meteo (Fahrenheit, mm rain, 0-100% RH)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation&temperature_unit=fahrenheit&timezone=auto`;
    const weatherResp = await fetch(weatherUrl);
    if (!weatherResp.ok) {
      throw new Error(`Failed to fetch weather data: ${weatherResp.statusText}`);
    }
    const weatherData = await weatherResp.json();
    const currentTemp = weatherData.current.temperature_2m;
    const currentRH = weatherData.current.relative_humidity_2m;
    const currentRainMm = weatherData.current.precipitation; // mm

    let polygonId = clientPolygonId;
    let baselineNDVI = cachedBaseline;
    let currentNDVI = 0.6;
    let previousNDVI = 0.6;
    let isHistoryQueried = false;
    let isPolygonCreated = false;

    const currentMonth = new Date().getMonth() + 1; // 1-12
    const defaultBaselines: Record<string, number> = fallbackHistory.defaultBaselines;
    const defaultBaselineForMonth = defaultBaselines[currentMonth.toString()] || 0.5;

    // 2. Manage Agromonitoring Polygon
    if (!polygonId) {
      // Create a 1.9-mile circle polygon around the coordinate
      const geojson = generateCirclePolygon(lat, lng, 1.9);
      
      const polyResp = await fetch(
        `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}&duplicated=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `NFI_Apiary_${Date.now()}`, geo_json: geojson }),
        }
      );

      if (!polyResp.ok) {
        const text = await polyResp.text();
        throw new Error(`Polygon registration failed: ${text}`);
      }

      const polyData = await polyResp.json();
      polygonId = polyData.id;
      isPolygonCreated = true;
    }

    // 3. Obtain Baseline NDVI (if not cached)
    if (baselineNDVI === undefined || baselineNDVI === null) {
      const currentYear = new Date().getFullYear();
      const jan1Unix = Math.floor(new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000);
      const jan31Unix = Math.floor(new Date(`${currentYear}-01-31T00:00:00Z`).getTime() / 1000);

      const janResp = await fetch(
        `https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${jan1Unix}&end=${jan31Unix}&appid=${apiKey}`
      );

      if (janResp.ok) {
        const janJson = await janResp.json();
        if (janJson && janJson.length > 0) {
          // Average the mean values of the passes in January
          const sum = janJson.reduce((acc: number, val: any) => acc + val.data.mean, 0);
          baselineNDVI = sum / janJson.length;
        }
      }

      // Fallback if no history or fetch failed
      if (baselineNDVI === undefined || baselineNDVI === null) {
        baselineNDVI = defaultBaselineForMonth;
      }
      isHistoryQueried = true;
    }

    // 4. Fetch Current NDVI (last 60 days to handle cloud covers)
    const currentEndUnix = Math.floor(Date.now() / 1000);
    const currentStartUnix = currentEndUnix - 60 * 24 * 60 * 60; // 60 days

    const currentResp = await fetch(
      `https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${currentStartUnix}&end=${currentEndUnix}&appid=${apiKey}`
    );

    if (currentResp.ok) {
      const currentJson = await currentResp.json();
      if (currentJson && currentJson.length > 0) {
        // Sort by date ascending to ensure proper chronological delta
        currentJson.sort((a: any, b: any) => a.dt - b.dt);
        
        // Latest reading is the current NDVI
        const latestReading = currentJson[currentJson.length - 1];
        currentNDVI = latestReading.data.mean;

        // Previous reading (try to find the reading closest to 7-10 days ago, or second-to-last)
        if (currentJson.length > 1) {
          const latestDt = latestReading.dt;
          const targetDt = latestDt - 8 * 24 * 60 * 60; // 8 days prior

          // Find the reading that is closest to 8 days prior to the latest reading
          let bestMatch = currentJson[0];
          let bestDiff = Math.abs(bestMatch.dt - targetDt);

          for (let i = 0; i < currentJson.length - 1; i++) {
            const diff = Math.abs(currentJson[i].dt - targetDt);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestMatch = currentJson[i];
            }
          }
          previousNDVI = bestMatch.data.mean;
        } else {
          // Fallback if only one reading exists
          previousNDVI = currentNDVI;
        }
      } else {
        // Fallback if no passes are found in the last 60 days
        currentNDVI = defaultBaselineForMonth;
        previousNDVI = defaultBaselineForMonth;
      }
    } else {
      currentNDVI = defaultBaselineForMonth;
      previousNDVI = defaultBaselineForMonth;
    }

    // 5. Calculate final NFI via engine
    const breakdown = calculateNFI(
      currentNDVI,
      baselineNDVI,
      previousNDVI,
      currentTemp,
      currentRH,
      currentRainMm
    );

    // 6. Return response
    res.status(200).json({
      polygonId,
      baselineNDVI,
      currentNDVI,
      previousNDVI,
      weather: {
        tempF: currentTemp,
        humidity: currentRH,
        precipitationMm: currentRainMm
      },
      nfi: breakdown.nfi,
      breakdown,
      isHistoryQueried,
      isPolygonCreated
    });

  } catch (error: any) {
    console.error('Nectar index service error:', error);
    res.status(500).json({
      error: 'Failed to calculate Nectar Flow Index: ' + (error.message || 'Unknown error')
    });
  }
}
