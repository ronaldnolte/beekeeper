import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { WeatherService } from '../services/WeatherService';
import type { InspectionWindow } from '../services/WeatherService';
import { ArrowLeft } from 'lucide-react';

import { ForecastScoreGuideModal } from '../components/ForecastScoreGuideModal';
import { ForecastDetailModal } from '../components/ForecastDetailModal';

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
      const d = new Date(w.time);
      return {
          id: d.toLocaleDateString(),
          dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
          dateStr: `${d.getMonth() + 1}/${d.getDate()}`
      };
  }))).filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i); // Ensure uniqueness by id

  // Extract unique hours (6am to 5pm)
  const uniqueHours = Array.from(new Set(forecast.map(w => new Date(w.time).getHours()))).sort((a,b) => a-b);

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
              <div className="w-full overflow-x-auto rounded-xl shadow-lg border border-gray-200 bg-white custom-scrollbar">
                  <table className="w-full text-center border-collapse min-w-[500px]">
                      <thead>
                          <tr className="bg-gray-50 border-b-2 border-gray-200">
                              <th className="py-2 px-2 border-r border-gray-200 text-xs font-black text-gray-800 bg-white sticky left-0 z-10 w-16">
                                  Time
                              </th>
                              {uniqueDays.map(day => (
                                  <th key={day.id} className="py-2 px-1 border-r border-gray-200 last:border-r-0">
                                      <div className="text-xs font-black text-gray-800">{day.dayName}</div>
                                      <div className="text-[10px] font-bold text-gray-500">{day.dateStr}</div>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {uniqueHours.map(hour => {
                              const hourStr = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
                              
                              return (
                                  <tr key={hour} className="border-b border-gray-200 last:border-b-0">
                                      <td className="py-2 px-1 border-r border-gray-200 text-xs font-black text-gray-800 bg-white sticky left-0 z-10">
                                          {hourStr}
                                      </td>
                                      {uniqueDays.map(day => {
                                          // Find the forecast window for this day and hour
                                          const window = forecast.find(w => {
                                              const d = new Date(w.time);
                                              return d.getHours() === hour && d.toLocaleDateString() === day.id;
                                          });

                                          if (!window) return <td key={day.id} className="bg-gray-100 border-r border-gray-200 last:border-r-0"></td>;

                                          const isDarkText = window.isHardLimit;
                                          
                                          return (
                                              <td 
                                                key={day.id} 
                                                onClick={() => setSelectedCell(window)}
                                                className={`py-3 px-1 border-r border-white/20 last:border-r-0 cursor-pointer hover:opacity-80 transition-opacity ${getCellColor(window.rating)}`}
                                              >
                                                  <span className={`text-base font-black ${isDarkText ? 'text-black' : 'text-white drop-shadow-sm'}`}>
                                                      {window.score}
                                                  </span>
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
