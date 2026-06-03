import { fetchNDVI, NDVIRecord } from './ndvi-fetcher';
import { computeBloomFactor, PlantProfileEntry } from '../src/features/nectar/bloomFactor';
import { computeWeatherSuitability, WeatherSuitabilityInput } from '../src/features/nectar/weatherSuitability';
import { computeNectarStatus, Apiary, DailyEnvironment } from '../src/features/nectar/engine';

// Helper to filter out sudden spikes in NDVI (cloud shadow / sensor anomaly)
function filterNDVIOutliers(records: NDVIRecord[]): NDVIRecord[] {
  if (records.length < 3) return records;
  const filtered: NDVIRecord[] = [];
  
  // Keep first point
  filtered.push(records[0]);
  
  for (let i = 1; i < records.length - 1; i++) {
    const prev = records[i - 1].ndvi;
    const cur = records[i].ndvi;
    const next = records[i + 1].ndvi;
    
    // Cloud/Shadow signature: drop of > 0.12 followed by recovery
    const isCloudDrop = (prev - cur > 0.12) && (next - cur > 0.12);
    
    // Sensor reflection spike signature: jump of > 0.15 followed by drop
    const isSensorSpike = (cur - prev > 0.15) && (cur - next > 0.15);
    
    if (!isCloudDrop && !isSensorSpike) {
      filtered.push(records[i]);
    }
  }
  
  // Keep last point
  filtered.push(records[records.length - 1]);
  return filtered;
}

// Fallback baseline monthly values
const defaultBaselines: Record<string, number> = {
  "1": 0.35, "2": 0.38, "3": 0.45, "4": 0.58, "5": 0.72,
  "6": 0.78, "7": 0.74, "8": 0.65, "9": 0.55, "10": 0.46,
  "11": 0.38, "12": 0.34
};

// Fallback linear interpolation for daily mock NDVI
function getInterpolatedNDVI(date: Date, lat: number = 39, lng: number = -98): number {
  const isSouthern = lat < 0;
  const absLat = Math.abs(lat);
  
  const hash = Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453;
  const coordOffset = (hash - Math.floor(hash)) * 0.06 - 0.03;
  const amplitudeOffset = ((hash * 10 - Math.floor(hash * 10)) * 0.1) - 0.05;
  
  const latContrast = (absLat - 38) * 0.003; 
  const springDelay = Math.round((absLat - 38) * 0.7);
  
  const midpoints = [
    { day: 15, val: 0.35 }, { day: 45, val: 0.38 }, { day: 74, val: 0.45 },
    { day: 105, val: 0.58 }, { day: 135, val: 0.72 }, { day: 166, val: 0.78 },
    { day: 196, val: 0.74 }, { day: 227, val: 0.65 }, { day: 258, val: 0.55 },
    { day: 288, val: 0.46 }, { day: 319, val: 0.38 }, { day: 349, val: 0.34 }
  ];

  let lookupDate = date;
  if (isSouthern) {
    lookupDate = new Date(date.getTime());
    lookupDate.setMonth(lookupDate.getMonth() + 6);
  }

  const startOfYear = new Date(lookupDate.getFullYear(), 0, 1);
  const diff = lookupDate.getTime() - startOfYear.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const baseDayOfYear = Math.floor(diff / oneDay);
  
  let dayOfYear = baseDayOfYear - springDelay;
  if (dayOfYear < 1) dayOfYear += 365;
  if (dayOfYear > 365) dayOfYear -= 365;

  const getAdjustedVal = (baseVal: number, day: number) => {
    const isSummerMonth = day > 120 && day < 270;
    let newVal = baseVal;
    if (isSummerMonth) {
      newVal = baseVal + latContrast + coordOffset + amplitudeOffset;
    } else {
      newVal = baseVal - latContrast + coordOffset;
    }
    return Math.min(0.88, Math.max(0.18, newVal));
  };

  const adjJan = getAdjustedVal(0.35, 15);
  const adjDec = getAdjustedVal(0.34, 349);

  if (dayOfYear <= 15) {
    const t = (dayOfYear + (365 - 349)) / (15 + (365 - 349));
    return adjDec + t * (adjJan - adjDec);
  }
  if (dayOfYear >= 349) {
    const t = (dayOfYear - 349) / (365 - 349 + 15);
    return adjDec + t * (adjJan - adjDec);
  }

  const adjustedMidpoints = midpoints.map(m => ({
    day: m.day,
    val: getAdjustedVal(m.val, m.day)
  }));

  for (let i = 0; i < adjustedMidpoints.length - 1; i++) {
    const m1 = adjustedMidpoints[i];
    const m2 = adjustedMidpoints[i + 1];
    if (dayOfYear >= m1.day && dayOfYear <= m2.day) {
      const t = (dayOfYear - m1.day) / (m2.day - m1.day);
      return m1.val + t * (m2.val - m1.val);
    }
  }

  return 0.5;
}

