import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { WeatherService, InspectionWindow } from '../services/WeatherService';
import { ArrowLeft, CloudRain, Wind, Thermometer, Calendar } from 'lucide-react';

export const ForecastView: React.FC = () => {
  const { selectedApiaryId, goBack } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<InspectionWindow[]>([]);
  const [apiaryName, setApiaryName] = useState('');

  useEffect(() => {
    const fetchForecast = async () => {
      if (!selectedApiaryId) return;
      setLoading(true);
      try {
        // Get Apiary Location
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
            // Need geocoding, but since it's an SPA without a backend, we can try to use a free geocoder,
            // but ideally the user should set lat/lng.
            if (apiary.zip_code) {
               const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${apiary.zip_code}&count=1&language=en&format=json`;
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

  // Group forecast by day
  const days = forecast.reduce((acc, curr) => {
      const date = new Date(curr.time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (!acc[date]) acc[date] = [];
      acc[date].push(curr);
      return acc;
  }, {} as Record<string, InspectionWindow[]>);

  return (
    <div className="w-full flex flex-col items-center p-4 pb-24 space-y-6 animate-in slide-in-from-right-4 duration-300">
      
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <button 
          onClick={goBack}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-right">
          <h2 className="text-xl font-black text-gray-800">{apiaryName} Forecast</h2>
          <p className="text-sm font-bold text-[#E67E22] uppercase tracking-wider">7-Day Inspection Window</p>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        {loading ? (
          <div className="card p-12 flex flex-col items-center justify-center gap-4">
            <div className="w-8 h-8 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-gray-400 animate-pulse">Analyzing meteorological data...</p>
          </div>
        ) : error ? (
          <div className="card p-8 text-center border-red-200 bg-red-50">
             <p className="text-red-600 font-bold mb-2">Error</p>
             <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
             {Object.entries(days).map(([date, hours]) => (
                 <div key={date} className="card overflow-hidden border-2 border-gray-100">
                     <div className="bg-gray-50 p-3 border-b border-gray-100 flex items-center gap-2">
                         <Calendar size={16} className="text-[#E67E22]" />
                         <h3 className="font-bold text-sm text-gray-700">{date}</h3>
                     </div>
                     <div className="divide-y divide-gray-50">
                         {hours.map((hour, idx) => (
                             <div key={idx} className="flex items-center p-3 hover:bg-gray-50 transition-colors">
                                 <div className="w-16 flex-shrink-0">
                                     <span className="font-black text-sm text-gray-600">
                                         {new Date(hour.time).toLocaleTimeString([], { hour: 'numeric' })}
                                     </span>
                                 </div>
                                 
                                 <div className="flex-1 flex gap-4 text-xs font-bold text-gray-500">
                                     <div className="flex items-center gap-1 w-12"><Thermometer size={14}/>{Math.round(hour.temperature)}°</div>
                                     <div className="flex items-center gap-1 w-12"><Wind size={14}/>{Math.round(hour.windSpeed)}</div>
                                     <div className="flex items-center gap-1"><CloudRain size={14}/>{hour.precipitationProbability}%</div>
                                 </div>

                                 <div className="flex-shrink-0 ml-2">
                                     {hour.rating === 'Good' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm border border-green-200">Good</span>}
                                     {hour.rating === 'Marginal' && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm border border-amber-200">Marginal</span>}
                                     {hour.rating === 'Bad' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm border border-red-200">Bad</span>}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};
