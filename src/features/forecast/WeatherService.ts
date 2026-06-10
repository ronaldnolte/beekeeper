export interface InspectionWindow {
    startTime: Date;
    endTime: Date;
    score: number;
    tempF: number;
    windMph: number;
    cloudCover: number;
    precipProb: number;
    humidity: number;
    condition: string;
    issues: string[];
    scoreBreakdown: Record<string, number>;
    displayHour: number;
    displayDate: string;
    
    // V2 Scoring System
    scoreV2: number;
    classificationV2: 'Optimal' | 'Viable' | 'Inadvisable';
    issuesV2: string[];
    scoreBreakdownV2: Record<string, number>;
    pressureHpa: number;
    pressureTrend: number;
    pressureDelta3hr: number;
}

export class WeatherService {
    private static WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';

    /**
     * Get logic coordinates from Zip Code
     */
    static async getCoordinates(zip: string, country: string = 'us'): Promise<{ lat: number; lng: number }> {
        const countryCode = country.toLowerCase();
        let searchZip = zip;

        if (countryCode === 'gb') {
            searchZip = zip.split(' ')[0].trim();
        } else if (countryCode === 'ca') {
            searchZip = zip.substring(0, 3);
        } else if (countryCode === 'nl') {
            searchZip = zip.substring(0, 4);
        }

        const response = await fetch(`https://api.zippopotam.us/${countryCode}/${searchZip}`);
        if (response.ok) {
            const data = await response.json() as any;
            const place = data.places[0];
            return {
                lat: parseFloat(place.latitude),
                lng: parseFloat(place.longitude),
            };
        } else {
            throw new Error(`Invalid Postal Code for ${country.toUpperCase()}`);
        }
    }

    /**
     * Determine the best Open-Meteo model based on country code.
     */
    static getModelForCountry(countryCode?: string): string {
        const code = (countryCode || 'us').toLowerCase();
        const americas = ['us', 'ca', 'mx', 'br', 'ar', 'cl', 'co', 'pe', 've', 'ec', 'bo', 'py', 'uy', 'gf', 'sr', 'gy', 'bz', 'gt', 'hn', 'sv', 'ni', 'cr', 'pa', 'cu', 'jm', 'ht', 'do', 'pr', 'tt', 'bb', 'bs', 'ag', 'dm', 'gd', 'kn', 'lc', 'vc'];
        if (americas.includes(code)) return 'gfs_seamless';

        const europe = ['gb', 'de', 'fr', 'it', 'es', 'pt', 'nl', 'be', 'at', 'ch', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'hr', 'si', 'rs', 'ba', 'me', 'mk', 'al', 'gr', 'dk', 'no', 'se', 'fi', 'ee', 'lv', 'lt', 'ie', 'is', 'lu', 'mt', 'cy', 'ua', 'by', 'md'];
        if (europe.includes(code)) return 'icon_seamless';

        return 'ecmwf_ifs025';
    }

    /**
     * Fetch raw weather data (Includes pressure_msl and surface_pressure for storm tracking)
     */
    static async getWeatherForecast(lat: number, lng: number, elevation?: number, countryCode?: string): Promise<any> {
        const model = this.getModelForCountry(countryCode);
        let url = `${this.WEATHER_API_URL}?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weathercode,cloudcover,windspeed_10m,pressure_msl,surface_pressure&daily=sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=7&models=${model}`;

        if (elevation !== undefined) {
            url += `&elevation=${elevation}`;
        }
        const response = await fetch(url);
        if (response.ok) {
            return response.json();
        } else {
            throw new Error('Failed to load weather data');
        }
    }

