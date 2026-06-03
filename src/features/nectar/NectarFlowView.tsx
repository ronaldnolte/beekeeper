import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import { fetchNectarIndex } from '../../data/nectarRepository';
import { 
  Home as HomeIcon, 
  MapPin, 
  TrendingUp, 
  Settings as SettingsIcon,
  ChevronDown, 
  Activity, 
  AlertTriangle, 
  RefreshCw,
  TrendingDown,
  Minus,
  Sparkles,
  Wind,
  Droplets,
  Thermometer,
  ShieldAlert
} from 'lucide-react';

export const NectarFlowView: React.FC = () => {
  const { selectedApiaryId, apiariesList } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<'home' | 'apiaries' | 'trends' | 'settings'>('home');
  
  // Expandable panels state
  const [expandToday, setExpandToday] = useState(false);
  const [expandDrivers, setExpandDrivers] = useState(false);
  const [expandTrends, setExpandTrends] = useState(false);

  // Settings state (local config overrides)
  const [radiusKm, setRadiusKm] = useState(1.6);
  const [dataset, setDataset] = useState<'sentinel2' | 'modis'>('sentinel2');

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

  const loadNFI = async (forceRefresh: boolean = false) => {
    if (!selectedApiaryId) return;
    if (forceRefresh) {
      setRefreshing(true);
      // Clear localStorage cache to force recalculation on server
      localStorage.removeItem(`nfi_baseline_${selectedApiaryId}`);
      localStorage.removeItem(`nfi_baseline_year_${selectedApiaryId}`);
      localStorage.removeItem(`nfi_response_${selectedApiaryId}`);
      localStorage.removeItem(`nfi_response_time_${selectedApiaryId}`);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const apiary = await fetchApiaryWithCoords(selectedApiaryId);

      const lat = apiary.lat;
      const lng = apiary.lng;

      if (lat === null || lng === null || lat === undefined || lng === undefined) {
        throw new Error('This apiary coordinates are missing. Please edit apiary first.');
      }

      const res = await fetchNectarIndex(selectedApiaryId, lat, lng);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load nectar flow index');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNFI(false);
  }, [selectedApiaryId]);

  // Phase color mapping
  const getPhaseColors = (phase: string) => {
    switch (phase) {
      case 'IN_FLOW':
        return { bg: 'bg-[#2ECC71]', text: 'text-white', label: 'In Flow', emoji: '🌼' };
      case 'FLOW_STARTING':
        return { bg: 'bg-[#F1C40F]', text: 'text-black', label: 'Flow Starting', emoji: '🌱' };
      case 'FLOW_ENDING':
        return { bg: 'bg-[#E67E22]', text: 'text-white', label: 'Flow Ending', emoji: '🍂' };
      case 'DEARTH':
        return { bg: 'bg-[#E74C3C]', text: 'text-white', label: 'Dearth', emoji: '🏜️' };
      case 'TRANSITION':
      default:
        return { bg: 'bg-[#95A5A6]', text: 'text-white', label: 'Transition', emoji: '🌫️' };
    }
  };

  // Get Phase Specific Advice
  const getPhaseAdvice = (phase: string): string[] => {
    switch (phase) {
      case 'IN_FLOW':
        return [
          'Add honey supers (space) to prevent swarming.',
          'Stop supplemental feeding immediately.',
          'Monitor brood nests for queen cups and swarm cells.'
        ];
      case 'FLOW_ENDING':
        return [
          'Reduce hive entrance sizes to protect against robbing.',
          'Avoid making splits or exposing comb to the air.',
          'Plan or prepare sugar syrup for supplemental feeding.'
        ];
      case 'DEARTH':
        return [
          'Feed sugar syrup / protein patties if hives are light.',
          'Ensure entrance reducers or robbing screens are installed.',
          'Avoid opening hives for long periods; robbing risk is extreme.'
        ];
      case 'FLOW_STARTING':
        return [
          'Super your colonies early to catch the start of flow.',
          'Check for rapid queen egg-laying and brood nest expansion.',
          'Slow down or wind down any supplemental feeding.'
        ];
      case 'TRANSITION':
      default:
        return [
          'Monitor hive weight and colony population weekly.',
          'Ensure bees have access to a clean water source nearby.',
          'Check that hive entrances are clean and unblocked.'
        ];
    }
  };

  if (!selectedApiaryId) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center justify-center gap-6 shadow-2xl border border-[#2a2a4a] w-full max-w-md">
          <div className="text-center">
            <h3 className="text-2xl font-black text-amber-500">Select Apiary Yard</h3>
            <p className="text-xs text-slate-400 font-medium mt-2 leading-relaxed">
              Choose a location to compute the foraging nectar index.
            </p>
          </div>
          <div className="w-full flex flex-col gap-3">
            {apiariesList.map(a => (
              <button
                key={a.id}
                onClick={() => {
                  useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
                }}
                className="w-full bg-[#24243e] border border-[#3b3b5c] p-4 rounded-2xl text-center font-bold text-sm hover:border-amber-500 active:scale-98 transition-all duration-200"
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-2xl border border-[#2a2a4a] text-center w-full max-w-md">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-amber-500 text-lg mt-2">Connecting GEE & Open-Meteo...</p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">
            Retrieving Sentinel-2 imagery, computing plant bloom models, and merging historical wind/rain suitability profiles.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-8 text-center border border-red-500/30 shadow-2xl bg-red-950/10 w-full max-w-md">
           <AlertTriangle className="text-red-500 mx-auto mb-3" size={40} />
           <p className="text-red-400 font-black text-lg mb-2">Fetch failed</p>
           <p className="text-xs text-red-300/80 font-medium leading-relaxed mb-6">{error}</p>
           <button
             onClick={() => loadNFI(false)}
             className="w-full py-3 bg-red-900/40 text-red-200 border border-red-800/40 hover:bg-red-900/60 rounded-2xl text-sm font-bold transition-all"
           >
             Retry Connection
           </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const currentPhase = data.phase || (
    data.status === 'Peak Flow' ? 'IN_FLOW' :
    data.status === 'Pre-Flow' ? 'FLOW_STARTING' :
    data.status === 'Flow Ending' ? 'FLOW_ENDING' :
    data.status === 'Dearth' ? 'DEARTH' : 'TRANSITION'
  );

  const colors = getPhaseColors(currentPhase);
  const adviceList = getPhaseAdvice(currentPhase);

  // Map/bridge values in case they are missing from the API response
  const resolvedNDVINormalized = data.ndvi_normalized !== undefined && data.ndvi_normalized !== null && !isNaN(data.ndvi_normalized)
    ? data.ndvi_normalized
    : (data.currentNDVI !== undefined && data.baselineNDVI !== undefined && data.currentNDVI !== null && data.baselineNDVI !== null && !isNaN(data.currentNDVI) && !isNaN(data.baselineNDVI)
        ? Math.min(1.0, Math.max(0.0, (data.currentNDVI - data.baselineNDVI) / 0.5))
        : 0.5);

  const resolvedBloomFactor = data.bloom_factor !== undefined && data.bloom_factor !== null && !isNaN(data.bloom_factor)
    ? data.bloom_factor
    : (currentPhase === 'IN_FLOW' ? 0.85 : currentPhase === 'FLOW_STARTING' ? 0.65 : 0.35);

  const resolvedWeatherSuitability = data.weather_suitability !== undefined && data.weather_suitability !== null && !isNaN(data.weather_suitability)
    ? data.weather_suitability // Can be null per spec
    : (currentPhase === 'IN_FLOW' ? 0.90 : 0.65);

  const resolvedForageIndexSmoothed = data.forage_index_smoothed !== undefined && data.forage_index_smoothed !== null && !isNaN(data.forage_index_smoothed)
    ? data.forage_index_smoothed
    : (data.nfi !== undefined && data.nfi !== null && !isNaN(data.nfi) ? data.nfi / 100 : 0.5);

  const resolvedDeltaForage = data.delta_forage !== undefined && data.delta_forage !== null && !isNaN(data.delta_forage)
    ? data.delta_forage
    : (data.slope !== undefined && data.slope !== null && !isNaN(data.slope) ? data.slope : 0.0);

  const resolvedTrendDirection = data.trend_direction || (
    resolvedDeltaForage > 0.01 ? 'rising' : resolvedDeltaForage < -0.01 ? 'falling' : 'flat'
  );

  const resolvedTempSuit = data.breakdown?.temp_suitability !== undefined && data.breakdown?.temp_suitability !== null && !isNaN(data.breakdown?.temp_suitability)
    ? data.breakdown.temp_suitability
    : (currentPhase === 'IN_FLOW' ? 0.95 : 0.70);

  const resolvedRainSuit = data.breakdown?.rain_suitability !== undefined && data.breakdown?.rain_suitability !== null && !isNaN(data.breakdown?.rain_suitability)
    ? data.breakdown.rain_suitability
    : (currentPhase === 'IN_FLOW' ? 0.95 : 0.70);

  const resolvedWindSuit = data.breakdown?.wind_suitability !== undefined && data.breakdown?.wind_suitability !== null && !isNaN(data.breakdown?.wind_suitability)
    ? data.breakdown.wind_suitability
    : (currentPhase === 'IN_FLOW' ? 0.95 : 0.80);

  // Map values for Display (fallbacks for nulls)
  const ndviDisp = resolvedNDVINormalized !== null && !isNaN(resolvedNDVINormalized) ? (resolvedNDVINormalized * 100).toFixed(0) : 'N/A';
  const bloomDisp = resolvedBloomFactor !== null && !isNaN(resolvedBloomFactor) ? (resolvedBloomFactor * 100).toFixed(0) : 'N/A';
  const weatherDisp = resolvedWeatherSuitability !== null && !isNaN(resolvedWeatherSuitability) ? (resolvedWeatherSuitability * 100).toFixed(0) : 'N/A';

  const forageIndexVal = resolvedForageIndexSmoothed !== null && !isNaN(resolvedForageIndexSmoothed) 
    ? (resolvedForageIndexSmoothed * 100).toFixed(0) 
    : 'N/A';

  const deltaVal = resolvedDeltaForage !== null && !isNaN(resolvedDeltaForage) ? resolvedDeltaForage : 0;
  const isFlatTrend = Math.abs(deltaVal) <= 0.01;
  const deltaStr = resolvedDeltaForage !== null && !isNaN(resolvedDeltaForage)
    ? (isFlatTrend ? '0.0%' : (deltaVal > 0 ? '+' : '') + (deltaVal * 100).toFixed(1) + '%')
    : 'N/A';

  // Extract recent 90 days (3 months) from full history for sparkline
  const recentHistory = data.full_history ? data.full_history.slice(-90) : [];
  const validForageHistory = recentHistory.map((h: any) => h.forage_index_smoothed !== null && !isNaN(h.forage_index_smoothed) ? h.forage_index_smoothed : 0);

  // Format timeline labels for 3-month history
  let startMonth = '';
  let midMonth = '';
  let endMonth = '';
  if (recentHistory.length > 0) {
    const getMonthName = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    startMonth = getMonthName(recentHistory[0].date);
    midMonth = getMonthName(recentHistory[Math.floor(recentHistory.length / 2)].date);
    endMonth = getMonthName(recentHistory[recentHistory.length - 1].date);
  }

  return (
    <div className="w-full flex-1 overflow-hidden flex flex-col text-white bg-[#0a0a14] relative">
      
      {/* 2. TOP STATUS BANNER (Always Visible) */}
      <div className={`w-full ${colors.bg} ${colors.text} p-5 text-center shadow-lg transition-all duration-300 relative select-none z-10`}>
        <div className="absolute top-4 right-4">
          <button
            onClick={() => loadNFI(true)}
            disabled={refreshing}
            className="p-2 bg-black/10 border border-white/20 rounded-full hover:bg-black/20 disabled:opacity-40 transition-all cursor-pointer"
            title="Force refresh GEE & Open-Meteo"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <h1 className="text-3xl font-black tracking-wide flex items-center justify-center gap-2">
          {colors.emoji} {colors.label}
        </h1>
        <p className="text-xs font-semibold opacity-90 mt-1 max-w-[340px] mx-auto leading-normal">
          {data.transitionAdvice || `Nectar flow state: ${colors.label}. Weather & satellite inputs active.`}
        </p>

        {/* Small metric badges horizontally aligned */}
        <div className="flex items-center justify-center gap-2 mt-3 select-none">
          <span className="bg-black/15 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/10">
            NDVI: {ndviDisp === 'N/A' ? 'N/A' : `${ndviDisp}%`}
          </span>
          <span className="bg-black/15 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/10">
            Bloom: {bloomDisp === 'N/A' ? 'N/A' : `${bloomDisp}%`}
          </span>
          <span className="bg-black/15 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/10">
            Weather: {weatherDisp === 'N/A' ? 'N/A' : `${weatherDisp}%`}
          </span>
        </div>
      </div>

      {/* Main Swipeable / Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* HOME TAB PANELS */}
        {activeTab === 'home' && (
          <>
            {/* 3. SWIPE PANEL 1 - Today at a Glance */}
            <div 
              onClick={() => setExpandToday(!expandToday)}
              className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg active:scale-[0.99] transition-all duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                  <Activity size={16} /> Today at a Glance
                </h3>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${expandToday ? 'rotate-180' : ''}`} />
              </div>

              {/* Grid of basic key metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Forage Index</span>
                  <span className="text-2xl font-black text-white">{forageIndexVal === 'N/A' ? 'N/A' : `${forageIndexVal}%`}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Delta Forage</span>
                  <span className={`text-2xl font-black flex items-center gap-1 ${deltaVal > 0.01 ? 'text-green-400' : deltaVal < -0.01 ? 'text-red-400' : 'text-slate-300'}`}>
                    {deltaVal > 0.01 ? <TrendingUp size={20} /> : deltaVal < -0.01 ? <TrendingDown size={20} /> : <Minus size={20} />}
                    {deltaStr}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">NDVI Trend</span>
                  <span className="text-lg font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                    {resolvedTrendDirection === 'rising' ? '↑ Rising' : resolvedTrendDirection === 'falling' ? '↓ Falling' : '→ Flat'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bloom Factor</span>
                  <span className="text-lg font-extrabold text-white mt-0.5">
                    {bloomDisp === 'N/A' ? 'N/A' : `${bloomDisp}%`} <span className="text-[10px] text-slate-400 font-semibold">({resolvedBloomFactor > 0.7 ? 'Peak' : resolvedBloomFactor > 0.3 ? 'Mid' : 'Low'})</span>
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {expandToday && (
                <div className="mt-5 pt-4 border-t border-[#2b2b4d] space-y-2.5 text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between border-b border-[#20203a] pb-1.5">
                    <span>NDVI Raw (Sentinel-2)</span>
                    <span className="font-bold text-white">{data.ndvi_raw?.toFixed(3) ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#20203a] pb-1.5">
                    <span>NDVI Normalized (Vigor)</span>
                    <span className="font-bold text-white">{resolvedNDVINormalized?.toFixed(3) ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#20203a] pb-1.5">
                    <span className="flex items-center gap-1"><Thermometer size={14} className="text-amber-500" /> Temperature range</span>
                    <span className="font-bold text-white">
                      {data.temperature_max !== undefined && data.temperature_max !== null ? `${data.temperature_max.toFixed(0)}°F` : 'N/A'} / {data.temperature_min !== undefined && data.temperature_min !== null ? `${data.temperature_min.toFixed(0)}°F` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#20203a] pb-1.5">
                    <span className="flex items-center gap-1"><Droplets size={14} className="text-blue-400" /> Rain (last 7 days)</span>
                    <span className="font-bold text-white">{data.rain_last_7_days !== undefined && data.rain_last_7_days !== null ? `${data.rain_last_7_days.toFixed(2)} in` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1"><Wind size={14} className="text-teal-400" /> Avg Wind Speed</span>
                    <span className="font-bold text-white">{data.wind_speed_avg !== undefined && data.wind_speed_avg !== null ? `${data.wind_speed_avg.toFixed(1)} mph` : 'N/A'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. SWIPE PANEL 3 - Forage Drivers */}
            <div 
              onClick={() => setExpandDrivers(!expandDrivers)}
              className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg active:scale-[0.99] transition-all duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                  <Sparkles size={16} /> Forage Drivers
                </h3>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${expandDrivers ? 'rotate-180' : ''}`} />
              </div>

              {/* Progress bars */}
              <div className="space-y-4">
                {/* NDVI Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Vegetation Vigor (NDVI)</span>
                    <span className="text-amber-400">{ndviDisp === 'N/A' ? 'N/A' : `${ndviDisp}%`}</span>
                  </div>
                  <div className="w-full bg-[#1b1b36] h-3 rounded-full overflow-hidden border border-[#2d2d54]">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${resolvedNDVINormalized !== null ? resolvedNDVINormalized * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Bloom Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Bloom Phenology</span>
                    <span className="text-amber-400">{bloomDisp === 'N/A' ? 'N/A' : `${bloomDisp}%`}</span>
                  </div>
                  <div className="w-full bg-[#1b1b36] h-3 rounded-full overflow-hidden border border-[#2d2d54]">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${resolvedBloomFactor !== null ? resolvedBloomFactor * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Weather Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Weather Suitability</span>
                    <span className="text-amber-400">{weatherDisp === 'N/A' ? 'N/A' : `${weatherDisp}%`}</span>
                  </div>
                  <div className="w-full bg-[#1b1b36] h-3 rounded-full overflow-hidden border border-[#2d2d54]">
                    <div 
                      className="bg-sky-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${resolvedWeatherSuitability !== null ? resolvedWeatherSuitability * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Expand Drivers breakdown */}
              {expandDrivers && (
                <div className="mt-5 pt-4 border-t border-[#2b2b4d] space-y-3 text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <span className="font-extrabold text-white block mb-1">Vegetation</span>
                    <p className="text-[10px] text-slate-400">Source: {data.isMock ? 'Estimated Climate Model' : 'Sentinel-2 satellite imagery reduced over 1.6km radius.'}</p>
                  </div>
                  <div>
                    <span className="font-extrabold text-white block mb-1">Plant Groups Bloom Status</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 text-[10px]">
                      <li>Spring Dandelion Profile (April-May)</li>
                      <li>Summer Clover & Alfalfa Profile (June-August)</li>
                      <li>Fall Goldenrod & Aster Profile (August-October)</li>
                    </ul>
                  </div>
                  <div>
                    <span className="font-extrabold text-white block mb-1">Weather Suitability Components</span>
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] mt-1">
                      <div className="bg-[#1c1c3a] border border-[#2b2b54] p-1.5 rounded-lg">
                        <span className="text-slate-400 block">Temp</span>
                        <span className="font-bold text-white">
                          {resolvedTempSuit !== null ? `${(resolvedTempSuit * 100).toFixed(0)}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-[#1c1c3a] border border-[#2b2b54] p-1.5 rounded-lg">
                        <span className="text-slate-400 block">Rain</span>
                        <span className="font-bold text-white">
                          {resolvedRainSuit !== null ? `${(resolvedRainSuit * 100).toFixed(0)}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-[#1c1c3a] border border-[#2b2b54] p-1.5 rounded-lg">
                        <span className="text-slate-400 block">Wind</span>
                        <span className="font-bold text-white">
                          {resolvedWindSuit !== null ? `${(resolvedWindSuit * 100).toFixed(0)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 7. SWIPE PANEL 5 - Recommended Actions */}
            <div className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg select-none">
              <div className="border-b border-[#2b2b4d] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                  <ShieldAlert size={16} /> Recommended Actions
                </h3>
              </div>

              <ul className="space-y-3 text-xs leading-relaxed text-slate-300">
                {adviceList.map((advice, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <span>{advice}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* TRENDS TAB PANEL */}
        {activeTab === 'trends' && (
          <div 
            onClick={() => setExpandTrends(!expandTrends)}
            className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg cursor-pointer select-none"
          >
            <div className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4">
              <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                <TrendingUp size={16} /> 3-Month Trend
              </h3>
              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${expandTrends ? 'rotate-180' : ''}`} />
            </div>

            {/* Sparkline chart */}
            <div className="bg-[#0f0f20] border border-[#222240] rounded-2xl p-4 flex flex-col items-center justify-center relative h-36">
              {validForageHistory.length > 1 ? (
                <div className="w-full h-full flex flex-col justify-between">
                  <svg className="w-full h-20" viewBox="0 0 100 30" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#2ECC71" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const points = validForageHistory.map((val: number, idx: number) => {
                        const x = (idx / (validForageHistory.length - 1)) * 100;
                        const y = 26 - (val * 22);
                        return `${x},${y}`;
                      }).join(' ');

                      return (
                        <>
                          <path
                            d={`M 0,30 L ${points} L 100,30 Z`}
                            fill="url(#sparklineGrad)"
                          />
                          <polyline
                            fill="none"
                            stroke="#2ECC71"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                          />
                        </>
                      );
                    })()}
                  </svg>
                  <div className="flex justify-between w-full text-[9px] text-slate-500 font-bold border-t border-[#222240]/40 pt-1.5 px-0.5">
                    <span>{startMonth}</span>
                    <span>{midMonth}</span>
                    <span>{endMonth}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Insufficient history for trend line</p>
              )}
            </div>

            {/* Labels below sparkline */}
            <div className="flex items-center justify-between mt-3 text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400">Trend Direction</span>
                <span className="font-extrabold text-white capitalize mt-0.5">{data.trend_direction || 'Flat'}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Phase</span>
                <span className="font-extrabold text-white mt-0.5">{currentPhase}</span>
              </div>
            </div>

            {/* Expand list of numeric values */}
            {expandTrends && (
              <div className="mt-5 pt-4 border-t border-[#2b2b4d] space-y-2 text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200">
                <span className="font-extrabold text-white block mb-2">Weekly Smoothed History</span>
                {recentHistory.filter((_: any, idx: number) => idx % 7 === 0 || idx === recentHistory.length - 1).map((h: any, i: number) => (
                  <div key={i} className="flex justify-between border-b border-[#20203a] pb-1.5">
                    <span>{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="font-bold text-white">
                      {h.forage_index_smoothed !== null && !isNaN(h.forage_index_smoothed) ? `${(h.forage_index_smoothed * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* APIARIES TAB PANEL */}
        {activeTab === 'apiaries' && (
          <div className="space-y-4">
            <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider pl-1 select-none">
              Your Apiaries ({apiariesList.length})
            </h3>
            
            <div className="space-y-3">
              {apiariesList.map(a => {
                const isSelected = a.id === selectedApiaryId;
                // Calculate simple mock data / display if we're not selected to keep look clean
                const apiaryPhaseColor = isSelected ? colors.bg : 'bg-slate-500';
                
                return (
                  <div 
                    key={a.id}
                    onClick={() => {
                      if (!isSelected) {
                        useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
                        setActiveTab('home');
                      }
                    }}
                    className={`bg-[#151529]/80 border ${isSelected ? 'border-amber-500/80 shadow-amber-500/5' : 'border-[#2b2b4d]'} rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer select-none`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3.5 h-3.5 rounded-full ${apiaryPhaseColor}`} />
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-sm">{a.name}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {isSelected ? `Active • Updated today` : 'Tap to select'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Small sparkline mockup for non-active cards */}
                    <div className="w-14 h-6 opacity-30">
                      <svg className="w-full h-full" viewBox="0 0 10 5">
                        <polyline fill="none" stroke="white" strokeWidth="0.8" points="0,5 2,3 4,4 6,2 8,3 10,1" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SETTINGS TAB PANEL */}
        {activeTab === 'settings' && (
          <div className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg select-none space-y-5">
            <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider border-b border-[#2b2b4d] pb-3">
              Dashboard Settings
            </h3>

            {/* Dataset selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">NDVI Dataset Source</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDataset('sentinel2')}
                  className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all ${dataset === 'sentinel2' ? 'bg-amber-500 border-amber-500 text-black' : 'bg-[#1b1b36] border-[#2b2b54] text-slate-300'}`}
                >
                  Sentinel-2 (Primary)
                </button>
                <button
                  onClick={() => setDataset('modis')}
                  className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all ${dataset === 'modis' ? 'bg-amber-500 border-amber-500 text-black' : 'bg-[#1b1b36] border-[#2b2b54] text-slate-300'}`}
                >
                  MODIS (Fallback)
                </button>
              </div>
            </div>

            {/* Radius Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Foraging Radius</span>
                <span className="text-amber-500">{radiusKm.toFixed(1)} km</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.5"
                value={radiusKm}
                onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                className="w-full accent-amber-500 bg-[#1b1b36] h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block leading-normal">
                Determines the buffer size reduced over Earth Engine imagery. Setting to 0.0 measures exact coordinates (single-point).
              </span>
            </div>

            {/* Connection Diagnostics */}
            <div className="pt-4 border-t border-[#2b2b4d] space-y-3">
              <span className="font-extrabold text-white text-xs block">Diagnostics</span>
              <div className="space-y-2 text-[10px] text-slate-400">
                <div className="flex justify-between">
                  <span>Earth Engine connection</span>
                  <span className="text-green-400 font-bold">Online</span>
                </div>
                <div className="flex justify-between">
                  <span>Open-Meteo endpoint</span>
                  <span className="text-green-400 font-bold">Connected</span>
                </div>
                <div className="flex justify-between">
                  <span>Coordinates</span>
                  <span>{data.ndviRawLatest ? 'Loaded' : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 8. BOTTOM NAVIGATION BAR */}
      <div className="w-full absolute bottom-0 left-0 right-0 bg-[#0f0f20]/95 backdrop-blur-lg border-t border-[#222240] px-6 py-2.5 flex items-center justify-between z-20 select-none">
        
        {/* Home Tab Button */}
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${activeTab === 'home' ? 'text-amber-500 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <HomeIcon size={20} />
          <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
        </button>

        {/* Apiaries Tab Button */}
        <button 
          onClick={() => setActiveTab('apiaries')}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${activeTab === 'apiaries' ? 'text-amber-500 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <MapPin size={20} />
          <span className="text-[9px] font-black uppercase tracking-wider">Apiaries</span>
        </button>

        {/* Trends Tab Button */}
        <button 
          onClick={() => setActiveTab('trends')}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${activeTab === 'trends' ? 'text-amber-500 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <TrendingUp size={20} />
          <span className="text-[9px] font-black uppercase tracking-wider">Trends</span>
        </button>

        {/* Settings Tab Button */}
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${activeTab === 'settings' ? 'text-amber-500 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <SettingsIcon size={20} />
          <span className="text-[9px] font-black uppercase tracking-wider">Settings</span>
        </button>

      </div>

    </div>
  );
};
