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
  delta: number;
  phenologyMultiplier: number;
  tempMultiplier: number;
  humidityMultiplier: number;
  isWashout: boolean;
}

function calculateNFI(
  currentNDVI: number,
  historicalNDVI: number,
  previousNDVI: number,
  tempF: number,
  relativeHumidity: number,
  _precipitationMm: number
): NFIBreakdown {
  const ratio = historicalNDVI > 0 ? currentNDVI / historicalNDVI : 1.0;
  
  // Cap potential if baseline drops below 70% (0.70), but allow high absolute greenness to lift the cap
  let layer1Max = 70;
  if (historicalNDVI < 0.70) {
    const localMax = (historicalNDVI / 0.70) * 70;
    layer1Max = Math.max(localMax, Math.min(70, currentNDVI * 100));
  }
  
  const layer1Score = Math.min(ratio * 70, layer1Max);

  const delta = currentNDVI - previousNDVI;
  let phenologyMultiplier = 1.0;
  
  if (delta > 0.03) {
    phenologyMultiplier = 1.15;
  } else if (delta < -0.05) {
    phenologyMultiplier = 0.60;
  }

  const baseScore = layer1Score * phenologyMultiplier;

  let tempMultiplier = 1.0;
  if (tempF < 65 || tempF > 98) {
    tempMultiplier = 0.2;
  } else if (tempF >= 75 && tempF <= 88) {
    tempMultiplier = 1.2;
  } else if (tempF >= 65 && tempF < 75) {
    tempMultiplier = 0.2 + ((tempF - 65) / 10) * 1.0;
  } else if (tempF > 88 && tempF <= 98) {
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

    // 1. Fetch current weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation&temperature_unit=fahrenheit&timezone=auto`;
    const weatherResp = await fetch(weatherUrl);
    if (!weatherResp.ok) {
      throw new Error(`Failed to fetch weather data: ${weatherResp.statusText}`);
    }
    const weatherData = await weatherResp.json();
    const currentTemp = weatherData.current.temperature_2m;
    const currentRH = weatherData.current.relative_humidity_2m;
    const currentRainMm = weatherData.current.precipitation; // mm

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
      currentJson.sort((a: any, b: any) => a.dt - b.dt);
      
      const latestReading = currentJson[currentJson.length - 1];
      currentNDVI = latestReading.data.mean;

      if (currentJson.length > 1) {
        const latestDt = latestReading.dt;
        const targetDt = latestDt - 8 * 24 * 60 * 60; // 8 days prior

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
        previousNDVI = currentNDVI;
      }
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
      previousNDVI,
      currentTemp,
      currentRH,
      currentRainMm
    );

    // 6. Fetch 1-Year Historical Weather from Open-Meteo Archive
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 365);
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDateStr}&end_date=${endDateStr}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum&temperature_unit=fahrenheit&timezone=auto`;
    const archiveResp = await fetch(archiveUrl);
    
    const dailyNFIs: { date: string; nfi: number }[] = [];

    if (archiveResp.ok) {
      const archiveData = await archiveResp.json();
      if (archiveData.daily && archiveData.daily.time) {
        const times = archiveData.daily.time as string[];
        const tempMaxs = archiveData.daily.temperature_2m_max as number[];
        const tempMins = archiveData.daily.temperature_2m_min as number[];
        const humMeans = archiveData.daily.relative_humidity_2m_mean as number[];
        const rainSums = archiveData.daily.precipitation_sum as number[];

        for (let i = 0; i < times.length; i++) {
          const dateStr = times[i];
          const avgTemp = (tempMaxs[i] + tempMins[i]) / 2;
          const avgHum = humMeans[i] || 50;
          const rain = rainSums[i] || 0;

          // Determine month of this specific day for correct fallback baseline
          const dayDate = new Date(dateStr);
          const dayMonth = dayDate.getMonth() + 1;
          const dayDefaultBaseline = defaultBaselines[dayMonth.toString()] || 0.5;

          // Find closest NDVI for this day (noon timestamp)
          const targetDt = Math.floor(dayDate.getTime() / 1000);
          
          let dayNDVI = dayDefaultBaseline;
          let bestDiff = Infinity;
          if (currentJson && currentJson.length > 0) {
            for (const pt of currentJson) {
              const diff = Math.abs(pt.dt - targetDt);
              if (diff < bestDiff) {
                bestDiff = diff;
                dayNDVI = pt.data.mean;
              }
            }
          }

          // Find previous NDVI (~8 days prior)
          let dayPrevNDVI = dayNDVI;
          let bestPrevDiff = Infinity;
          if (currentJson && currentJson.length > 0) {
            const prevTargetDt = targetDt - 8 * 24 * 60 * 60;
            for (const pt of currentJson) {
              const diff = Math.abs(pt.dt - prevTargetDt);
              if (diff < bestPrevDiff) {
                bestPrevDiff = diff;
                dayPrevNDVI = pt.data.mean;
              }
            }
          } else {
            const prevDate = new Date(dayDate);
            prevDate.setDate(prevDate.getDate() - 8);
            const prevMonth = prevDate.getMonth() + 1;
            dayPrevNDVI = defaultBaselines[prevMonth.toString()] || 0.5;
          }

          const dayBreakdown = calculateNFI(
            dayNDVI,
            baselineNDVI,
            dayPrevNDVI,
            avgTemp,
            avgHum,
            rain
          );

          dailyNFIs.push({
            date: dateStr,
            nfi: dayBreakdown.nfi
          });
        }
      }
    }

    // 7. Group the 365 daily NFI values into 52 weekly averages
    const weeklyHistory: { date: string; nfi: number }[] = [];
    for (let i = 0; i < dailyNFIs.length; i += 7) {
      const slice = dailyNFIs.slice(i, i + 7);
      if (slice.length > 0) {
        const sum = slice.reduce((acc, val) => acc + val.nfi, 0);
        const avg = Math.round(sum / slice.length);
        weeklyHistory.push({
          date: slice[slice.length - 1].date,
          nfi: avg
        });
      }
    }

    // 8. Return response
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
    }
    res.status(200).json({
      polygonId: null, // Polygon is deleted immediately, so do not return an ID to cache
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
      isPolygonCreated,
      history: weeklyHistory // 52-week array
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
