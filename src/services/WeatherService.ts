export interface InspectionWindow {
    time: string;
    temperature: number;
    windSpeed: number;
    cloudCover: number;
    precipitationProbability: number;
    humidity: number;
    weatherCode: number;
    isDaylight: boolean;
    score: number;
    rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Not Rec';
    isHardLimit: boolean;
    breakdown: {
        temp: number;
        cloud: number;
        wind: number;
        precip: number;
        humidity: number;
    };
    goodConditions: string[];
    badConditions: string[];
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

        const { time, temperature_2m, windspeed_10m, cloudcover, precipitation_probability, relative_humidity_2m, weathercode } = weatherData.hourly;
        const windows: InspectionWindow[] = [];

        for (let i = 0; i < time.length; i++) {
            const date = new Date(time[i]);
            const hour = date.getHours();
            
            // We want 6am to 5pm to match the V1 Grid
            const isDaylight = hour >= 6 && hour <= 17;
            if (!isDaylight) continue;

            const temp = temperature_2m[i];
            const wind = windspeed_10m[i];
            const cloud = cloudcover[i];
            const precipProb = precipitation_probability[i];
            const code = weathercode[i];
            const humidity = relative_humidity_2m[i];

            // 1. Point Breakdown Calculation
            let tempPts = 0;
            if (temp >= 75) tempPts = 40;
            else if (temp >= 70) tempPts = 37;
            else if (temp >= 65) tempPts = 33;
            else if (temp >= 60) tempPts = 27;
            else if (temp >= 57) tempPts = 18;
            else if (temp >= 55) tempPts = 8;
            else tempPts = 0;

            let cloudPts = 0;
            if (cloud < 25) cloudPts = 20;        // Sunny
            else if (cloud < 60) cloudPts = 17;   // Partly Cloudy
            else if (cloud < 85) cloudPts = 12;   // Mostly Cloudy
            else cloudPts = 6;                    // Overcast

            let windPts = 0;
            if (wind < 5) windPts = 20;
            else if (wind < 10) windPts = 18;
            else if (wind < 15) windPts = 12;
            else if (wind < 20) windPts = 6;
            else if (wind < 24) windPts = 2;
            else windPts = 0;

            let precipPts = 0;
            if (precipProb === 0) precipPts = 15;
            else if (precipProb <= 10) precipPts = 12;
            else if (precipProb <= 20) precipPts = 8;
            else if (precipProb <= 35) precipPts = 4;
            else if (precipProb <= 49) precipPts = 1;
            else precipPts = 0;

            let humidityPts = 0;
            if (humidity >= 30 && humidity <= 70) humidityPts = 5;

            let score = tempPts + cloudPts + windPts + precipPts + humidityPts;

            // 2. TBH Heat Penalty
            if (temp > 80) {
                const degreesOver = temp - 80;
                const penaltyMultiplier = Math.floor(degreesOver / 5) + 1;
                score -= (penaltyMultiplier * 10);
            }

            // 3. Condition Strings
            const goodConditions: string[] = [];
            const badConditions: string[] = [];

            if (tempPts >= 33) goodConditions.push(`Good temperature (${Math.round(temp)}°F)`);
            if (windPts >= 18) goodConditions.push(`Light winds (${Math.round(wind)}mph)`);
            if (cloudPts >= 17) goodConditions.push(`Sunny (${Math.round(cloud)}% clouds)`);
            if (precipPts === 15) goodConditions.push(`No rain expected`);

            let isHardLimit = false;

            if (score < 40) {
                isHardLimit = true;
                badConditions.push('Overall score too low');
            }
            if (temp < 55) {
                isHardLimit = true;
                badConditions.push(`Too cold (${Math.round(temp)}°F)`);
            }
            if (temp > 92) {
                isHardLimit = true;
                badConditions.push(`Hard Fail: Heat danger to TBH comb (${Math.round(temp)}°F)`);
            }
            if (wind > 24) {
                isHardLimit = true;
                badConditions.push(`High winds (${Math.round(wind)}mph)`);
            }
            if (precipProb > 49) {
                isHardLimit = true;
                badConditions.push(`High rain chance (${Math.round(precipProb)}%)`);
            }
            if ([51,53,55,61,63,65,71,73,75,80,81,82,95,96,99].includes(code)) {
                isHardLimit = true;
                badConditions.push('Active rain/storms');
            }

            // Score Floor
            if (score < 0) score = 0;

            // 4. Rating Tier
            let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Not Rec';
            if (score >= 85) rating = 'Excellent';
            else if (score >= 70) rating = 'Good';
            else if (score >= 55) rating = 'Fair';
            else if (score >= 40) rating = 'Poor';
            else rating = 'Not Rec';

            windows.push({
                time: time[i],
                temperature: temp,
                windSpeed: wind,
                cloudCover: cloud,
                precipitationProbability: precipProb,
                humidity: humidity,
                weatherCode: code,
                isDaylight,
                score,
                rating,
                isHardLimit,
                breakdown: {
                    temp: tempPts,
                    cloud: cloudPts,
                    wind: windPts,
                    precip: precipPts,
                    humidity: humidityPts
                },
                goodConditions,
                badConditions
            });
        }

        return windows;
    }
}
