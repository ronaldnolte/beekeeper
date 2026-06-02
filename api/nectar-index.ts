// Self-contained Nectar Flow Index (NFI) Serverless Handler for Vercel

// 1. Inlined GeoJSON Circle Generator
function generateCirclePolygon(lat: number, lng: number, radiusMiles: number = 1.9) {
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
  precipitationMm: number
): NFIBreakdown {
  if (precipitationMm > 2.0) {
    return {
      nfi: 0,
      ratio: currentNDVI / (historicalNDVI || 0.4),
      layer1Score: 0,
      layer1Max: historicalNDVI < 0.7 ? (historicalNDVI / 0.7) * 70 : 70,
      delta: currentNDVI - previousNDVI,
      phenologyMultiplier: 1.0,
      tempMultiplier: 0.0,
      humidityMultiplier: 0.0,
      isWashout: true
    };
  }

  const ratio = historicalNDVI > 0 ? currentNDVI / historicalNDVI : 1.0;
  
  let layer1Max = 70;
  if (historicalNDVI < 0.70) {
    layer1Max = (historicalNDVI / 0.70) * 70;
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

  const humidityMultiplier = relativeHumidity < 35 ? 0.5 : 1.0;

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

    let polygonId = clientPolygonId;
    let baselineNDVI = cachedBaseline;
    let currentNDVI = 0.6;
    let previousNDVI = 0.6;
    let isHistoryQueried = false;
    let isPolygonCreated = false;

    const currentMonth = new Date().getMonth() + 1; // 1-12
    const defaultBaselineForMonth = defaultBaselines[currentMonth.toString()] || 0.5;

    // 2. Manage Agromonitoring Polygon
    if (!polygonId) {
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
          const sum = janJson.reduce((acc: number, val: any) => acc + val.data.mean, 0);
          baselineNDVI = sum / janJson.length;
        }
      }

      if (baselineNDVI === undefined || baselineNDVI === null) {
        baselineNDVI = defaultBaselineForMonth;
      }
      isHistoryQueried = true;
    }

    // 4. Fetch 1-Year NDVI History from Agromonitoring (last 365 days)
    const currentEndUnix = Math.floor(Date.now() / 1000);
    const start365Unix = currentEndUnix - 365 * 24 * 60 * 60; // 365 days

    const currentResp = await fetch(
      `https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${start365Unix}&end=${currentEndUnix}&appid=${apiKey}`
    );

    let currentJson: any[] = [];
    if (currentResp.ok) {
      currentJson = await currentResp.json();
      if (currentJson && currentJson.length > 0) {
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
        previousNDVI = defaultBaselineForMonth;
      }
    } else {
      currentNDVI = defaultBaselineForMonth;
      previousNDVI = defaultBaselineForMonth;
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

          // Find closest NDVI for this day (noon timestamp)
          const targetDt = Math.floor(new Date(`${dateStr}T12:00:00Z`).getTime() / 1000);
          
          let dayNDVI = defaultBaselineForMonth;
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
      isPolygonCreated,
      history: weeklyHistory // 52-week array
    });

  } catch (error: any) {
    console.error('Nectar index service error:', error);
    res.status(500).json({
      error: 'Failed to calculate Nectar Flow Index: ' + (error.message || 'Unknown error')
    });
  }
}
