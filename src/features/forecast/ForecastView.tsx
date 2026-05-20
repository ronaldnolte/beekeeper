import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import { WeatherService } from './WeatherService';
import type { InspectionWindow } from './WeatherService';
import { ChevronDown } from 'lucide-react';

import { ForecastScoreGuideModal } from './ForecastScoreGuideModal';
import { ForecastDetailModal } from './ForecastDetailModal';

export const ForecastView: React.FC = () => {
  const { selectedApiaryId, apiariesList } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<InspectionWindow[]>([]);
  const [apiaryName, setApiaryName] = useState('');
  
  // Modal states
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<InspectionWindow | null>(null);

  // Auto-select if there is exactly 1 apiary
  useEffect(() => {
    if (!selectedApiaryId) {
      if (apiariesList.length === 1) {
        useAppStore.setState({ 
          selectedApiaryId: apiariesList[0].id, 
          selectedApiaryName: apiariesList[0].name 
        });
      } else {
        setLoading(false);
      }
    }
  }, [selectedApiaryId, apiariesList]);

  useEffect(() => {
    const fetchForecast = async () => {
      if (!selectedApiaryId) return;
      setLoading(true);
      setError(null);
      try {
        const apiary = await fetchApiaryWithCoords(selectedApiaryId);
        setApiaryName(apiary.name);

        const lat = apiary.lat;
        const lng = apiary.lng;

        if (lat === null || lng === null || lat === undefined || lng === undefined) {
          throw new Error('This apiary does not have coordinates. Please edit the apiary to add coordinates.');
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
          case 'Poor': return 'bg-[var(--color-primary)]'; // Orange
          case 'Not Rec': return 'bg-[#E74C3C]'; // Red
          default: return 'bg-gray-200';
      }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto flex flex-col items-center p-2 sm:p-4 space-y-4 animate-in slide-in-from-right-4 duration-300 relative">
      
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-center items-center py-2 relative">
        <div className="text-center">
          <h2 className="text-2xl font-black text-[#8B4513]">Hive Forecast</h2>
          {selectedApiaryId && apiariesList.length > 1 ? (
            <div className="relative inline-flex items-center gap-1 mt-0.5 justify-center">
              <select
                value={selectedApiaryId}
                onChange={(e) => {
                  const selected = apiariesList.find(a => a.id === e.target.value);
                  if (selected) {
                    useAppStore.setState({ selectedApiaryId: selected.id, selectedApiaryName: selected.name });
                  }
                }}
                className="bg-transparent text-sm font-bold text-[var(--color-text-muted)] border-none focus:outline-none appearance-none pr-5 cursor-pointer text-center outline-none"
              >
                {apiariesList.map(a => (
                  <option key={a.id} value={a.id} className="text-black dark:text-white bg-[var(--color-bg)]">
                    {a.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 pointer-events-none text-[var(--color-text-muted)]">
                <ChevronDown size={14} />
              </div>
            </div>
          ) : (
            <p className="text-sm font-bold text-[var(--color-text-muted)]">{selectedApiaryId ? apiaryName : 'Select Location'}</p>
          )}
        </div>
      </div>

      <div className="w-full max-w-[800px]">
        {!selectedApiaryId ? (
          apiariesList.length === 0 ? (
            <div className="bg-[var(--color-input-bg)] rounded-3xl p-8 text-center shadow-sm border border-[var(--color-card-border)]">
              <p className="font-bold text-[var(--color-text)] mb-2">No Apiaries Found</p>
              <p className="text-sm text-[var(--color-text-muted)]">Please create an apiary yard first to view the weather forecast.</p>
            </div>
          ) : (
            <div className="bg-[var(--color-input-bg)] rounded-3xl p-8 flex flex-col items-center justify-center gap-6 shadow-sm border border-[var(--color-card-border)] w-full max-w-md mx-auto">
              <div className="text-center">
                <h3 className="text-lg font-black text-[var(--color-text)]">Select Apiary</h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1">
                  Choose an apiary to view the 7-day inspection forecast.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2">
                {apiariesList.map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
                    }}
                    className="w-full card p-4 text-center font-bold text-sm hover:border-[var(--color-primary)] active:scale-98 transition-all"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : loading ? (
          <div className="bg-[var(--color-input-bg)] rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-sm border border-[var(--color-card-border)]">
            <div className="w-8 h-8 border-4 border-[#8B4513] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-[#8B4513] animate-pulse">Analyzing meteorological data...</p>
          </div>
        ) : error ? (
          <div className="bg-[var(--color-input-bg)] rounded-3xl p-8 text-center border-red-200 shadow-sm border">
             <p className="text-red-600 font-bold mb-2">Error</p>
             <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center space-y-4">
              
              {/* Legend Row */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] px-2">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#1E824C]"></div>Excellent 85+</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#2ECC71]"></div>Good 70-84</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#F1C40F]"></div>Fair 55-69</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--color-primary)]"></div>Poor 40-54</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#E74C3C]"></div>Not Rec &lt;40</div>
              </div>

              {/* Action Links */}
              <div className="flex items-center justify-center gap-2 text-xs font-bold">
                  <span className="text-[var(--color-text-muted)] italic">Tap a score for details</span>
                  <span className="text-[var(--color-text-muted)] mx-1">|</span>
                  <button 
                    onClick={() => setIsGuideOpen(true)}
                    className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] underline underline-offset-2 decoration-dotted"
                  >
                    How are scores calculated?
                  </button>
              </div>

              {/* The Grid */}
              <div className="flex justify-center overflow-x-auto custom-scrollbar">
                  <table className="text-center border-collapse border border-gray-300 bg-[var(--color-input-bg)] text-[11px]">
                      <thead>
                          <tr className="bg-[var(--color-bg-raised)]">
                              <th className="border border-gray-300 px-2 py-1 font-bold text-[var(--color-text)] bg-[var(--color-bg-raised)] sticky left-0 z-10 text-[10px] w-12">
                                  Time
                              </th>
                              {uniqueDays.map(day => (
                                  <th key={day.id} className="border border-gray-300 px-1 py-1 min-w-[48px]">
                                      <div className="font-bold text-[11px] text-[var(--color-text)]">{day.dayName}</div>
                                      <div className="text-[9px] text-[var(--color-text-muted)]">{day.dateStr}</div>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {uniqueHours.map(hour => {
                              const hourStr = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
                              
                              return (
                                  <tr key={hour}>
                                      <td className="border border-gray-300 px-1.5 py-0 font-bold text-[var(--color-text)] bg-[var(--color-input-bg)] sticky left-0 z-10 text-[10px] whitespace-nowrap">
                                          {hourStr}
                                      </td>
                                      {uniqueDays.map(day => {
                                          // Find the forecast window for this day and hour
                                          const window = forecast.find(w => {
                                              const wDate = w.time.slice(0, 10);
                                              const wHour = parseInt(w.time.slice(11, 13));
                                              return wHour === hour && wDate === day.id;
                                          });

                                          if (!window) return <td key={day.id} className="border border-gray-300 bg-[var(--color-bg-raised)] h-7 w-12"></td>;

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
              
              <p className="text-[10px] font-bold text-[var(--color-text-muted)] italic mt-2 w-full text-center">
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