// Default regional plant profile
const defaultPlantProfile: PlantProfileEntry[] = [
  {
    name: 'Spring Wildflowers & Dandelion',
    bloom_start: '03-15',
    bloom_peak: '04-30',
    bloom_end: '06-15'
  },
  {
    name: 'Clover & Alfalfa',
    bloom_start: '05-01',
    bloom_peak: '06-30',
    bloom_end: '09-15'
  },
  {
    name: 'Goldenrod & Aster',
    bloom_start: '08-01',
    bloom_peak: '09-15',
    bloom_end: '11-15'
  }
];

// Open-Meteo Weather Interfaces
interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
  wind_speed_10m_max: (number | null)[];
}

interface WeatherDayRecord {
  temp_max: number | null;
  temp_min: number | null;
  rain_sum: number | null;
  wind_max: number | null;
}

/**
 * Fetch and merge Open-Meteo weather data (Archive + Forecast)
 */
async function fetchOpenMeteoWeather(
  lat: number,
  lng: number,
  startDateStr: string,
  endDateStr: string
): Promise<Record<string, WeatherDayRecord>> {
  const weatherMap: Record<string, WeatherDayRecord> = {};

  const today = new Date();
  const archiveEnd = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
  const archiveEndStr = archiveEnd.toISOString().slice(0, 10);
  
  // 1. Fetch Archive
  let archiveData: OpenMeteoDaily | null = null;
  let archiveErrorMsg = '';
  try {
    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDateStr}&end_date=${archiveEndStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=fahrenheit&precipitation_unit=inch&windspeed_unit=mph&timezone=auto`;
    const res = await fetch(archiveUrl);
    if (res.ok) {
      const json = await res.json();
      archiveData = json.daily;
    } else {
      archiveErrorMsg = `HTTP status ${res.status}`;
    }
  } catch (e: any) {
    archiveErrorMsg = e.message || 'unknown network error';
  }

  if (!archiveData) {
    throw new Error(`Open-Meteo Archive API failed to return data: ${archiveErrorMsg}`);
  }

  // 2. Fetch Forecast
  let forecastData: OpenMeteoDaily | null = null;
  let forecastErrorMsg = '';
  try {
    const forecastStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000); // 6 days ago (overlap)
    const forecastStartStr = forecastStart.toISOString().slice(0, 10);
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${forecastStartStr}&end_date=${endDateStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=fahrenheit&precipitation_unit=inch&windspeed_unit=mph&timezone=auto`;
    const res = await fetch(forecastUrl);
    if (res.ok) {
      const json = await res.json();
      forecastData = json.daily;
    } else {
      forecastErrorMsg = `HTTP status ${res.status}`;
    }
  } catch (e: any) {
    forecastErrorMsg = e.message || 'unknown network error';
  }

  if (!forecastData) {
    throw new Error(`Open-Meteo Forecast API failed to return data: ${forecastErrorMsg}`);
  }

  // Populate map with archive
  if (archiveData) {
    for (let i = 0; i < archiveData.time.length; i++) {
      const d = archiveData.time[i];
      weatherMap[d] = {
        temp_max: archiveData.temperature_2m_max[i],
        temp_min: archiveData.temperature_2m_min[i],
        rain_sum: archiveData.precipitation_sum[i],
        wind_max: archiveData.wind_speed_10m_max[i]
      };
    }
  }

  // Override/populate with forecast
  if (forecastData) {
    for (let i = 0; i < forecastData.time.length; i++) {
      const d = forecastData.time[i];
      weatherMap[d] = {
        temp_max: forecastData.temperature_2m_max[i],
        temp_min: forecastData.temperature_2m_min[i],
        rain_sum: forecastData.precipitation_sum[i],
        wind_max: forecastData.wind_speed_10m_max[i]
      };
    }
  }

  return weatherMap;
}

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

    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
    const startDateStr = start.toISOString().slice(0, 10);
    const endDateStr = end.toISOString().slice(0, 10);

    // 1. Fetch Weather from Open-Meteo
    const weatherMap = await fetchOpenMeteoWeather(lat, lng, startDateStr, endDateStr);

    // 2. Fetch NDVI from Earth Engine (or use climate model mock fallback if it fails/empty)
    let ndviRecords: NDVIRecord[] = [];
    let isMock = false;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      ndviRecords = await fetchNDVI({
        lat,
        lon: lng,
        radius_km: 1.6,
        start_date: startDateStr,
        end_date: endDateStr,
        dataset: 'sentinel2',
        smoothing: 'none'
      });
    }

    if (ndviRecords.length === 0) {
      throw new Error('Google Earth Engine could not retrieve any vegetation data for this location. Please check your service account key and confirm that the Google Earth Engine API is enabled for the project in GCP console.');
    } else {
      ndviRecords = filterNDVIOutliers(ndviRecords);
    }

    // Sort NDVI records chronologically to ensure chronological processing
    ndviRecords.sort((a, b) => a.date.localeCompare(b.date));

    // Determine baseline (min) and max NDVI for the year
    const ndviVals = ndviRecords.map(r => r.ndvi);
    const baselineNDVI = cachedBaseline ?? (ndviVals.length > 0 ? Math.min(...ndviVals) : 0.35);
    const maxNDVI = ndviVals.length > 0 ? Math.max(...ndviVals) : 0.85;

    // 3. Compile daily environments list
    const dailyEnvironmentHistory: DailyEnvironment[] = ndviRecords.map((ndviRec, idx) => {
      const dateStr = ndviRec.date;
      const weatherVal = weatherMap[dateStr];

      // Calculate bloom factor
      const bloomResult = computeBloomFactor({
        date: dateStr,
        lat,
        lon: lng,
        plant_profile: defaultPlantProfile
      });

      // Calculate rain in the past 7 days (rolling sum)
      let rain_last_7_days: number | null = null;
      if (weatherVal) {
        let sum = 0;
        let validDays = 0;
        for (let i = Math.max(0, idx - 6); i <= idx; i++) {
          const recDate = ndviRecords[i].date;
          const w = weatherMap[recDate];
          if (w && w.rain_sum !== null && w.rain_sum !== undefined) {
            sum += w.rain_sum;
            validDays++;
          }
        }
        if (validDays > 0) {
          rain_last_7_days = sum;
        }
      }

      // Calculate weather suitability
      const weatherInput: WeatherSuitabilityInput = {
        date: dateStr,
        lat,
        lon: lng,
        temperature_max: weatherVal?.temp_max,
        temperature_min: weatherVal?.temp_min,
        rain_last_7_days,
        wind_speed_avg: weatherVal?.wind_max,
        drought_index: null // Omit drought index (let USDM penalty be null/ignored)
      };

      const suitResult = computeWeatherSuitability(weatherInput);

      return {
        date: dateStr,
        ndvi: ndviRec.ndvi,
        ndvi_min: baselineNDVI,
        ndvi_max: maxNDVI,
        bloom_factor: bloomResult.bloom_factor,
        temp_suitability: suitResult.temp_suitability,
        rain_suitability: suitResult.rain_suitability,
        wind_suitability: suitResult.wind_suitability
      };
    });

    // 4. Compute Nectar Status History
    const mockApiary: Apiary = {
      id: 'active',
      name: 'Active Apiary',
      lat,
      lon: lng,
      forage_radius_km: 1.6
    };

    const statusHistory = computeNectarStatus(mockApiary, dailyEnvironmentHistory);

    // Latest status calculations
    const latestStatus = statusHistory[statusHistory.length - 1];
    const latestEnv = dailyEnvironmentHistory[dailyEnvironmentHistory.length - 1];
    const latestWeatherVal = weatherMap[latestStatus.date];

    // Compute rain_last_7_days today
    let rain_last_7_days_today: number | null = null;
    let sumRain = 0;
    let validRainDays = 0;
    for (let i = Math.max(0, dailyEnvironmentHistory.length - 7); i < dailyEnvironmentHistory.length; i++) {
      const recDate = dailyEnvironmentHistory[i].date;
      const w = weatherMap[recDate];
      if (w && w.rain_sum !== null && w.rain_sum !== undefined) {
        sumRain += w.rain_sum;
        validRainDays++;
      }
    }
    if (validRainDays > 0) {
      rain_last_7_days_today = sumRain;
    }

    const nfi = latestStatus.forage_index_smoothed !== null 
      ? Math.round(latestStatus.forage_index_smoothed * 100) 
      : 0;
    const slope = latestStatus.delta_forage !== null ? latestStatus.delta_forage : 0;

    let trend_direction: 'rising' | 'falling' | 'flat' = 'flat';
    if (slope > 0.01) {
      trend_direction = 'rising';
    } else if (slope < -0.01) {
      trend_direction = 'falling';
    }

    // Map UI statuses for backward-compatibility
    let uiStatus: 'Pre-Flow' | 'Peak Flow' | 'Flow Ending' | 'Dearth' | 'Stable Low' = 'Stable Low';
    let transitionAdvice = 'Transition state. Monitor forage levels and colony strength.';

    switch (latestStatus.phase) {
      case 'IN_FLOW':
        uiStatus = 'Peak Flow';
        transitionAdvice = 'Peak nectar flow is active. Ensure honey supers are in place. Colony is actively storing surplus honey.';
        break;
      case 'FLOW_STARTING':
        uiStatus = 'Pre-Flow';
        transitionAdvice = 'Nectar flow is starting. Queen egg-laying is stimulated. Colony is building comb and expanding the brood nest. Queen cells and swarm preparation risk are rising.';
        break;
      case 'FLOW_ENDING':
        uiStatus = 'Flow Ending';
        transitionAdvice = 'Nectar flow is shutting down rapidly. Queen egg-laying will slow down. Robbing behavior may rise; check honey stores.';
        break;
      case 'DEARTH':
        uiStatus = 'Dearth';
        transitionAdvice = 'Colony is in a dearth. Monitor food reserves closely. Supplemental feeding may be required to maintain colony strength.';
        break;
      case 'TRANSITION':
      default:
        uiStatus = 'Stable Low';
        transitionAdvice = 'Transition state. Monitor forage levels and colony strength.';
        break;
    }

    // Weekly history mapping (chunking daily index to approx weekly)
    const weeklyHistory: { date: string; nfi: number }[] = [];
    for (let i = 0; i < statusHistory.length; i += 7) {
      const slice = statusHistory.slice(i, Math.min(i + 7, statusHistory.length));
      const validPoints = slice.filter(pt => pt.forage_index_smoothed !== null);
      if (validPoints.length > 0) {
        const sum = validPoints.reduce((acc, val) => acc + val.forage_index_smoothed!, 0);
        const avg = Math.round((sum / validPoints.length) * 100);
        weeklyHistory.push({
          date: slice[slice.length - 1].date,
          nfi: avg
        });
      }
    }

    // 5. Return complete response payload
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');
    }

    res.status(200).json({
      // Backward compatibility fields
      polygonId: null,
      baselineNDVI,
      currentNDVI: latestEnv.ndvi ?? 0.6,
      previousNDVI: dailyEnvironmentHistory.length > 7 ? dailyEnvironmentHistory[dailyEnvironmentHistory.length - 8].ndvi ?? 0.6 : 0.6,
      ndviRawLatest: latestEnv.ndvi ?? 0.6,
      nfi,
      status: uiStatus,
      slope,
      transitionAdvice,
      isHistoryQueried: true,
      isPolygonCreated: false,
      isMock,
      history: weeklyHistory,

      // New UI Data Binding fields
      phase: latestStatus.phase,
      ndvi_normalized: latestEnv.ndvi !== null && baselineNDVI !== null && maxNDVI !== null && (maxNDVI - baselineNDVI) > 0
        ? Math.min(1.0, Math.max(0.0, (latestEnv.ndvi! - baselineNDVI) / (maxNDVI - baselineNDVI)))
        : 0.0,
      bloom_factor: latestEnv.bloom_factor ?? 0.0,
      weather_suitability: latestEnv.temp_suitability !== null && latestEnv.rain_suitability !== null && latestEnv.wind_suitability !== null
        ? Math.min(1.0, Math.max(0.0, latestEnv.temp_suitability! * latestEnv.rain_suitability! * latestEnv.wind_suitability!))
        : null,
      forage_index_smoothed: latestStatus.forage_index_smoothed,
      delta_forage: latestStatus.delta_forage,
      trend_direction,
      ndvi_raw: latestEnv.ndvi,
      temperature_max: latestWeatherVal?.temp_max,
      temperature_min: latestWeatherVal?.temp_min,
      rain_last_7_days: rain_last_7_days_today,
      wind_speed_avg: latestWeatherVal?.wind_max,
      breakdown: {
        temp_suitability: latestEnv.temp_suitability,
        rain_suitability: latestEnv.rain_suitability,
        wind_suitability: latestEnv.wind_suitability,
        vigor: latestEnv.ndvi !== null && baselineNDVI !== null && (maxNDVI - baselineNDVI) > 0
          ? Math.min(1.0, Math.max(0.0, (latestEnv.ndvi! - baselineNDVI) / (maxNDVI - baselineNDVI)))
          : 0.0
      },
      full_history: statusHistory.map((s, idx) => ({
        date: s.date,
        forage_index_smoothed: s.forage_index_smoothed,
        phase: s.phase,
        ndvi_normalized: dailyEnvironmentHistory[idx].ndvi !== null && baselineNDVI !== null && (maxNDVI - baselineNDVI) > 0
          ? Math.min(1.0, Math.max(0.0, (dailyEnvironmentHistory[idx].ndvi! - baselineNDVI) / (maxNDVI - baselineNDVI)))
          : 0.0,
        bloom_factor: dailyEnvironmentHistory[idx].bloom_factor,
        weather_suitability: dailyEnvironmentHistory[idx].temp_suitability !== null && dailyEnvironmentHistory[idx].rain_suitability !== null && dailyEnvironmentHistory[idx].wind_suitability !== null
          ? Math.min(1.0, Math.max(0.0, dailyEnvironmentHistory[idx].temp_suitability! * dailyEnvironmentHistory[idx].rain_suitability! * dailyEnvironmentHistory[idx].wind_suitability!))
          : null
      }))
    });

  } catch (error: any) {
    console.error('Nectar index service error:', error);
    res.status(500).json({
      error: 'Failed to calculate Nectar Flow Index: ' + (error.message || 'Unknown error')
    });
  }
}