    /**
     * Calculate 1-hour inspection windows for beekeeping
     */
    static calculateForecast(weatherData: any, isTBH: boolean = false, isMetric: boolean = false): InspectionWindow[] {
        const windows: InspectionWindow[] = [];
        const hourly = weatherData.hourly;
        const daily = weatherData.daily || {};
        const dailyTimes = (daily.time || []) as string[];
        const sunrises = (daily.sunrise || []) as string[];
        const sunsets = (daily.sunset || []) as string[];

        const times = hourly.time as string[];
        const temps = hourly.temperature_2m as number[];
        const humidities = hourly.relative_humidity_2m as number[];
        const precipProbs = hourly.precipitation_probability as number[];
        const precips = hourly.precipitation as number[];
        const codes = hourly.weathercode as number[];
        const clouds = hourly.cloudcover as number[];
        const winds = hourly.windspeed_10m as number[];
        const pressures = (hourly.pressure_msl || []) as number[];
        const surfacePressures = (hourly.surface_pressure || hourly.pressure_msl || []) as number[];

        // Group indices by Date (yyyy-MM-dd)
        const dayIndices: Record<string, number[]> = {};
        for (let i = 0; i < times.length; i++) {
            const dayKey = times[i].slice(0, 10);
            if (!dayIndices[dayKey]) dayIndices[dayKey] = [];
            dayIndices[dayKey].push(i);
        }

        // Dynamically compute the earliest sunrise hour and latest sunset hour of the week
        let earliestSunriseHour = 6; // default fallback
        let latestSunsetHour = 18;  // default fallback

        if (sunrises.length > 0) {
            const sunriseHours = sunrises.map(s => parseInt(s.slice(11, 13)));
            earliestSunriseHour = Math.min(...sunriseHours);
        }

        if (sunsets.length > 0) {
            const sunsetHours = sunsets.map(s => {
                const hourPart = parseInt(s.slice(11, 13));
                const minutePart = parseInt(s.slice(14, 16));
                // Ceil the sunset hour so we completely cover the hour during which sunset occurs
                return minutePart > 0 ? hourPart + 1 : hourPart;
            });
            latestSunsetHour = Math.max(...sunsetHours);
        }

        // Apply sensible constraints
        earliestSunriseHour = Math.max(0, Math.min(earliestSunriseHour, 12));
        latestSunsetHour = Math.min(23, Math.max(latestSunsetHour, 12));

        // Generate target start hours dynamically
        const targetStartHours: number[] = [];
        for (let h = earliestSunriseHour; h < latestSunsetHour; h++) {
            targetStartHours.push(h);
        }

        // Iterate over each day
        for (const dayKey in dayIndices) {
            const indices = dayIndices[dayKey];

            for (const startHour of targetStartHours) {
                let startIndex: number | undefined;
                for (const idx of indices) {
                    const hour = parseInt(times[idx].slice(11, 13));
                    if (hour === startHour) {
                        startIndex = idx;
                        break;
                    }
                }

                if (startIndex !== undefined) {
                    const i = startIndex;

                    const temp = temps[i];
                    const wind = winds[i];
                    const cloud = clouds[i];
                    const precipProb = precipProbs[i];
                    const precip = precips[i];
                    const code = codes[i];
                    const humidity = humidities[i];
                    const pressure = pressures[i] || 1013.25;

                    const prevPressure = i > 0 ? (pressures[i - 1] || pressure) : pressure;
                    const pressureTrend = prevPressure - pressure; 

                    const issues: string[] = [];
                    const tempStr = (t: number) => isMetric ? `${Math.round((t - 32) * 5 / 9)}°C` : `${Math.round(t)}°F`;

                    if (temp < 55) issues.push(`Too Cold (< ${tempStr(55)})`);
                    if (wind > 24) {
                        const speedStr = isMetric ? `${Math.round(24 * 1.60934)}km/h` : `24mph`;
                        issues.push(`Too Windy (> ${speedStr})`);
                    }
                    if (precipProb > 49) issues.push("Rain Likely (> 49%)");
                    if (precip > 0.02) issues.push("Raining");
                    if ([95, 96, 99].includes(code)) issues.push("Stormy Weather");

                    if (isTBH && temp > 92) issues.push(`Temperature > ${tempStr(92)} (comb slump risk)`);

                    let totalScore = 0;
                    const breakdown: Record<string, number> = {};

                    // 1. Temperature (Max 40)
                    let tempScore = 0;
                    if (temp >= 75) tempScore = 40;
                    else if (temp >= 70) tempScore = 37;
                    else if (temp >= 65) tempScore = 33;
                    else if (temp >= 60) tempScore = 27;
                    else if (temp >= 57) tempScore = 18;
                    else if (temp >= 55) tempScore = 8;

                    if (isTBH && temp > 80) {
                        const degreesAbove80 = temp - 80;
                        const penalty = Math.floor(degreesAbove80 / 5) * 10;
                        tempScore = Math.max(0, tempScore - penalty);
                    }

                    breakdown['Temperature'] = tempScore;
                    totalScore += tempScore;

                    // 2. Cloud Cover (Max 20)
                    let cloudScore = 0;
                    if (cloud <= 20) cloudScore = 20;
                    else if (cloud <= 40) cloudScore = 17;
                    else if (cloud <= 60) cloudScore = 12;
                    else if (cloud <= 80) cloudScore = 6;
                    else cloudScore = 6;
                    breakdown['Cloud Cover'] = cloudScore;
                    totalScore += cloudScore;

                    // 3. Wind (Max 20)
                    let windScore = 0;
                    if (wind <= 5) windScore = 20;
                    else if (wind <= 10) windScore = 18;
                    else if (wind <= 15) windScore = 12;
                    else if (wind <= 20) windScore = 6;
                    else if (wind <= 24) windScore = 2;
                    breakdown['Wind Speed'] = windScore;
                    totalScore += windScore;

                    // 4. Precipitation Probability (Max 15)
                    let precipScore = 0;
                    if (precipProb === 0) precipScore = 15;
                    else if (precipProb <= 10) precipScore = 12;
                    else if (precipProb <= 20) precipScore = 8;
                    else if (precipProb <= 35) precipScore = 4;
                    else if (precipProb <= 49) precipScore = 1;
                    breakdown['Precipitation'] = precipScore;
                    totalScore += precipScore;

                    // 5. Humidity (Max 5)
                    const humidityScore = (humidity >= 30 && humidity <= 70) ? 5 : 0;
                    breakdown['Humidity'] = humidityScore;
                    totalScore += humidityScore;

                    // ============================================
                    // V2 DECISION MATRIX CALCULATION (0-9 POINTS)
                    // ============================================
                    const issuesV2: string[] = [];

                    const dailyIdx = dailyTimes.indexOf(dayKey);
                    let sunsetHour = 18; 
                    let sunsetMinute = 0;
                    if (dailyIdx !== -1 && sunsets[dailyIdx]) {
                        const sunsetStr = sunsets[dailyIdx];
                        sunsetHour = parseInt(sunsetStr.slice(11, 13));
                        sunsetMinute = parseInt(sunsetStr.slice(14, 16));
                    }

                    const sunsetTimeInMinutes = sunsetHour * 60 + sunsetMinute;
                    const slotStartTimeInMinutes = startHour * 60;
                    const isSafeBeforeSunset = slotStartTimeInMinutes <= (sunsetTimeInMinutes - 60);

                    const temp1HourAgo = i > 0 ? (temps[i - 1] ?? temp) : temp;
                    const isWarmEnough1HourAgo = temp1HourAgo >= 55;

                    if (temp < 57) {
                        issuesV2.push(`Brood Chill Threshold Triggered (Temp < 57°F / 14°C)`);
                    }
                    if (temp > 92) {
                        issuesV2.push(`Comb Heat/Heat Stroke Threshold Triggered (Temp > 92°F / 33°C)`);
                    }
                    
                    const hasRainV2 = precip > 0.02 || [95, 96, 99].includes(code) || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || precipProb >= 50;
                    if (hasRainV2) {
                        issuesV2.push(`Active Precipitation Triggered`);
                    }

                    if (wind > 18) {
                        const wStr = isMetric ? `${Math.round(18 * 1.60934)}km/h` : `18mph`;
                        issuesV2.push(`Flight Disruption Wind Triggered (Wind > ${wStr})`);
                    }

                    if (!isWarmEnough1HourAgo) {
                        issuesV2.push(`Bees not awake (temperature 1 hour ago was ${Math.round(temp1HourAgo)}°F, must be 55°F+ for at least 1 hour)`);
                    }

                    if (!isSafeBeforeSunset) {
                        const sunsetTimeStr = `${sunsetHour > 12 ? sunsetHour - 12 : sunsetHour}:${sunsetMinute.toString().padStart(2, '0')}${sunsetHour >= 12 ? 'pm' : 'am'}`;
                        issuesV2.push(`Too close to sunset (must start at least 1 hour before sunset at ${sunsetTimeStr} to allow foragers to return)`);
                    }

                    const getSmoothedSurfacePressure = (index: number): number => {
                        const p1 = surfacePressures[index] || pressure;
                        const p2 = index > 0 ? (surfacePressures[index - 1] || p1) : p1;
                        const p3 = index > 1 ? (surfacePressures[index - 2] || p2) : p2;
                        return (p1 + p2 + p3) / 3;
                    };

                    const s_current = getSmoothedSurfacePressure(i);
                    const s_oldest = i >= 3 ? getSmoothedSurfacePressure(i - 3) : getSmoothedSurfacePressure(0);
                    const pressureDelta3hr = s_oldest - s_current; 
                    
                    let pressure_penalty = 0;
                    if (pressureDelta3hr >= 4.0) {
                        issuesV2.push(`Imminent severe barometric front (Delta P = ${pressureDelta3hr.toFixed(1)} mb)`);
                    } else if (pressureDelta3hr >= 1.5) {
                        pressure_penalty = -2;
                    }

                    let tempPts = 0;
                    let timePts = 0;
                    let skyPts = 0;
                    let windPts = 0;

                    const tempRounded = Math.round(temp);
                    if (tempRounded >= 68 && tempRounded <= 85) tempPts = 3;
                    else if ((tempRounded >= 58 && tempRounded <= 67) || (tempRounded >= 86 && tempRounded <= 91)) tempPts = 1;
                    
                    if (isSafeBeforeSunset && temp1HourAgo >= 55) {
                        timePts = 2;
                    }
                    
                    if (wind < 10) windPts = 2;
                    else if (wind >= 10 && wind <= 15) windPts = 1;

                    if (cloud < 30) skyPts = 2;
                    else if (cloud >= 30 && cloud <= 70) skyPts = 1;

                    const scoreV2 = Math.max(0, tempPts + timePts + skyPts + windPts + pressure_penalty);
                    
                    let classificationV2: 'Optimal' | 'Viable' | 'Inadvisable' = 'Inadvisable';
                    if (issuesV2.length > 0) {
                        classificationV2 = 'Inadvisable';
                    } else {
                        if (scoreV2 >= 7) classificationV2 = 'Optimal';
                        else if (scoreV2 >= 4) classificationV2 = 'Viable';
                        else classificationV2 = 'Inadvisable';
                    }

                    const breakdownV2 = {
                        'Temperature': tempPts,
                        'Time of Day': timePts,
                        'Sky Condition': skyPts,
                        'Wind Speed': windPts
                    };

                    windows.push({
                        startTime: new Date(times[i]),
                        endTime: new Date(new Date(times[i]).getTime() + 1 * 60 * 60 * 1000),
                        score: totalScore,
                        tempF: temp,
                        windMph: wind,
                        cloudCover: cloud,
                        precipProb: precipProb,
                        humidity: humidity,
                        condition: this.getConditionCode(code),
                        issues: issues,
                        scoreBreakdown: breakdown,
                        displayHour: startHour,
                        displayDate: dayKey,
                        
                        scoreV2,
                        classificationV2,
                        issuesV2,
                        scoreBreakdownV2: breakdownV2,
                        pressureHpa: pressure,
                        pressureTrend,
                        pressureDelta3hr
                    });
                }
            }
        }
        return windows;
    }

    static getConditionCode(code: number): string {
        if (code === 0) return 'Clear';
        if (code <= 3) return 'Partly Cloudy';
        if (code <= 48) return 'Foggy';
        if (code <= 67) return 'Rainy';
        if (code <= 77) return 'Snowy';
        if (code <= 82) return 'Rain Showers';
        return 'Stormy';
    }
}
