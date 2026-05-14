import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../data/supabase';
import { WeatherService } from './WeatherService';
import type { InspectionWindow } from './WeatherService';
import { ArrowLeft } from 'lucide-react';

import { ForecastScoreGuideModal } from './ForecastScoreGuideModal';
import { ForecastDetailModal } from './ForecastDetailModal';

export const ForecastView: React.FC = () => {
  const { selectedApiaryId, goBack } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<InspectionWindow[]>([]);
  const [apiaryName, setApiaryName] = useState('');
  
  // Modal states
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<InspectionWindow | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      if (!selectedApiaryId) return;
      setLoading(true);
      try {
        const { data: apiary, error: apiaryError } = await supabase
          .from('apiaries')
          .select('name, latitude, longitude, zip_code')
          .eq('id', selectedApiaryId)
          .single();

        if (apiaryError) throw apiaryError;
        setApiaryName(apiary.name);

        let lat = apiary.latitude;
        let lng = apiary.longitude;

        if (!lat || !lng) {
            if (apiary.zip_code) {
               const cleanZip = apiary.zip_code.includes(':') ? apiary.zip_code.split(':')[1] : apiary.zip_code;
               const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${cleanZip}&count=1&language=en&format=json`;
               const geoRes = await fetch(geoUrl);
               const geoData = await geoRes.json();
               if (geoData.results && geoData.results.length > 0) {
                   lat = geoData.results[0].latitude;
                   lng = geoData.results[0].longitude;
               } else {
                   throw new Error("Could not find coordinates for Zip Code: " + apiary.zip_code);
               }
            } else {
                throw new Error("Apiary has no location data (no lat/lng or zip code).");
            }
        }

        const weatherData = await WeatherService.getWeatherForecast(lat, lng);
        const windows = WeatherService.calculateForecast(weatherData);
        setForecast(windows);

      } catch (err: any) {
        setError(err.message || 'Failed to load forecast');
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [selectedApiaryId]);

  // Extract unique days
  const uniqueDays = Array.from(new Set(forecast.map(w => {
      const dateStr = w.time.slice(0, 10); // "YYYY-MM-DD"
      // Parse safely at noon to avoid timezone day-shifting
      const d = new Date(dateStr + "T12:00:00");
      return {
          id: dateStr,
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          dateStr: `${d.getMonth() + 1}/${d.getDate()}`
      };
  }))).filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

  // Extract unique hours (6am to 5pm)
  const uniqueHours = Array.from(new Set(forecast.map(w => parseInt(w.time.slice(11, 13))))).sort((a,b) => a-b);

  const getCellColor = (rating: string) => {
      switch (rating) {
          case 'Excellent': return 'bg-[#1E824C]'; // Dark Green
          case 'Good': return 'bg-[#2ECC71]'; // Light Green
          case 'Fair': return 'bg-[#F1C40F]'; // Yellow
          case 'Poor': return 'bg-[#E67E22]'; // Orange
          case 'Not Rec': return 'bg-[#E74C3C]'; // Red
          default: return 'bg-gray-200';
      }
  };

  return (
    <div className="w-full flex flex-col items-center p-2 sm:p-4 pb-24 space-y-4 animate-in slide-in-from-right-4 duration-300 relative min-h-screen">
      
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-center items-center py-2 relative">
        <button 
          onClick={goBack}
          className="absolute left-0 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-black text-[#8B4513]">Hive Forecast</h2>
          <p className="text-sm font-bold text-gray-500">{apiaryName}</p>
        </div>
      </div>

      <div className="w-full max-w-[800px]">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-sm border border-gray-100">
            <div className="w-8 h-8 border-4 border-[#8B4513] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-[#8B4513] animate-pulse">Analyzing meteorological data...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 text-center border-red-200 shadow-sm border">
             <p className="text-red-600 font-bold mb-2">Error</p>
             <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center space-y-4">
              
              {/* Legend Row */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-bold text-gray-600 px-2">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#1E824C]"></div>Excellent 85+</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#2ECC71]"></div>Good 70-84</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#F1C40F]"></div>Fair 55-69</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#E67E22]"></div>Poor 40-54</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#E74C3C]"></div>Not Rec &lt;40</div>
              </div>

              {/* Action Links */}
              <div className="flex items-center justify-center gap-2 text-xs font-bold">
                  <span className="text-gray-400 italic">Tap a score for details</span>
                  <span className="text-gray-300 mx-1">|</span>
                  <button 
                    onClick={() => setIsGuideOpen(true)}
                    className="text-[#E67E22] hover:text-[#D35400] underline underline-offset-2 decoration-dotted"
                  >
                    How are scores calculated?
                  </button>
              </div>

              {/* The Grid */}
              <div className="flex justify-center overflow-x-auto custom-scrollbar">
                  <table className="text-center border-collapse border border-gray-300 bg-white text-[11px]">
                      <thead>
                          <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-2 py-1 font-bold text-gray-800 bg-gray-100 sticky left-0 z-10 text-[10px] w-12">
                                  Time
                              </th>
                              {uniqueDays.map(day => (
                                  <th key={day.id} className="border border-gray-300 px-1 py-1 min-w-[48px]">
                                      <div className="font-bold text-[11px] text-gray-800">{day.dayName}</div>
                                      <div className="text-[9px] text-gray-500">{day.dateStr}</div>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {uniqueHours.map(hour => {
                              const hourStr = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
                              
                              return (
                                  <tr key={hour}>
                                      <td className="border border-gray-300 px-1.5 py-0 font-bold text-gray-800 bg-white sticky left-0 z-10 text-[10px] whitespace-nowrap">
                                          {hourStr}
                                      </td>
                                      {uniqueDays.map(day => {
                                          // Find the forecast window for this day and hour
                                          const window = forecast.find(w => {
                                              const wDate = w.time.slice(0, 10);
                                              const wHour = parseInt(w.time.slice(11, 13));
                                              return wHour === hour && wDate === day.id;
                                          });

                                          if (!window) return <td key={day.id} className="border border-gray-300 bg-gray-100 h-7 w-12"></td>;

                                          const isDarkText = window.isHardLimit;
                                          
                                          return (
                                              <td 
                                                key={day.id} 
                                                onClick={() => setSelectedCell(window)}
                                                className={`border border-gray-300 h-7 w-12 cursor-pointer hover:opacity-80 transition-opacity ${getCellColor(window.rating)}`}
                                              >
                                                  <div className={`flex items-center justify-center h-full font-bold text-sm ${isDarkText ? 'text-black' : 'text-white'}`}>
                                                      {window.score}
                                                  </div>
                                              </td>
                                          );
                                      })}
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
              
              <p className="text-[10px] font-bold text-gray-400 italic mt-2 w-full text-center">
                  White numerals = OK to inspect • Black numerals = Not recommended
              </p>
          </div>
        )}
      </div>

      <ForecastScoreGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <ForecastDetailModal isOpen={!!selectedCell} onClose={() => setSelectedCell(null)} window={selectedCell} />

    </div>
  );
};
