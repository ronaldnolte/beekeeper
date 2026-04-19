export interface InspectionWindow {
    time: string;
    temperature: number;
    windSpeed: number;
    cloudCover: number;
    precipitationProbability: number;
    weatherCode: number;
    isDaylight: boolean;
    score: number;
    rating: 'Good' | 'Marginal' | 'Bad';
    reason: string[];
}

export class WeatherService {
    private static WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';

    static async getWeatherForecast(lat: number, lng: number): Promise<any> {
        // Use generic GFS model for global support
        const model = 'gfs_seamless';
        
        const url = `${this.WEATHER_API_URL}?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weathercode,cloudcover,windspeed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7&models=${model}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Weather API returned ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    }

    static calculateForecast(weatherData: any): InspectionWindow[] {
        if (!weatherData?.hourly) return [];

        const { time, temperature_2m, windspeed_10m, cloudcover, precipitation_probability, weathercode } = weatherData.hourly;
        const windows: InspectionWindow[] = [];

        for (let i = 0; i < time.length; i++) {
            const date = new Date(time[i]);
            const hour = date.getHours();
            
            // Generally only consider daylight hours (8am - 6pm) for beekeeping
            const isDaylight = hour >= 8 && hour <= 18;
            
            if (!isDaylight) continue;

            const temp = temperature_2m[i];
            const wind = windspeed_10m[i];
            const cloud = cloudcover[i];
            const precipProb = precipitation_probability[i];
            const code = weathercode[i];

            let score = 100;
            const reasons: string[] = [];
            let rating: 'Good' | 'Marginal' | 'Bad' = 'Good';

            // Temperature checks (Ideal: 60-90 F)
            if (temp < 55) {
                score -= 60;
                reasons.push('Too Cold');
                rating = 'Bad';
            } else if (temp < 60) {
                score -= 30;
                reasons.push('Chilly');
                if (rating === 'Good') rating = 'Marginal';
            } else if (temp > 95) {
                score -= 50;
                reasons.push('Too Hot');
                rating = 'Bad';
            } else if (temp > 90) {
                score -= 20;
                reasons.push('Very Hot');
                if (rating === 'Good') rating = 'Marginal';
            }

            // Wind checks (Ideal: < 10mph)
            if (wind > 20) {
                score -= 60;
                reasons.push('Too Windy');
                rating = 'Bad';
            } else if (wind > 15) {
                score -= 30;
                reasons.push('Windy');
                if (rating === 'Good') rating = 'Marginal';
            }

            // Rain checks (Ideal: 0%)
            if (precipProb > 50 || [51,53,55,61,63,65,71,73,75,80,81,82,95,96,99].includes(code)) {
                score -= 80;
                reasons.push('Rain Expected');
                rating = 'Bad';
            } else if (precipProb > 20) {
                score -= 30;
                reasons.push('Chance of Rain');
                if (rating === 'Good') rating = 'Marginal';
            }

            windows.push({
                time: time[i],
                temperature: temp,
                windSpeed: wind,
                cloudCover: cloud,
                precipitationProbability: precipProb,
                weatherCode: code,
                isDaylight,
                score,
                rating,
                reason: reasons
            });
        }

        return windows;
    }
}
