// Inspection-window scoring from an Open-Meteo forecast — FORMULAS §5, APPENDIX-B B2.
// All times are the apiary's local time strings (timezone=auto), never the device clock.

export const FORECAST_URL = (lat: number, lng: number) =>
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${lat}&longitude=${lng}` +
  '&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weathercode,cloudcover,windspeed_10m,pressure_msl,surface_pressure' +
  '&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch' +
  '&timezone=auto&forecast_days=7&models=gfs_seamless';

type Series = (number | null)[];

export interface OpenMeteoForecast {
  hourly: {
    time: string[];
    temperature_2m: Series;
    precipitation_probability: Series;
    precipitation: Series;
    weathercode: Series;
    cloudcover: Series;
    windspeed_10m: Series;
    pressure_msl: Series;
    surface_pressure: Series;
  };
  daily: { time: string[]; sunrise: string[]; sunset: string[] };
}

export type Classification = 'Optimal' | 'Viable' | 'Inadvisable';

export interface InspectionWindow {
  date: string;
  hour: number;
  scoreV2: number;
  classification: Classification;
  tempF: number;
  windMph: number;
  cloud: number;
  precipProb: number;
  pressureHpa: number;
  pressureDelta3hr: number;
  breakdownV2: { Temperature: number; 'Time of Day': number; 'Sky Condition': number; 'Wind Speed': number };
  issuesV2: string[];
  condition: string;
}

const hourOf = (t: string) => +t.slice(11, 13);
const minuteOf = (t: string) => +t.slice(14, 16);
const valid = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function conditionText(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain Showers';
  return 'Stormy';
}

export function classify(score: number, issues: readonly string[]): Classification {
  if (issues.length > 0) return 'Inadvisable';
  return score >= 7 ? 'Optimal' : score >= 4 ? 'Viable' : 'Inadvisable';
}

function twelveHour(time: string): string {
  const h = hourOf(time);
  return `${h > 12 ? h - 12 : h}:${time.slice(14, 16)}${h >= 12 ? 'pm' : 'am'}`;
}

export function scoreForecast(f: OpenMeteoForecast): InspectionWindow[] {
  const H = f.hourly;
  const mslAt = (k: number) => (valid(H.pressure_msl[k]) && H.pressure_msl[k] !== 0 ? (H.pressure_msl[k] as number) : 1013.25);
  const surface = (k: number): number | null => (k >= 0 && valid(H.surface_pressure[k]) ? (H.surface_pressure[k] as number) : null);
  // Mean surface pressure at k, k−1, k−2; a missing value falls back to the later one, then msl.
  const smoothed = (k: number) => {
    const a = surface(k) ?? mslAt(k);
    const b = surface(k - 1) ?? a;
    const c = surface(k - 2) ?? b;
    return (a + b + c) / 3;
  };

  // Hours shown: earliest sunrise hour … latest sunset hour (+1 if it has minutes).
  const h0 = Math.min(12, Math.max(0, Math.min(...f.daily.sunrise.map(hourOf))));
  const latestSunset = [...f.daily.sunset].sort().pop() ?? '0000-00-00T18:00';
  const h1 = Math.min(23, Math.max(12, hourOf(latestSunset) + (minuteOf(latestSunset) > 0 ? 1 : 0)));

  const out: InspectionWindow[] = [];
  for (const date of [...f.daily.time].sort()) {
    const sunsetStr = f.daily.sunset[f.daily.time.indexOf(date)] ?? `${date}T18:00`;
    const sunsetMin = hourOf(sunsetStr) * 60 + minuteOf(sunsetStr);
    for (let hour = h0; hour < h1; hour++) {
      const i = H.time.findIndex(t => t.slice(0, 10) === date && hourOf(t) === hour);
      if (i < 0) continue;

      const T = H.temperature_2m[i] as number;
      const W = H.windspeed_10m[i] as number;
      const C = H.cloudcover[i] as number;
      const Pp = (H.precipitation_probability[i] ?? 0) as number;
      const P = (H.precipitation[i] ?? 0) as number;
      const code = (H.weathercode[i] ?? 0) as number;
      const p = mslAt(i);
      const T1 = i > 0 ? (H.temperature_2m[i - 1] as number) : T;
      const safe = hour * 60 <= sunsetMin - 60;
      const delta = smoothed(Math.max(i - 3, 0)) - smoothed(i);

      const issues: string[] = [];
      if (T < 57) issues.push('Brood Chill Threshold Triggered (Temp < 57°F / 14°C)');
      if (T > 92) issues.push('Comb Heat/Heat Stroke Threshold Triggered (Temp > 92°F / 33°C)');
      const raining =
        P > 0.02 || code === 95 || code === 96 || code === 99 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || Pp >= 50;
      if (raining) issues.push('Active Precipitation Triggered');
      if (W > 18) issues.push('Flight Disruption Wind Triggered (Wind > 18mph)');
      if (T1 < 55) {
        issues.push(`Bees not awake (temperature 1 hour ago was ${Math.round(T1)}°F, must be 55°F+ for at least 1 hour)`);
      }
      if (!safe) {
        issues.push(
          `Too close to sunset (must start at least 1 hour before sunset at ${twelveHour(sunsetStr)} to allow foragers to return)`,
        );
      }
      let penalty = 0;
      if (delta >= 4.0) issues.push(`Imminent severe barometric front (Delta P = ${delta.toFixed(1)} mb)`);
      else if (delta >= 1.5) penalty = -2;

      const Tr = Math.round(T);
      const breakdown = {
        Temperature: Tr >= 68 && Tr <= 85 ? 3 : (Tr >= 58 && Tr <= 67) || (Tr >= 86 && Tr <= 91) ? 1 : 0,
        'Time of Day': safe && T1 >= 55 ? 2 : 0,
        'Sky Condition': C < 30 ? 2 : C <= 70 ? 1 : 0,
        'Wind Speed': W < 10 ? 2 : W <= 15 ? 1 : 0,
      };
      const sum = breakdown.Temperature + breakdown['Time of Day'] + breakdown['Sky Condition'] + breakdown['Wind Speed'];
      const score = Math.max(0, sum + penalty);

      out.push({
        date,
        hour,
        scoreV2: score,
        classification: classify(score, issues),
        tempF: T,
        windMph: W,
        cloud: C,
        precipProb: Pp,
        pressureHpa: p,
        pressureDelta3hr: delta,
        breakdownV2: breakdown,
        issuesV2: issues,
        condition: conditionText(code),
      });
    }
  }
  return out;
}
