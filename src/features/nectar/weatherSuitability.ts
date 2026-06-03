export interface WeatherSuitabilityInput {
  date: string;
  lat: number;
  lon: number;
  temperature_max?: number | null;
  temperature_min?: number | null;
  rain_last_7_days?: number | null;
  drought_index?: number | null; // optional, 0-4
  wind_speed_avg?: number | null;
}

export interface WeatherSuitabilityResult {
  date: string;
  temp_suitability: number | null;
  rain_suitability: number | null;
  wind_suitability: number | null;
  weather_suitability: number | null;
}

/**
 * Computes a weather suitability factor (0.0 to 1.0) based on temperature, precipitation, and wind.
 * If data is missing/null, returns null instead of simulating it.
 */
export function computeWeatherSuitability(input: WeatherSuitabilityInput): WeatherSuitabilityResult {
  const { date } = input;

  try {
    // 1. Temperature Suitability
    let temp_suit: number | null = null;
    const hasTemp = input.temperature_max !== undefined && input.temperature_max !== null &&
                    input.temperature_min !== undefined && input.temperature_min !== null;

    if (hasTemp) {
      const max = input.temperature_max!;
      const min = input.temperature_min!;
      const temp_mean = (max + min) / 2;

      if (temp_mean >= 70 && temp_mean <= 90) {
        temp_suit = 1.0;
      } else if (temp_mean >= 55 && temp_mean < 70) {
        temp_suit = 0.3 + ((temp_mean - 55) / 15) * 0.7; // linear scale 0.3 to 1.0
      } else if (temp_mean > 90 && temp_mean <= 100) {
        temp_suit = 1.0 - ((temp_mean - 90) / 10) * 0.7; // linear scale 1.0 to 0.3
      } else {
        temp_suit = 0.3;
      }
      temp_suit = Math.min(1.0, Math.max(0.0, temp_suit));
    }

    // 2. Rain / Moisture Suitability
    let rain_suit: number | null = null;
    const hasRain = input.rain_last_7_days !== undefined && input.rain_last_7_days !== null;

    if (hasRain) {
      const rain = input.rain_last_7_days!;
      let rain_component = 0.4;

      if (rain >= 0.5) {
        rain_component = 1.0;
      } else if (rain >= 0.1) {
        rain_component = 0.7;
      } else {
        rain_component = 0.4;
      }

      let drought_penalty = 1.0;
      if (input.drought_index !== undefined && input.drought_index !== null) {
        drought_penalty = 1.0 - (input.drought_index * 0.15);
        drought_penalty = Math.max(0.4, drought_penalty); // Clamp to 0.4 minimum
      }

      rain_suit = rain_component * drought_penalty;
      rain_suit = Math.min(1.0, Math.max(0.0, rain_suit));
    }

    // 3. Wind Suitability
    let wind_suit: number | null = null;
    const hasWind = input.wind_speed_avg !== undefined && input.wind_speed_avg !== null;

    if (hasWind) {
      const wind = input.wind_speed_avg!;
      if (wind < 10) {
        wind_suit = 1.0;
      } else if (wind <= 15) {
        wind_suit = 0.8;
      } else if (wind <= 20) {
        wind_suit = 0.6;
      } else {
        wind_suit = 0.4;
      }
      wind_suit = Math.min(1.0, Math.max(0.0, wind_suit));
    }

    // 4. Combined Weather Suitability
    let weather_suitability: number | null = null;
    if (temp_suit !== null && rain_suit !== null && wind_suit !== null) {
      weather_suitability = temp_suit * rain_suit * wind_suit;
      weather_suitability = Math.min(1.0, Math.max(0.0, weather_suitability));
    }

    return {
      date,
      temp_suitability: temp_suit,
      rain_suitability: rain_suit,
      wind_suitability: wind_suit,
      weather_suitability
    };
  } catch (err) {
    // Log error but never throw unhandled exceptions
    console.error(`Error calculating weather suitability on ${date}:`, err);
    return {
      date,
      temp_suitability: null,
      rain_suitability: null,
      wind_suitability: null,
      weather_suitability: null
    };
  }
}
