export interface SwarmDataPoint {
  date: string;
  probability: number;
  color: string;
}

export interface SwarmAnalysisResult {
  currentProbability: number;
  currentColor: string;
  baselineNDVI: number | null;
  currentNDVI: number | null;
  chartData: SwarmDataPoint[];
  lastYearData: SwarmDataPoint[];
  averageData: SwarmDataPoint[];
  executiveSummary: string;
  primaryDriver: string;
  peakGDD: number;
}

export class SwarmService {
  private static AGRO_API_KEY = import.meta.env.VITE_AGRO_API_KEY || 'mock_key';
  
  private static getPolygonGeoJSON(lat: number, lng: number) {
    const offset = 0.0006; 
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [lng - offset, lat - offset],
            [lng - offset, lat + offset],
            [lng + offset, lat + offset],
            [lng + offset, lat - offset],
            [lng - offset, lat - offset]
          ]
        ]
      }
    };
  }

  private static async getPolygonId(lat: number, lng: number): Promise<string | null> {
    if (this.AGRO_API_KEY === 'mock_key') return 'mock_poly_id';
    try {
      const geojson = this.getPolygonGeoJSON(lat, lng);
      const res = await fetch(`https://api.agromonitoring.com/agro/1.0/polygons?appid=${this.AGRO_API_KEY}&duplicated=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Apiary_${Date.now()}`,
          geo_json: geojson
        })
      });
      if (!res.ok) throw new Error("Failed to create polygon");
      const data = await res.json();
      return data.id || null;
    } catch (e) {
      console.error("Agromonitoring polygon error:", e);
      return null;
    }
  }

  private static async getNDVIData(polygonId: string): Promise<{ baseline: number, current: number, dearthDrop: boolean } | null> {
    if (this.AGRO_API_KEY === 'mock_key' || !polygonId) {
      return { baseline: 0.4, current: 0.65, dearthDrop: false };
    }
    try {
      // Baseline
      const currentYear = new Date().getFullYear();
      const jan1 = new Date(`${currentYear}-01-01T00:00:00Z`);
      const jan31 = new Date(`${currentYear}-01-31T00:00:00Z`);
      const startUnix = Math.floor(jan1.getTime() / 1000);
      const endUnix = Math.floor(jan31.getTime() / 1000);

      const janData = await fetch(`https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${startUnix}&end=${endUnix}&appid=${this.AGRO_API_KEY}`);
      const janJson = await janData.json();
      const baseline = (janJson && janJson.length > 0) ? janJson[0].data.mean : 0.4;

      // Current & History (Last 30 days) to calculate 7-day drop
      const currentEndUnix = Math.floor(Date.now() / 1000);
      const currentStartUnix = currentEndUnix - (30 * 24 * 60 * 60);
      
      const currentData = await fetch(`https://api.agromonitoring.com/agro/1.0/ndvi/history?polyid=${polygonId}&start=${currentStartUnix}&end=${currentEndUnix}&appid=${this.AGRO_API_KEY}`);
      const currentJson = await currentData.json();
      
      let current = 0.6;
      let dearthDrop = false;

      if (currentJson && currentJson.length > 0) {
        current = currentJson[currentJson.length - 1].data.mean;
        
        // Find a reading roughly 7-14 days ago to compare
        const oneWeekAgoUnix = currentEndUnix - (7 * 24 * 60 * 60);
        const olderReading = currentJson.find((p: any) => p.dt <= oneWeekAgoUnix);
        
        if (olderReading) {
           const oldMean = olderReading.data.mean;
           if ((oldMean - current) > 0.05) {
               dearthDrop = true; // Drop of more than 0.05
           }
        }
      }

      return { baseline, current, dearthDrop };
    } catch (e) {
      console.error("NDVI fetch error:", e);
      return null;
    }
  }

  private static async getHistoricalWeather(lat: number, lng: number): Promise<{ time: string[], tmax: number[], tmin: number[], precip: number[], wind: number[], isUS: boolean } | null> {
    try {
      const currentYear = new Date().getFullYear();
      // Fetch 5 full years plus current year
      const startDate = `${currentYear - 5}-01-01`;
      
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const endDate = `${currentYear}-${month}-${day}`;

      const isUS = lat > 24 && lat < 50 && lng < -66 && lng > -125;
      
      let url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`;
      
      if (isUS) {
        url += '&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch';
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather API failed");
      
      const data = await res.json();
      if (!data?.daily) return null;

      return {
        time: data.daily.time,
        tmax: data.daily.temperature_2m_max,
        tmin: data.daily.temperature_2m_min,
        precip: data.daily.precipitation_sum,
        wind: data.daily.wind_speed_10m_max,
        isUS
      };
    } catch (e) {
      console.error("Open-Meteo error:", e);
      return null;
    }
  }

  static getColorForProbability(prob: number): string {
    if (prob <= 40) return '#4CAF50'; // Green
    if (prob <= 75) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  }

  private static getMaxThresh(isUS: boolean): number {
    const scale = isUS ? 1.0 : (1.0 / 1.8);
    return 1000 * scale;
  }

  private static getBaseProbability(gdd: number, isUS: boolean): number {
    const scale = isUS ? 1.0 : (1.0 / 1.8);
    
    const startThresh = 300 * scale;
    const midThresh = 600 * scale;
    const maxThresh = this.getMaxThresh(isUS);

    if (gdd < startThresh) return 0;
    if (gdd > maxThresh) return 100;
    
    if (gdd <= midThresh) {
      return ((gdd - startThresh) / (midThresh - startThresh)) * 80;
    } else {
      return 80 + ((gdd - midThresh) / (maxThresh - midThresh)) * 20;
    }
  }

  static async generateSwarmAnalysis(lat: number, lng: number): Promise<SwarmAnalysisResult | null> {
    try {
      const polyId = await this.getPolygonId(lat, lng);
      const ndviData = polyId ? await this.getNDVIData(polyId) : null;
      
      const weatherData = await this.getHistoricalWeather(lat, lng);
      if (!weatherData) return null;

      const isUS = weatherData.isUS;
      const baseTemp = isUS ? 50 : 10;
      const clearTemp = isUS ? 65 : 18; 
      const clearWind = isUS ? 10 : 15; 
      
      const baseline = ndviData?.baseline || 0.4;
      const currentNDVI = ndviData?.current || 0.4;
      
      let primaryDriver = "Driven by steady GDD accumulation.";

      // Group weather data by year
      const yearsData: { [year: string]: any[] } = {};
      
      for (let i = 0; i < weatherData.time.length; i++) {
        const dateStr = weatherData.time[i];
        const year = dateStr.substring(0, 4);
        
        if (!yearsData[year]) yearsData[year] = [];
        
        yearsData[year].push({
          date: dateStr,
          mmdd: dateStr.substring(5),
          tmax: weatherData.tmax[i],
          tmin: weatherData.tmin[i],
          precip: weatherData.precip[i],
          wind: weatherData.wind[i],
          originalIndex: i
        });
      }

      const currentYear = new Date().getFullYear();
      const currentYearStr = String(currentYear);
      
      const calculatedYears: { [year: string]: SwarmDataPoint[] } = {};
      let peakGDDThisYear = 0;

      // Process each year independently
      for (const year of Object.keys(yearsData)) {
        let cumulativeGDD = 0;
        const yearPoints = yearsData[year];
        const chartData: SwarmDataPoint[] = [];

        const june21Str = `${year}-06-21`;
        const june21Obj = new Date(june21Str);

        for (let i = 0; i < yearPoints.length; i++) {
          const pt = yearPoints[i];
          
          if (pt.tmax !== null && pt.tmin !== null) {
            const avgTemp = (pt.tmax + pt.tmin) / 2;
            const gdd = Math.max(avgTemp - baseTemp, 0);
            
            // Invert GDD accumulation after June 21st
            const ptDateObj = new Date(pt.date);
            if (ptDateObj > june21Obj) {
                const daysPostSolstice = Math.max(0, Math.floor((ptDateObj.getTime() - june21Obj.getTime()) / (1000 * 60 * 60 * 24)));
                
                // 1. Ramps up over 45 days to delay the start of the drop (creates the smooth top rollover)
                const startRamp = Math.min(1, daysPostSolstice / 45); 
                
                // 2. Asymptotic landing: as GDD drains, the subtraction slows down (creates the smooth bottom tail)
                const gddRatio = cumulativeGDD / this.getMaxThresh(isUS);
                
                const dampening = startRamp * gddRatio * 0.7; // Max dampening of 0.7
                
                cumulativeGDD -= (gdd * Math.max(0.03, dampening));
            } else {
                cumulativeGDD += gdd;
                // Cap the accumulated GDD at the max threshold so it doesn't build a massive 
                // invisible buffer that delays the start of the summer decline.
                cumulativeGDD = Math.min(cumulativeGDD, this.getMaxThresh(isUS));
            }
            
            // Prevent cumulative GDD from going below 0
            cumulativeGDD = Math.max(0, cumulativeGDD);
          }

          let dailyProb = this.getBaseProbability(cumulativeGDD, isUS);
          
          // Pressure Cooker (Needs last 3 days within the same year)
          if (i >= 3) {
            const p1 = yearPoints[i-1].precip;
            const p2 = yearPoints[i-2].precip;
            const p3 = yearPoints[i-3].precip;
            const todayPrecip = pt.precip;
            
            if (p1 > 0 && p2 > 0 && p3 > 0 && todayPrecip === 0 && pt.tmax > clearTemp && pt.wind < clearWind) {
                // Lowered to 1.08 to prevent visually jarring spikes while preserving the historical event data
                dailyProb *= 1.08;
                if (year === currentYearStr && i === yearPoints.length - 1) {
                    primaryDriver = "The upcoming sunny window after extended rain makes a swarm issuance highly likely.";
                }
            }
          }

          // Apply NDVI modifiers ONLY for the current year
          if (year === currentYearStr) {
            if ((currentNDVI - baseline) > 0.20) {
                dailyProb *= 1.25;
                if (i === yearPoints.length - 1 && primaryDriver === "Driven by steady GDD accumulation.") {
                    primaryDriver = "Driven by a rapid GDD accumulation and high vegetation vigor (Nectar Surge).";
                }
            }
          }

          dailyProb = Math.min(100, Math.max(0, dailyProb));
          
          chartData.push({
            date: pt.date, // Used as MMDD key effectively later
            probability: dailyProb,
            color: this.getColorForProbability(dailyProb)
          });
        }

        if (year === currentYearStr) {
            peakGDDThisYear = cumulativeGDD;
        }

        // Apply NDVI Dearth
        for (let i = 0; i < chartData.length; i++) {
          // Apply NDVI dearth ONLY for current year
          if (year === currentYearStr && ndviData?.dearthDrop && i >= chartData.length - 7) {
              chartData[i].probability -= 20;
              if (i === chartData.length - 1) {
                  primaryDriver = "Swarm likelihood reduced due to a recent drop in vegetation index (Nectar Dearth).";
              }
          }

          chartData[i].probability = Math.min(100, Math.max(0, Math.round(chartData[i].probability)));
          chartData[i].color = this.getColorForProbability(chartData[i].probability);
        }

        // Apply a 10-day moving average to perfectly smooth any remaining piecewise "kinks"
        // and transform short-term weather jumps into gentle biological curves.
        const smoothedChartData: SwarmDataPoint[] = [];
        for (let i = 0; i < chartData.length; i++) {
            let sum = 0;
            let count = 0;
            const window = 5; // 5 days back, 5 days forward = 11 day window
            for (let j = Math.max(0, i - window); j <= Math.min(chartData.length - 1, i + window); j++) {
                sum += chartData[j].probability;
                count++;
            }
            const smoothedProb = Math.round(sum / count);
            smoothedChartData.push({
                ...chartData[i],
                probability: smoothedProb,
                color: this.getColorForProbability(smoothedProb)
            });
        }

        calculatedYears[year] = smoothedChartData;
      }

      // Flatten all calculated years into a single map for easy lookup
      const flatDataMap = new Map<string, SwarmDataPoint>();
      for (const year in calculatedYears) {
          calculatedYears[year].forEach(pt => flatDataMap.set(pt.date, pt));
      }

      // Generate rolling 365 days dates
      const rolling365Dates: string[] = [];
      const todayDate = new Date();
      for (let i = 364; i >= 0; i--) {
         const d = new Date(todayDate);
         d.setDate(d.getDate() - i);
         rolling365Dates.push(d.toISOString().split('T')[0]);
      }

      const currentChartData: SwarmDataPoint[] = [];
      const lastYearChartData: SwarmDataPoint[] = [];
      const averageChartData: SwarmDataPoint[] = [];

      rolling365Dates.forEach(dateStr => {
          // Current Year
          const currentPt = flatDataMap.get(dateStr);
          if (currentPt) currentChartData.push(currentPt);

          // Last Year
          const d = new Date(dateStr);
          d.setFullYear(d.getFullYear() - 1);
          const lastYearDateStr = d.toISOString().split('T')[0];
          const lastYearPt = flatDataMap.get(lastYearDateStr);
          
          if (lastYearPt) {
             lastYearChartData.push({
                date: dateStr, // Align to current rolling window date for X-axis
                probability: lastYearPt.probability,
                color: '#d97706'
             });
          }

          // 5-Year Average
          let sum = 0;
          let count = 0;
          for (let y = 1; y <= 5; y++) {
             const pastDate = new Date(dateStr);
             pastDate.setFullYear(pastDate.getFullYear() - y);
             const pastDateStr = pastDate.toISOString().split('T')[0];
             const pt = flatDataMap.get(pastDateStr);
             if (pt) {
                sum += pt.probability;
                count++;
             }
          }
          if (count > 0) {
             averageChartData.push({
                 date: dateStr,
                 probability: Math.round(sum / count),
                 color: '#0ea5e9'
             });
          }
      });

      const currentProb = currentChartData.length > 0 ? currentChartData[currentChartData.length - 1].probability : 0;
      const currentColor = currentChartData.length > 0 ? currentChartData[currentChartData.length - 1].color : '#95a5a6';

      let riskLevel = "";
      if (currentProb >= 76) riskLevel = "Extreme";
      else if (currentProb >= 41) riskLevel = "Moderate";
      else riskLevel = "Low";

      return {
        currentProbability: currentProb,
        currentColor: currentColor,
        baselineNDVI: ndviData?.baseline || null,
        currentNDVI: ndviData?.current || null,
        chartData: currentChartData,
        lastYearData: lastYearChartData,
        averageData: averageChartData,
        executiveSummary: `Current Risk: [${riskLevel}]`,
        primaryDriver: primaryDriver,
        peakGDD: Math.round(peakGDDThisYear)
      };

    } catch (e) {
      console.error("Swarm analysis failed:", e);
      return null;
    }
  }
}
