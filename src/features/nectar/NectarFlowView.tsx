import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import { fetchNectarIndex } from '../../data/nectarRepository';
import type { NectarIndexResponse } from '../../data/nectarRepository';
import { ChevronDown, Droplets, Thermometer, CloudRain, Activity, Gauge, Flower, AlertTriangle, RefreshCw } from 'lucide-react';

export const NectarFlowView: React.FC = () => {
  const { selectedApiaryId, apiariesList } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NectarIndexResponse | null>(null);
  const [apiaryName, setApiaryName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
      setApiaryName(apiary.name);

      const lat = apiary.lat;
      const lng = apiary.lng;

      if (lat === null || lng === null || lat === undefined || lng === undefined) {
        throw new Error('This apiary does not have coordinates. Please edit the apiary coordinates first.');
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

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!data?.history || data.history.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX: number;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const index = Math.round(percentage * (data.history.length - 1));
    setHoveredIndex(index);
  };

  // UI Helper for status classification
  const getIndexStatus = (score: number, isWashout: boolean) => {
    if (isWashout) return { label: 'Washout (No Foraging)', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    if (score >= 80) return { label: 'Peak Nectar Flow', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' };
    if (score >= 60) return { label: 'Strong Nectar Flow', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' };
    if (score >= 40) return { label: 'Moderate Flow', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20' };
    if (score >= 20) return { label: 'Low Flow / Alert', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' };
    return { label: 'Nectar Dearth', color: 'text-rose-500 font-extrabold', bg: 'bg-rose-500/10 border-rose-500/20' };
  };

  // Radial Gauge Math
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const score = data?.nfi ?? 0;
  const strokeOffset = circumference - (score / 100) * circumference;

  return (
    <div className="w-full flex-1 overflow-y-auto flex flex-col items-center p-4 space-y-4 animate-in slide-in-from-right-4 duration-300 relative text-white bg-[var(--color-bg)]">
      
      {/* Header with Apiary Selector */}
      <div className="w-full max-w-[500px] flex flex-col items-center py-2 relative">
        <h2 className="text-2xl font-black text-[#8B4513] dark:text-amber-500 flex items-center gap-2">
          <Flower className="animate-pulse" size={24} /> Nectar Flow Index
        </h2>
        
        {selectedApiaryId && apiariesList.length > 1 ? (
          <div className="relative inline-flex items-center gap-1 mt-1.5 justify-center">
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
          <p className="text-sm font-bold text-[var(--color-text-muted)] mt-1">
            {selectedApiaryId ? apiaryName : 'Select Location'}
          </p>
        )}
      </div>

      <div className="w-full max-w-[500px]">
        {!selectedApiaryId ? (
          apiariesList.length === 0 ? (
            <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-8 text-center shadow-xl border border-[#2a2a4a]">
              <p className="font-bold mb-2">No Apiaries Found</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Please create an apiary yard first to calculate the Nectar Flow Index.
              </p>
            </div>
          ) : (
            <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center justify-center gap-6 shadow-xl border border-[#2a2a4a] w-full max-w-md mx-auto">
              <div className="text-center">
                <h3 className="text-lg font-black text-amber-500">Select Apiary Yard</h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1">
                  Choose a location to compute the 1.9-mile foraging nectar index.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2">
                {apiariesList.map(a => (
                  <button
                    key={a.id}
                    onClick={() => {
                      useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
                    }}
                    className="w-full bg-[#24243e] border border-[#3b3b5c] p-4 rounded-2xl text-center font-bold text-sm hover:border-amber-500 active:scale-98 transition-all"
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )
        ) : loading ? (
          <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-xl border border-[#2a2a4a] text-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-amber-500 animate-pulse">Running satellite & meteorological layers...</p>
            <p className="text-[10px] text-[var(--color-text-muted)] font-semibold max-w-[280px]">
              This request analyzes vegetation density, phenology changes, temperature profiles, and rain limits.
            </p>
          </div>
        ) : error ? (
          <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-8 text-center border border-red-500/30 shadow-xl bg-red-950/10">
             <AlertTriangle className="text-red-500 mx-auto mb-2" size={32} />
             <p className="text-red-500 font-bold mb-2">Calculation Error</p>
             <p className="text-xs text-red-400 font-semibold leading-relaxed mb-4">{error}</p>
             <button
               onClick={() => loadNFI(false)}
               className="px-4 py-2 bg-red-900/40 text-red-200 border border-red-800/40 hover:bg-red-900/60 rounded-xl text-xs font-bold transition-all"
             >
               Retry Calculation
             </button>
          </div>
        ) : data ? (
          <div className="w-full flex flex-col space-y-4">
            
            {/* Visual Radial Gauge Card */}
            <div className="bg-[#1a1a2e]/75 backdrop-blur-md rounded-3xl p-6 flex flex-col items-center border border-[#2a2a4a] shadow-xl relative overflow-hidden group">
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => loadNFI(true)}
                  disabled={refreshing}
                  className="p-2 bg-[#24243e] border border-[#3b3b5c] rounded-full text-white/70 hover:text-white hover:border-amber-500 disabled:opacity-40 transition-all cursor-pointer"
                  title="Recalculate baseline"
                >
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Status Chip */}
              <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border mb-4 ${getIndexStatus(score, data.breakdown.isWashout).bg} ${getIndexStatus(score, data.breakdown.isWashout).color}`}>
                {getIndexStatus(score, data.breakdown.isWashout).label}
              </div>

              {/* Radial Gauge SVG */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    className="stroke-[#24243e]"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Active Indicator Fill */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="url(#honeyGradient)"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="honeyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#d97706" />
                      <stop offset="50%" stopColor="#F5A623" />
                      <stop offset="100%" stopColor="#FFD700" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Score Number overlay */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-black tracking-tighter text-amber-400 group-hover:scale-105 transition-transform duration-300">
                    {score}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-white/50 tracking-widest mt-0.5">
                    NFI Score
                  </span>
                </div>
              </div>

              <p className="text-xs text-white/70 text-center font-medium mt-3 px-4 leading-relaxed">
                Calculated availability in a <strong>1.9-mile foraging circle</strong> around your hives.
              </p>
            </div>

            {/* 1-Year Nectar Index Trend Chart */}
            {data.history && data.history.length > 0 && (
              <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-5 border border-[#2a2a4a] shadow-xl w-full flex flex-col">
                <div className="flex items-center justify-between text-xs uppercase font-extrabold tracking-wider text-amber-500 mb-3 select-none h-6">
                  <span>1-Year Nectar Index Trend</span>
                  {hoveredIndex !== null && data.history[hoveredIndex] ? (
                    <span className="text-amber-400 font-extrabold text-[11px] normal-case bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-in fade-in duration-200">
                      {new Date(data.history[hoveredIndex].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: <strong className="text-white">{data.history[hoveredIndex].nfi} NFI</strong>
                    </span>
                  ) : (
                    <span className="text-white/40 font-semibold lowercase italic text-[10px]">past year</span>
                  )}
                </div>
                
                {/* SVG Container */}
                <div 
                  className="relative w-full h-32 flex items-center justify-center bg-[#111122]/50 border border-[#24243e] rounded-2xl p-2 cursor-crosshair select-none touch-none"
                  onMouseMove={handlePointerMove}
                  onTouchMove={handlePointerMove}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onTouchEnd={() => setHoveredIndex(null)}
                >
                  <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F5A623" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#F5A623" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Grid lines */}
                    <line x1="0" y1="20" x2="300" y2="20" stroke="#24243e" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#24243e" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="0" y1="80" x2="300" y2="80" stroke="#24243e" strokeWidth="1" strokeDasharray="3,3" />
                    
                    {/* Label lines */}
                    <text x="5" y="15" fill="white" opacity="0.25" fontSize="8" fontWeight="bold">100</text>
                    <text x="5" y="45" fill="white" opacity="0.25" fontSize="8" fontWeight="bold">50</text>
                    <text x="5" y="75" fill="white" opacity="0.25" fontSize="8" fontWeight="bold">0</text>

                    {/* Draw Area & Line */}
                    {(() => {
                      const width = 300;
                      const height = 90;
                      const yOffset = 5;
                      const points = data.history!.map((pt, idx) => {
                        const x = (idx / (data.history!.length - 1)) * width;
                        const y = yOffset + height - (pt.nfi / 100) * height;
                        return { x, y };
                      });

                      const pathD = points.reduce((acc, pt, idx) => {
                        return acc + `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
                      }, '');

                      const areaD = pathD + ` L ${width} ${yOffset + height} L 0 ${yOffset + height} Z`;

                      return (
                        <>
                          {/* Area Fill */}
                          <path d={areaD} fill="url(#chartGrad)" />
                          
                          {/* Line Stroke */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#F5A623"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0px 0px 4px rgba(245,166,35,0.3))' }}
                          />

                          {/* Hover Vertical Line & Intersecting Circle */}
                          {hoveredIndex !== null && points[hoveredIndex] && (
                            <>
                              <line
                                x1={points[hoveredIndex].x}
                                y1="0"
                                x2={points[hoveredIndex].x}
                                y2="100"
                                stroke="#FFD700"
                                strokeWidth="1.5"
                                strokeDasharray="3,3"
                                opacity="0.8"
                              />
                              <circle
                                cx={points[hoveredIndex].x}
                                cy={points[hoveredIndex].y}
                                r="5.5"
                                fill="#FFD700"
                                stroke="#1a1a2e"
                                strokeWidth="2"
                              />
                            </>
                          )}

                          {/* Draw indicator dot for current today point */}
                          {hoveredIndex === null && points.length > 0 && (
                            <circle
                              cx={points[points.length - 1].x}
                              cy={points[points.length - 1].y}
                              r="4"
                              fill="#FFD700"
                              stroke="#1a1a2e"
                              strokeWidth="1.5"
                            />
                          )}
                        </>
                      );
                    })()}
                  </svg>
                </div>
                
                {/* Date Labels below chart */}
                <div className="flex justify-between text-[9px] text-white/40 font-bold px-1 mt-1.5 uppercase tracking-wider select-none">
                  <span>{new Date(data.history[0].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                  <span>6 months ago</span>
                  <span>{new Date(data.history[data.history.length - 1].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                </div>
              </div>
            )}

            {/* Weather & Satellite Columns Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Weather Stats Card */}
              <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-4 border border-[#2a2a4a] flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-amber-500 font-extrabold text-xs mb-3">
                  <Activity size={14} /> Weather Modifiers
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-white/60 font-semibold"><Thermometer size={12} /> Temp</span>
                    <span className="font-bold">{Math.round(data.weather.tempF)}°F</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-white/60 font-semibold"><Droplets size={12} /> Humidity</span>
                    <span className="font-bold">{data.weather.humidity}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-white/60 font-semibold"><CloudRain size={12} /> Rainfall</span>
                    <span className="font-bold">{data.weather.precipitationMm.toFixed(1)}mm</span>
                  </div>
                </div>
              </div>

              {/* Satellite Stats Card */}
              <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-4 border border-[#2a2a4a] flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-amber-500 font-extrabold text-xs mb-3">
                  <Gauge size={14} /> Vegetation (NDVI)
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-semibold">Current</span>
                    <span className="font-bold">{data.currentNDVI.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-semibold">Baseline</span>
                    <span className="font-bold">{data.baselineNDVI.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 font-semibold">Weekly Δ</span>
                    <span className={`font-bold ${data.breakdown.delta > 0 ? 'text-green-400' : data.breakdown.delta < 0 ? 'text-rose-400' : ''}`}>
                      {data.breakdown.delta > 0 ? '+' : ''}{data.breakdown.delta.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculations Engine Detail Breakdown Accordion */}
            <div className="bg-[#1a1a2e]/70 backdrop-blur-md rounded-3xl p-5 border border-[#2a2a4a] shadow-xl space-y-4">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-amber-500">
                3-Layer Engine Breakdown
              </h4>

              <div className="space-y-3.5">
                {/* Layer 1: Biomass Base */}
                <div className="flex flex-col text-xs border-b border-[#24243e] pb-3">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white/90">Layer 1: Foraging Biomass Base</span>
                    <span className="text-amber-400 font-black">
                      {data.breakdown.layer1Score.toFixed(1)} / {data.breakdown.layer1Max.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 mt-1 font-semibold leading-relaxed">
                    Evaluates current vegetative index against historical baseline. 
                    {data.baselineNDVI < 0.70 
                      ? ' Capped potential because local baseline is below 70% (sparse area).' 
                      : ' Full forage potential allowed.'}
                  </p>
                </div>

                {/* Layer 2: Phenology Trigger */}
                <div className="flex flex-col text-xs border-b border-[#24243e] pb-3">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white/90">Layer 2: Seasonal Phenology Δ</span>
                    <span className={`font-black ${data.breakdown.phenologyMultiplier > 1 ? 'text-green-400' : data.breakdown.phenologyMultiplier < 1 ? 'text-rose-400' : 'text-white/80'}`}>
                      x{data.breakdown.phenologyMultiplier.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 mt-1 font-semibold leading-relaxed">
                    Detects vegetative change.
                    {data.breakdown.delta > 0.03 
                      ? ' Boost (+15%) applied for rising growth/bloom surge.' 
                      : data.breakdown.delta < -0.05 
                        ? ' Penalty (-40%) applied for a steep decline (nectar dearth).' 
                        : ' Neutral index: vegetation is stable.'}
                  </p>
                </div>

                {/* Layer 3: Weather Gatekeeper */}
                <div className="flex flex-col text-xs">
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white/90">Layer 3: Weather Gatekeeper</span>
                      <span className="font-semibold text-white/50">Multipliers</span>
                    </div>
                    {/* Temperature */}
                    <div className="flex items-center justify-between text-[11px] font-semibold pl-2">
                      <span className="text-white/60">Temperature Multiplier</span>
                      <span className={`font-bold ${data.breakdown.tempMultiplier === 1.2 ? 'text-green-400' : data.breakdown.tempMultiplier === 0.2 ? 'text-rose-400' : 'text-white/80'}`}>
                        x{data.breakdown.tempMultiplier.toFixed(1)}
                      </span>
                    </div>
                    {/* Humidity */}
                    <div className="flex items-center justify-between text-[11px] font-semibold pl-2">
                      <span className="text-white/60">Humidity Multiplier</span>
                      <span className={`font-bold ${data.breakdown.humidityMultiplier === 0.5 ? 'text-rose-400' : 'text-white/80'}`}>
                        x{data.breakdown.humidityMultiplier.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/50 mt-2 font-semibold leading-relaxed">
                    Adjusts for plant secretion. 
                    {data.breakdown.isWashout 
                      ? ' Hard Foraging Washout active (Rain > 2mm). Score is forced to 0.' 
                      : ` Optimal temp is 75-88°F. Current temp provides x${data.breakdown.tempMultiplier.toFixed(1)} modifier. ${data.weather.humidity < 35 ? 'Penalty (x0.5) applied because dry air is drying out nectar.' : 'Humidity is favorable.'}`}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Cache diagnostic label */}
            <p className="text-[9px] font-bold text-[var(--color-text-muted)] italic text-center w-full">
              {data.isHistoryQueried 
                ? 'Fresh calculation run. Computed baseline saved to local storage.' 
                : 'Baseline retrieved from local storage cache (Agromonitoring history query skipped).'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
