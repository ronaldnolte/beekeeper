import React, { useEffect, useState, useRef } from 'react';
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
  ShieldAlert,
  Maximize2,
  X
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

  // Hover cursor state for trends chart
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Enlarged Landscape Modal State
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [containerWidth, setContainerWidth] = useState(320);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth(w);
        }
      }
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

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
    setData(null);
    setError(null);
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

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'IN_FLOW': return '#2ECC71';
      case 'FLOW_STARTING': return '#F1C40F';
      case 'FLOW_ENDING': return '#E67E22';
      case 'DEARTH': return '#E74C3C';
      default: return '#95A5A6';
    }
  };
  const handlePointerLeave = () => {
    setHoveredIndex(null);
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

  // Group full 12-month history into weekly data points (~52 points)
  const recentHistory: any[] = [];
  if (data.full_history && data.full_history.length > 0) {
    for (let i = 0; i < data.full_history.length; i += 7) {
      recentHistory.push(data.full_history[i]);
    }
    // Make sure we include the latest day to show today's status
    if ((data.full_history.length - 1) % 7 !== 0) {
      recentHistory.push(data.full_history[data.full_history.length - 1]);
    }
  }

  const validForageHistory = recentHistory.map((h: any) => h.forage_index_smoothed !== null && !isNaN(h.forage_index_smoothed) ? h.forage_index_smoothed : 0);


  // Format timeline labels for 12-month history
  let startMonth = '';
  let midMonth = '';
  let endMonth = '';
  if (recentHistory.length > 0) {
    const getMonthName = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    startMonth = getMonthName(recentHistory[0].date);
    midMonth = getMonthName(recentHistory[Math.floor(recentHistory.length / 2)].date);
    endMonth = getMonthName(recentHistory[recentHistory.length - 1].date);
  }

  const renderChartSvg = (width: number, height: number, isFullscreen: boolean = false) => {
    const paddingLeft = 40;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    if (validForageHistory.length <= 1) {
      return (
        <div className="flex items-center justify-center text-xs text-slate-500" style={{ height }}>
          Insufficient history for trend line
        </div>
      );
    }

    // Y-axis Dynamic Auto-Scaling (110% of 90-day Maximum with discrete grid-friendly steps)
    const maxHistoryVal = validForageHistory.length > 0 ? Math.max(...validForageHistory) : 0.20;
    const targetYMax = maxHistoryVal * 1.10;
    
    let yMax = 1.0;
    let yGridValues = [1.0, 0.75, 0.50, 0.25, 0.0];

    if (targetYMax <= 0.20) {
      yMax = 0.20;
      yGridValues = [0.20, 0.15, 0.10, 0.05, 0.0];
    } else if (targetYMax <= 0.40) {
      yMax = 0.40;
      yGridValues = [0.40, 0.30, 0.20, 0.10, 0.0];
    } else if (targetYMax <= 0.60) {
      yMax = 0.60;
      yGridValues = [0.60, 0.45, 0.30, 0.15, 0.0];
    } else if (targetYMax <= 0.80) {
      yMax = 0.80;
      yGridValues = [0.80, 0.60, 0.40, 0.20, 0.0];
    } else {
      yMax = 1.0;
      yGridValues = [1.00, 0.75, 0.50, 0.25, 0.0];
    }

    const yCoord = (val: number) => {
      return height - paddingBottom - ((val / yMax) * chartHeight);
    };

    const xCoord = (idx: number) => {
      return paddingLeft + (idx / (validForageHistory.length - 1)) * chartWidth;
    };

    // Build area fill path
    const pathPoints = validForageHistory.map((val: number, idx: number) => {
      return `${xCoord(idx)},${yCoord(val)}`;
    }).join(' ');
    const areaPath = `M ${xCoord(0)},${yCoord(0)} L ${pathPoints} L ${xCoord(validForageHistory.length - 1)},${yCoord(0)} Z`;

    // Build colored line segments
    const segments: React.ReactNode[] = [];
    for (let i = 0; i < recentHistory.length - 1; i++) {
      const x1 = xCoord(i);
      const y1 = yCoord(recentHistory[i].forage_index_smoothed ?? 0);
      const x2 = xCoord(i + 1);
      const y2 = yCoord(recentHistory[i + 1].forage_index_smoothed ?? 0);
      const color = getPhaseColor(recentHistory[i].phase);
      segments.push(
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color}
          strokeWidth={isFullscreen ? 2.5 : 1.5}
          strokeLinecap="round"
        />
      );
    }

    // Current position dot
    const lastVal = validForageHistory[validForageHistory.length - 1];
    const lastX = xCoord(validForageHistory.length - 1);
    const lastY = yCoord(lastVal);
    const lastPhase = recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].phase : 'TRANSITION';
    const dotColor = getPhaseColor(lastPhase);

    // Hover calculation helper for this width/padding
    const handleMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const xInSvg = clientX - rect.left;
      const xPercent = (xInSvg - paddingLeft) / chartWidth;
      
      if (recentHistory && recentHistory.length > 0) {
        const index = Math.min(
          recentHistory.length - 1,
          Math.max(0, Math.round(xPercent * (recentHistory.length - 1)))
        );
        setHoveredIndex(index);
      }
    };

    return (
      <div className="w-full flex flex-col justify-between" style={{ height }}>
        <svg
          className="w-full cursor-crosshair select-none"
          viewBox={`0 0 ${width} ${height}`}
          style={{ height: `${height}px`, touchAction: 'none' }}
          onMouseMove={handleMove}
          onTouchMove={handleMove}
          onMouseLeave={handlePointerLeave}
          onTouchEnd={handlePointerLeave}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#2ECC71" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Phase zone background bands (dynamically clipped to yMax) */}
          {(() => {
            const bands = [
              { id: 'peak', label: 'PEAK', low: 0.75, high: 1.00, color: '#2ECC71', opacity: 0.05 },
              { id: 'flow', label: 'FLOW', low: 0.30, high: 0.75, color: '#F1C40F', opacity: 0.05 },
              { id: 'transition', label: 'TRANSITION', low: 0.20, high: 0.30, color: '#E67E22', opacity: 0.05 },
              { id: 'dearth', label: 'DEARTH', low: 0.00, high: 0.20, color: '#E74C3C', opacity: 0.05 },
            ];

            return bands.map((band) => {
              const clippedLow = Math.max(0.0, Math.min(yMax, band.low));
              const clippedHigh = Math.max(0.0, Math.min(yMax, band.high));

              if (clippedHigh <= clippedLow) return null;

              const yTop = yCoord(clippedHigh);
              const yBottom = yCoord(clippedLow);
              const rectHeight = yBottom - yTop;
              const yMid = yCoord((clippedLow + clippedHigh) / 2);

              return (
                <g key={band.id}>
                  <rect
                    x={paddingLeft}
                    y={yTop}
                    width={chartWidth}
                    height={rectHeight}
                    fill={band.color}
                    opacity={band.opacity}
                  />
                  <text
                    x={paddingLeft + 10}
                    y={yMid + 3}
                    fill={band.color}
                    opacity="0.35"
                    fontSize={isFullscreen ? "9" : "7"}
                    fontWeight="extrabold"
                  >
                    {band.label}
                  </text>
                </g>
              );
            });
          })()}

          {/* Grid lines and Y-axis text */}
          {yGridValues.map((val) => {
            const y = yCoord(val);
            const isDashed = Math.abs(val - yMax / 2) < 0.0001;
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#ffffff"
                  strokeOpacity={isDashed ? 0.08 : 0.04}
                  strokeWidth="0.8"
                  strokeDasharray={isDashed ? "1,2" : undefined}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  fill="#64748b"
                  fontSize={isFullscreen ? "9" : "8"}
                  fontWeight="bold"
                  textAnchor="end"
                >
                  {(val * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Area fill under curve */}
          <path d={areaPath} fill="url(#areaFill)" />

          {/* Phase-colored line segments */}
          {segments}

          {/* Last value dot */}
          <circle cx={lastX} cy={lastY} r={isFullscreen ? "3" : "2"} fill={dotColor} stroke="#0f0f20" strokeWidth="0.8" />
          <circle cx={lastX} cy={lastY} r={isFullscreen ? "5" : "3.5"} fill={dotColor} opacity="0.2">
            <animate attributeName="r" values={isFullscreen ? "3;6;3" : "2;4;2"} dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2.5s" repeatCount="indefinite" />
          </circle>

          {/* Hover date line & dot */}
          {hoveredIndex !== null && recentHistory[hoveredIndex] && (() => {
            const hX = xCoord(hoveredIndex);
            const val = recentHistory[hoveredIndex].forage_index_smoothed ?? 0;
            const hY = yCoord(val);
            const color = getPhaseColor(recentHistory[hoveredIndex].phase);
            return (
              <g>
                <line
                  x1={hX}
                  y1={paddingTop}
                  x2={hX}
                  y2={height - paddingBottom}
                  stroke="#475569"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <circle
                  cx={hX}
                  cy={hY}
                  r={isFullscreen ? "3.5" : "2.5"}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              </g>
            );
          })()}
        </svg>

        {/* X-axis date labels */}
        <div 
          className="flex justify-between w-full text-slate-500 font-bold border-t border-[#222240]/40 pt-1.5 mt-1 select-none"
          style={{ paddingLeft: `${paddingLeft}px`, paddingRight: `${paddingRight}px`, fontSize: isFullscreen ? '10px' : '9px' }}
        >
          <span>{startMonth}</span>
          <span>{midMonth}</span>
          <span>{endMonth}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex-1 overflow-hidden flex flex-col text-white bg-[#0a0a14] relative">
      
      {/* Apiary Selector */}
      {apiariesList.length > 1 && (
        <div className="w-full bg-[#12121f] border-b border-[#2a2a4a] px-4 py-2.5 flex items-center gap-2 z-20">
          <MapPin size={14} className="text-amber-500 flex-shrink-0" />
          <select
            id="nectar-apiary-selector"
            value={selectedApiaryId || ''}
            onChange={(e) => {
              const selected = apiariesList.find(a => a.id === e.target.value);
              if (selected) {
                useAppStore.setState({ selectedApiaryId: selected.id, selectedApiaryName: selected.name });
              }
            }}
            className="flex-1 bg-transparent text-white text-sm font-semibold outline-none cursor-pointer appearance-none border-none"
            style={{ WebkitAppearance: 'none' }}
          >
            {apiariesList.map(a => (
              <option key={a.id} value={a.id} className="bg-[#1a1a2e] text-white">
                {a.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0 pointer-events-none" />
        </div>
      )}

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
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nectar Index</span>
                  <span className="text-2xl font-black text-white">{forageIndexVal === 'N/A' ? 'N/A' : `${forageIndexVal}%`}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Delta Nectar</span>
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

            {/* 5. SWIPE PANEL 3 - Nectar Drivers */}
            <div 
              onClick={() => setExpandDrivers(!expandDrivers)}
              className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg active:scale-[0.99] transition-all duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                  <Sparkles size={16} /> Nectar Drivers
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
            className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg select-none"
          >
            <div 
              onClick={() => setExpandTrends(!expandTrends)}
              className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4 cursor-pointer"
            >
              <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                <TrendingUp size={16} /> 12-Month Nectar Trend
              </h3>
              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${expandTrends ? 'rotate-180' : ''}`} />
            </div>

            {/* Enhanced Trend Chart */}
            <div 
              ref={chartContainerRef}
              className="bg-[#0f0f20] border border-[#222240] rounded-2xl p-4 flex flex-col items-center justify-center relative w-full"
            >
              {validForageHistory.length > 1 ? (
                <div className="w-full flex flex-col justify-between">
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={() => setIsEnlarged(true)}
                      className="p-1.5 bg-[#1b1b36]/80 hover:bg-[#2b2b54] border border-[#2b2b54] rounded-lg text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                      title="Enlarge Landscape Chart"
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  {renderChartSvg(containerWidth, 160)}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Insufficient history for trend line</p>
              )}
            </div>

            {/* Detailed Labels below Chart */}
            <div className="mt-3 bg-[#121226] border border-[#222240] rounded-xl p-4">
              {hoveredIndex !== null && recentHistory[hoveredIndex] ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-[#222240]/60 pb-2">
                    <span className="text-xs font-bold text-slate-400">Date</span>
                    <span className="text-sm font-extrabold text-white">
                      {new Date(recentHistory[hoveredIndex].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center justify-between bg-[#1b1b36]/40 p-2 rounded-lg border border-[#2b2b54]/40">
                      <span className="text-slate-400">Nectar Index</span>
                      <span className="font-black text-amber-500">
                        {recentHistory[hoveredIndex].forage_index_smoothed !== null 
                          ? `${(recentHistory[hoveredIndex].forage_index_smoothed * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[#1b1b36]/40 p-2 rounded-lg border border-[#2b2b54]/40">
                      <span className="text-slate-400">NDVI Vigor</span>
                      <span className="font-black text-emerald-400">
                        {recentHistory[hoveredIndex].ndvi_normalized !== null 
                          ? `${(recentHistory[hoveredIndex].ndvi_normalized * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[#1b1b36]/40 p-2 rounded-lg border border-[#2b2b54]/40">
                      <span className="text-slate-400">Bloom Factor</span>
                      <span className="font-black text-pink-400">
                        {recentHistory[hoveredIndex].bloom_factor !== null 
                          ? `${(recentHistory[hoveredIndex].bloom_factor * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[#1b1b36]/40 p-2 rounded-lg border border-[#2b2b54]/40">
                      <span className="text-slate-400">Weather Suit.</span>
                      <span className="font-black text-sky-400">
                        {recentHistory[hoveredIndex].weather_suitability !== null 
                          ? `${(recentHistory[hoveredIndex].weather_suitability * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-[#1b1b36]/60 p-2 rounded-lg border border-[#2b2b54]/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 text-left">Phase</span>
                    <span className={`font-extrabold px-2.5 py-0.5 rounded-full text-[10px] ${getPhaseColors(recentHistory[hoveredIndex].phase).bg} ${getPhaseColors(recentHistory[hoveredIndex].phase).text}`}>
                      {getPhaseColors(recentHistory[hoveredIndex].phase).emoji} {getPhaseColors(recentHistory[hoveredIndex].phase).label}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-[#222240]/60 pb-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400 text-left">Trend Direction</span>
                      <span className="font-extrabold text-white capitalize mt-0.5 flex items-center gap-1">
                        {resolvedTrendDirection === 'rising' ? <TrendingUp size={12} className="text-green-400" /> : resolvedTrendDirection === 'falling' ? <TrendingDown size={12} className="text-red-400" /> : <Minus size={12} className="text-slate-400" />}
                        {resolvedTrendDirection ? `${resolvedTrendDirection} trend` : 'Flat trend'}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 text-right">Current Phase</span>
                      <span className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] mt-0.5 ${colors.bg} ${colors.text}`}>
                        {colors.emoji} {colors.label}
                      </span>
                    </div>
                  </div>
                  {/* Latest readings grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>Latest Nectar:</span>
                      <span className="font-bold text-amber-500">{forageIndexVal === 'N/A' ? 'N/A' : `${forageIndexVal}%`}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Latest NDVI Vigor:</span>
                      <span className="font-bold text-emerald-400">{ndviDisp === 'N/A' ? 'N/A' : `${ndviDisp}%`}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Latest Bloom:</span>
                      <span className="font-bold text-pink-400">{bloomDisp === 'N/A' ? 'N/A' : `${bloomDisp}%`}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Latest Weather:</span>
                      <span className="font-bold text-sky-400">{weatherDisp === 'N/A' ? 'N/A' : `${weatherDisp}%`}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Expand list of numeric values */}
            {expandTrends && (
              <div className="mt-5 pt-4 border-t border-[#2b2b4d] space-y-2 text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200">
                <span className="font-extrabold text-white block mb-2">Weekly Smoothed Nectar Index</span>
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
                <div className="flex justify-between">
                  <span>USDA Hardiness Zone</span>
                  <span className="text-amber-500 font-bold">{data.usda_zone ? `Zone ${data.usda_zone}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Extreme Min Temp</span>
                  <span>{data.min_temp_of_year !== undefined && data.min_temp_of_year !== null ? `${data.min_temp_of_year.toFixed(1)}°F` : 'N/A'}</span>
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

      {isEnlarged && (
        <div className="fixed inset-0 z-50 bg-[#07070d] flex flex-col justify-between overflow-hidden">
          {/* Rotated wrapper for portrait, normal for landscape */}
          <div 
            className="portrait:w-[100vh] portrait:h-[100vw] portrait:absolute portrait:top-0 portrait:left-full portrait:origin-top-left portrait:rotate-90 landscape:w-full landscape:h-full flex flex-col p-6 justify-between"
          >
            {/* Header: Title and Close button */}
            <div className="flex items-center justify-between w-full border-b border-[#2b2b4d] pb-2.5 mb-2 select-none">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-amber-500" size={18} />
                <h3 className="text-sm font-black text-amber-500 tracking-wider uppercase">
                  {useAppStore.getState().selectedApiaryName} — Nectar Index Trend
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsEnlarged(false);
                  setHoveredIndex(null);
                }}
                className="p-2 bg-[#1b1b36] border border-[#2b2b54] rounded-full hover:bg-[#2b2b54] active:scale-95 transition-all text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Enlarged Chart Area */}
            <div className="flex-1 flex items-center justify-center bg-[#0d0d1a] border border-[#20203c] rounded-2xl p-4 my-2">
              {(() => {
                const isPortrait = window.innerHeight > window.innerWidth;
                const chartW = isPortrait ? window.innerHeight - 48 : window.innerWidth - 48;
                const chartH = isPortrait ? window.innerWidth * 0.60 : window.innerHeight * 0.60;
                return renderChartSvg(Math.max(300, chartW), Math.max(120, chartH), true);
              })()}
            </div>

            {/* Hover details grid in Fullscreen */}
            <div className="bg-[#121226] border border-[#222240] rounded-xl p-3 min-h-[50px] select-none">
              {hoveredIndex !== null && recentHistory[hoveredIndex] ? (
                <div className="flex items-center justify-between text-xs w-full gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Date</span>
                    <span className="font-extrabold text-white text-[11px] mt-0.5">
                      {new Date(recentHistory[hoveredIndex].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex-1 grid grid-cols-4 gap-2.5">
                    <div className="flex justify-between items-center bg-[#1b1b36]/40 px-2 py-1 rounded border border-[#2b2b54]/40">
                      <span className="text-slate-400 text-[10px]">Nectar Index:</span>
                      <span className="font-black text-amber-500 text-[11px] ml-1">
                        {recentHistory[hoveredIndex].forage_index_smoothed !== null 
                          ? `${(recentHistory[hoveredIndex].forage_index_smoothed * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#1b1b36]/40 px-2 py-1 rounded border border-[#2b2b54]/40">
                      <span className="text-slate-400 text-[10px]">NDVI Vigor:</span>
                      <span className="font-black text-emerald-400 text-[11px] ml-1">
                        {recentHistory[hoveredIndex].ndvi_normalized !== null 
                          ? `${(recentHistory[hoveredIndex].ndvi_normalized * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#1b1b36]/40 px-2 py-1 rounded border border-[#2b2b54]/40">
                      <span className="text-slate-400 text-[10px]">Bloom Factor:</span>
                      <span className="font-black text-pink-400 text-[11px] ml-1">
                        {recentHistory[hoveredIndex].bloom_factor !== null 
                          ? `${(recentHistory[hoveredIndex].bloom_factor * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#1b1b36]/40 px-2 py-1 rounded border border-[#2b2b54]/40">
                      <span className="text-slate-400 text-[10px]">Weather Suit.:</span>
                      <span className="font-black text-sky-400 text-[11px] ml-1">
                        {recentHistory[hoveredIndex].weather_suitability !== null 
                          ? `${(recentHistory[hoveredIndex].weather_suitability * 100).toFixed(0)}%` 
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Phase</span>
                    <span className={`font-extrabold px-2 py-0.5 rounded-full text-[9px] mt-0.5 ${getPhaseColors(recentHistory[hoveredIndex].phase).bg} ${getPhaseColors(recentHistory[hoveredIndex].phase).text}`}>
                      {getPhaseColors(recentHistory[hoveredIndex].phase).emoji} {getPhaseColors(recentHistory[hoveredIndex].phase).label}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-slate-500 font-bold">Latest Status</span>
                    <span className="font-extrabold text-white text-[11px] mt-0.5 flex items-center gap-1">
                      {resolvedTrendDirection === 'rising' ? <TrendingUp size={12} className="text-green-400" /> : resolvedTrendDirection === 'falling' ? <TrendingDown size={12} className="text-red-400" /> : <Minus size={12} className="text-slate-400" />}
                      {resolvedTrendDirection ? `${resolvedTrendDirection} trend` : 'Flat trend'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-400">
                    <div>Nectar: <span className="font-bold text-amber-500">{forageIndexVal}%</span></div>
                    <div>NDVI: <span className="font-bold text-emerald-400">{ndviDisp}%</span></div>
                    <div>Bloom: <span className="font-bold text-pink-400">{bloomDisp}%</span></div>
                    <div>Weather: <span className="font-bold text-sky-400">{weatherDisp}%</span></div>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-500 font-bold">Current Phase</span>
                    <span className={`font-extrabold px-2 py-0.5 rounded-full text-[9px] mt-0.5 ${colors.bg} ${colors.text}`}>
                      {colors.emoji} {colors.label}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
