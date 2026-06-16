// Nectar Flow V2 — tester preview.
// UI structure and chart copied verbatim from NectarFlowView.
// Only differences: API endpoint, data shape (v2.*), and "Nectar Drivers"
// panel replaced with "V2 Index Components".
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import {
  MapPin,
  TrendingUp,
  ChevronDown,
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  Minus,
  Sparkles,
  ShieldAlert,
  Maximize2,
  X,
} from 'lucide-react';

type Phase = 'DEARTH' | 'FLOW_STARTING' | 'IN_FLOW' | 'FLOW_ENDING' | 'TRANSITION';

interface V2Response {
  nfi: number;
  phase: Phase;
  status: string;
  transitionAdvice: string;
  trend_direction: 'rising' | 'falling' | 'flat';
  slope: number;
  v2: {
    greenness: number;
    vigor: number;
    moisture: number;
    warmth: number;
    fall_term: number;
    rate_norm: number;
  };
  full_history: { date: string; forage_index_smoothed: number; phase: Phase }[];
}

export const NectarFlowV2View: React.FC = () => {
  const { selectedApiaryId, apiariesList } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<V2Response | null>(null);

  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<'home' | 'apiaries' | 'trends'>('trends');

  // Expandable panels state
  const [expandToday, setExpandToday] = useState(false);
  const [expandComponents, setExpandComponents] = useState(false);
  const [expandTrends, setExpandTrends] = useState(false);

  // Hover cursor state for trends chart
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Enlarged Landscape Modal State
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [containerWidth, setContainerWidth] = useState(320);
  const [containerHeight, setContainerHeight] = useState(300);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0) setContainerWidth(w);
        if (h > 0) setContainerHeight(h);
      }
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
    // Re-run once data loads: the chart container only mounts after the loading
    // guard clears, so on a Trends-default mount the ref is null on first run.
  }, [activeTab, loading, data]);

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

  const loadData = useCallback(async () => {
    if (!selectedApiaryId) return;
    setLoading(true);
    setError(null);
    try {
      const apiary = await fetchApiaryWithCoords(selectedApiaryId);
      const lat = apiary.lat;
      const lng = apiary.lng;
      if (lat === null || lng === null || lat === undefined || lng === undefined) {
        throw new Error('This apiary coordinates are missing. Please edit apiary first.');
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        const params = new URLSearchParams({
          lat: lat.toFixed(4), lng: lng.toFixed(4),
        });
        const res = await fetch(`/api/nectar-index-v2?${params}`, { signal: controller.signal });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `API error ${res.status}`);
        }
        setData(await res.json());
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: any) {
      setError(err.name === 'AbortError' ? 'Request timed out. Earth Engine can take up to 60s.' : err.message || 'Failed to load nectar flow index');
    } finally {
      setLoading(false);
    }
  }, [selectedApiaryId]);

  useEffect(() => {
    setData(null);
    setError(null);
    loadData();
  }, [selectedApiaryId, loadData]);

  // Phase color mapping (copied verbatim from NectarFlowView)
  const getPhaseColors = (phase: string) => {
    switch (phase) {
      case 'IN_FLOW':
        return { bg: 'bg-[#2ECC71]', text: 'text-white', label: 'In Flow', emoji: '🌼' };
      case 'FLOW_STARTING':
        return { bg: 'bg-[#58D68D]', text: 'text-black', label: 'Flow Starting', emoji: '🌱' };
      case 'FLOW_ENDING':
        return { bg: 'bg-[#1E8449]', text: 'text-white', label: 'Flow Ending', emoji: '🍂' };
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
      case 'FLOW_STARTING': return '#58D68D';
      case 'FLOW_ENDING': return '#1E8449';
      case 'DEARTH': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const handlePointerLeave = () => {
    setHoveredIndex(null);
  };

  // Phase advice (copied verbatim from NectarFlowView)
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

  // No apiary (copied verbatim from NectarFlowView)
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
            {apiariesList.map((a: any) => (
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

  // Loading (copied verbatim from NectarFlowView)
  if (loading) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-2xl border border-[#2a2a4a] text-center w-full max-w-md">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-amber-500 text-lg mt-2">Connecting GEE & Open-Meteo...</p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">
            Retrieving Sentinel-2 imagery, computing vegetation indices, and merging weather data.
          </p>
        </div>
      </div>
    );
  }

  // Error (copied verbatim from NectarFlowView)
  if (error) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-8 text-center border border-red-500/30 shadow-2xl bg-red-950/10 w-full max-w-md">
          <AlertTriangle className="text-red-500 mx-auto mb-3" size={40} />
          <p className="text-red-400 font-black text-lg mb-2">Fetch failed</p>
          <p className="text-xs text-red-300/80 font-medium leading-relaxed mb-6">{error}</p>
          <button
            onClick={loadData}
            className="w-full py-3 bg-red-900/40 text-red-200 border border-red-800/40 hover:bg-red-900/60 rounded-2xl text-sm font-bold transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Resolved values
  const currentPhase = data.phase;
  const colors = getPhaseColors(currentPhase);
  const adviceList = getPhaseAdvice(currentPhase);
  const resolvedTrendDirection = data.trend_direction;
  const forageIndexVal = data.nfi.toString();
  const deltaVal = data.slope ?? 0;
  const deltaStr = Math.abs(deltaVal) <= 0.002
    ? '0.0%'
    : (deltaVal > 0 ? '+' : '') + (deltaVal * 100).toFixed(1) + '%';

  // Helper functions (copied verbatim from NectarFlowView)
  const getDayOfYear = (dateStr: string) => {
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    const start = new Date(year, 0, 1);
    const diff = d.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.min(364, Math.max(0, Math.floor(diff / oneDay)));
  };

  const getDayOfYearFraction = (dateStr: string) => {
    return getDayOfYear(dateStr) / 365;
  };

  const getHoveredDateLabel = (day: number) => {
    const date = new Date(2025, 0, 1 + day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Year-split history (copied verbatim from NectarFlowView, V2 has no ndvi/bloom/weather in history)
  const years = Array.from(
    new Set((data.full_history || []).map((h) => parseInt(h.date.split('-')[0], 10)))
  ).sort() as number[];

  const currentYear = years[years.length - 1] || new Date().getFullYear();
  const historicalYears = years.filter(y => y < currentYear);
  const baseYear = years[0] || currentYear - 1;
  const baseYearLabel = historicalYears.length > 1
    ? `${historicalYears[0]}-${historicalYears[historicalYears.length - 1]} Avg`
    : `${baseYear}`;

  const historyCurrent = (data.full_history || []).filter(
    (h) => parseInt(h.date.split('-')[0], 10) === currentYear
  );

  const historyBaseMap: Record<number, { sum: number; count: number }> = {};
  for (let i = 0; i < 365; i++) {
    historyBaseMap[i] = { sum: 0, count: 0 };
  }

  (data.full_history || []).forEach((h) => {
    const year = parseInt(h.date.split('-')[0], 10);
    if (year < currentYear) {
      const dayIdx = getDayOfYear(h.date);
      if (h.forage_index_smoothed !== null && !isNaN(h.forage_index_smoothed)) {
        historyBaseMap[dayIdx].sum += h.forage_index_smoothed;
        historyBaseMap[dayIdx].count += 1;
      }
    }
  });

  const historyBase = Array.from({ length: 365 }, (_, dayIdx) => {
    const cell = historyBaseMap[dayIdx];
    const nfiAvg = cell.count > 0 ? cell.sum / cell.count : null;
    const date = new Date(2025, 0, 1 + dayIdx);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return { date: dateStr, forage_index_smoothed: nfiAvg };
  }).filter(h => h.forage_index_smoothed !== null) as { date: string; forage_index_smoothed: number }[];

  // renderChartSvg — copied verbatim from NectarFlowView (lines 460-781)
  const renderChartSvg = (width: number, height: number, isFullscreen: boolean = false) => {
    const paddingLeft = 40;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    if (!historyBase.length && !historyCurrent.length) {
      return (
        <div className="flex items-center justify-center text-xs text-slate-500" style={{ height }}>
          Insufficient history for trend line
        </div>
      );
    }

    // Y-axis Dynamic Auto-Scaling (110% of Maximum value with discrete grid-friendly steps)
    const baseVals = historyBase.map((h: any) => h.forage_index_smoothed).filter((v: any) => v !== null && !isNaN(v));
    const currVals = historyCurrent.map((h: any) => h.forage_index_smoothed).filter((v: any) => v !== null && !isNaN(v));
    const maxHistoryVal = Math.max(...baseVals, ...currVals, 0.20);
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

    const getXCoordForDate = (dateStr: string) => {
      const fraction = getDayOfYearFraction(dateStr);
      return paddingLeft + fraction * chartWidth;
    };

    // Build area fill path for current year
    let areaPathPoints = '';
    let isFirstArea = true;
    let firstAreaX = paddingLeft;
    let lastAreaX = paddingLeft;
    for (const h of historyCurrent) {
      if (h.forage_index_smoothed !== null && !isNaN(h.forage_index_smoothed)) {
        const x = getXCoordForDate(h.date);
        const y = yCoord(h.forage_index_smoothed);
        if (isFirstArea) {
          areaPathPoints += `${x},${y}`;
          firstAreaX = x;
          isFirstArea = false;
        } else {
          areaPathPoints += ` L ${x},${y}`;
        }
        lastAreaX = x;
      }
    }
    const areaPath = areaPathPoints
      ? `M ${firstAreaX},${yCoord(0)} L ${areaPathPoints} L ${lastAreaX},${yCoord(0)} Z`
      : '';

    // Build baseline path (Solid Blue line)
    let baselinePathPoints = '';
    let isFirstBase = true;
    for (const h of historyBase) {
      if (h.forage_index_smoothed !== null && !isNaN(h.forage_index_smoothed)) {
        const x = getXCoordForDate(h.date);
        const y = yCoord(h.forage_index_smoothed);
        if (isFirstBase) {
          baselinePathPoints += `M ${x},${y}`;
          isFirstBase = false;
        } else {
          baselinePathPoints += ` L ${x},${y}`;
        }
      }
    }

    // Build current year segments (Phase-colored)
    const currentSegments: React.ReactNode[] = [];
    for (let i = 0; i < historyCurrent.length - 1; i++) {
      const h1 = historyCurrent[i];
      const h2 = historyCurrent[i + 1];
      if (
        h1.forage_index_smoothed !== null && !isNaN(h1.forage_index_smoothed) &&
        h2.forage_index_smoothed !== null && !isNaN(h2.forage_index_smoothed)
      ) {
        const x1 = getXCoordForDate(h1.date);
        const y1 = yCoord(h1.forage_index_smoothed);
        const x2 = getXCoordForDate(h2.date);
        const y2 = yCoord(h2.forage_index_smoothed);
        const color = getPhaseColor(h1.phase);
        currentSegments.push(
          <line
            key={`curr-seg-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={color}
            strokeWidth={isFullscreen ? 3.0 : 2.0}
            strokeLinecap="round"
          />
        );
      }
    }

    // Current position dot (end of current year line)
    let lastX = paddingLeft;
    let lastY = yCoord(0);
    let dotColor = '#95A5A6';
    if (historyCurrent.length > 0) {
      const lastCurrent = historyCurrent[historyCurrent.length - 1];
      if (lastCurrent.forage_index_smoothed !== null && !isNaN(lastCurrent.forage_index_smoothed)) {
        lastX = getXCoordForDate(lastCurrent.date);
        lastY = yCoord(lastCurrent.forage_index_smoothed);
        dotColor = getPhaseColor(lastCurrent.phase);
      }
    }

    // Hover calculation helper mapping X-coordinate to day of the year
    const handleMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const xInSvg = clientX - rect.left;
      const xPercent = (xInSvg - paddingLeft) / chartWidth;
      const day = Math.min(364, Math.max(0, Math.round(xPercent * 364)));
      setHoveredIndex(day);
    };

    // Look up entries for the hovered day
    const baseHovered = historyBase.find((h: any) => getDayOfYear(h.date) === hoveredIndex);
    const currentHovered = historyCurrent.find((h: any) => getDayOfYear(h.date) === hoveredIndex);

    // Month labels layout parameters
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
              <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2ECC71" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Phase zone background bands */}
          {(() => {
            const bands = [
              { id: 'peak', label: 'PEAK', low: 0.75, high: 1.00, color: '#2ECC71', opacity: 0.03 },
              { id: 'flow', label: 'FLOW', low: 0.30, high: 0.75, color: '#F1C40F', opacity: 0.03 },
              { id: 'transition', label: 'TRANSITION', low: 0.20, high: 0.30, color: '#E67E22', opacity: 0.03 },
              { id: 'dearth', label: 'DEARTH', low: 0.00, high: 0.20, color: '#E74C3C', opacity: 0.03 },
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
                    opacity="0.3"
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

          {/* Area fill under current year curve */}
          {areaPath && <path d={areaPath} fill="url(#areaFill)" />}

          {/* Baseline Path (Solid Blue) */}
          {baselinePathPoints && (
            <path
              d={baselinePathPoints}
              fill="none"
              stroke="#2563eb"
              strokeWidth={isFullscreen ? 2.5 : 1.5}
              opacity="0.8"
            />
          )}

          {/* Current year segments */}
          {currentSegments}

          {/* Current position dot */}
          {historyCurrent.length > 0 && (
            <g>
              <circle cx={lastX} cy={lastY} r={isFullscreen ? "3" : "2"} fill={dotColor} stroke="#0f0f20" strokeWidth="0.8" />
              <circle cx={lastX} cy={lastY} r={isFullscreen ? "5" : "3.5"} fill={dotColor} opacity="0.2">
                <animate attributeName="r" values={isFullscreen ? "3;6;3" : "2;4;2"} dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2.5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* Hover date line & dots for both years */}
          {hoveredIndex !== null && (() => {
            const hX = paddingLeft + (hoveredIndex / 364) * chartWidth;
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
                {baseHovered?.forage_index_smoothed !== null && baseHovered?.forage_index_smoothed !== undefined && (
                  <circle
                    cx={hX}
                    cy={yCoord(baseHovered.forage_index_smoothed)}
                    r={isFullscreen ? "3.5" : "2.5"}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
                {currentHovered?.forage_index_smoothed !== null && currentHovered?.forage_index_smoothed !== undefined && (
                  <circle
                    cx={hX}
                    cy={yCoord(currentHovered.forage_index_smoothed)}
                    r={isFullscreen ? "3.5" : "2.5"}
                    fill={getPhaseColor(currentHovered.phase)}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })()}
        </svg>

        {/* X-axis Month Labels (Jan - Dec) */}
        <div
          className="flex justify-between w-full text-slate-500 font-bold border-t border-[#222240]/40 pt-1.5 mt-1 select-none"
          style={{ paddingLeft: `${paddingLeft}px`, paddingRight: `${paddingRight}px`, fontSize: isFullscreen ? '9px' : '8px' }}
        >
          {months.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex-1 overflow-hidden flex flex-col text-white bg-[#0a0a14] relative">

      {/* Apiary Selector (copied verbatim from NectarFlowView) */}
      {apiariesList.length > 1 && (
        <div className="w-full bg-[#12121f] border-b border-[#2a2a4a] px-4 py-2.5 flex items-center gap-2 z-20">
          <MapPin size={14} className="text-amber-500 flex-shrink-0" />
          <select
            value={selectedApiaryId || ''}
            onChange={(e) => {
              const a = apiariesList.find((x: any) => x.id === e.target.value);
              if (a) useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
            }}
            className="flex-1 bg-transparent text-white text-sm font-semibold outline-none cursor-pointer appearance-none border-none"
            style={{ WebkitAppearance: 'none' }}
          >
            {apiariesList.map((a: any) => (
              <option key={a.id} value={a.id} className="bg-[#1a1a2e] text-white">{a.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0 pointer-events-none" />
        </div>
      )}

      {/* Status Banner — slim phase strip (chart-focal redesign) */}
      <div className={`w-full ${colors.bg} ${colors.text} px-4 py-3 shadow-md relative select-none z-10 flex items-center gap-3`}>
        <span className="text-2xl leading-none shrink-0">{colors.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-black tracking-wide leading-none">{colors.label}</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
              {resolvedTrendDirection === 'rising' ? '↑' : resolvedTrendDirection === 'falling' ? '↓' : '→'} {resolvedTrendDirection}
            </span>
          </div>
          <p className="text-[11px] font-semibold opacity-90 leading-snug mt-0.5 line-clamp-1">{data.transitionAdvice}</p>
        </div>
        <span className="bg-black/15 text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border border-white/10 shrink-0">
          NFI {data.nfi}
        </span>
        <button
          onClick={loadData}
          className="p-2 bg-black/10 border border-white/20 rounded-full hover:bg-black/20 transition-all cursor-pointer shrink-0"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 flex flex-col gap-4">

        {/* HOME TAB */}
        {activeTab === 'home' && (
          <>
            {/* Today at a Glance */}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nectar Index (V2)</span>
                  <span className="text-2xl font-black text-white">{forageIndexVal}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trend</span>
                  <span className={`text-2xl font-black flex items-center gap-1 ${deltaVal > 0.002 ? 'text-green-400' : deltaVal < -0.002 ? 'text-red-400' : 'text-slate-300'}`}>
                    {deltaVal > 0.002 ? <TrendingUp size={20} /> : deltaVal < -0.002 ? <TrendingDown size={20} /> : <Minus size={20} />}
                    {deltaStr}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Greening Rate</span>
                  <span className="text-lg font-extrabold text-white mt-0.5">{Math.round(data.v2.rate_norm * 100)}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warmth Gate</span>
                  <span className="text-lg font-extrabold text-white mt-0.5">{Math.round(data.v2.warmth * 100)}%</span>
                </div>
              </div>
              {expandToday && (
                <div className="mt-5 pt-4 border-t border-[#2b2b4d] space-y-2 text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200">
                  {[
                    ['Greenness (NDVI/EVI)', `${Math.round(data.v2.greenness * 100)}%`],
                    ['Vigor (above baseline)', `${Math.round(data.v2.vigor * 100)}%`],
                    ['Moisture (NDWI)', `${Math.round(data.v2.moisture * 100)}%`],
                    ['Rate norm (core signal)', `${Math.round(data.v2.rate_norm * 100)}%`],
                    ['Fall term (photo×dew)', `${Math.round(data.v2.fall_term * 100)}%`],
                    ['Warmth gate (14d temp)', `${Math.round(data.v2.warmth * 100)}%`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between border-b border-[#20203a] pb-1.5">
                      <span>{label}</span><span className="font-bold text-white">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* V2 Index Components (replaces Nectar Drivers) */}
            <div
              onClick={() => setExpandComponents(!expandComponents)}
              className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg active:scale-[0.99] transition-all duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                  <Sparkles size={16} /> V2 Index Components
                </h3>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${expandComponents ? 'rotate-180' : ''}`} />
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Greenness',   val: data.v2.greenness,  color: 'bg-emerald-500', tip: 'NDVI/EVI fusion' },
                  { label: 'Vigor',       val: data.v2.vigor,      color: 'bg-lime-500',    tip: 'above winter baseline' },
                  { label: 'Moisture',    val: data.v2.moisture,   color: 'bg-sky-500',     tip: 'NDWI canopy water' },
                  { label: 'Rate (core)', val: data.v2.rate_norm,  color: 'bg-amber-500',   tip: 'greening velocity' },
                  { label: 'Fall term',   val: data.v2.fall_term,  color: 'bg-orange-500',  tip: 'photoperiod × dewpoint' },
                  { label: 'Warmth gate', val: data.v2.warmth,     color: 'bg-red-500',     tip: '14-day mean temp ramp' },
                ].map(({ label, val, color, tip }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{label}</span>
                      <span className="text-amber-400">{Math.round(val * 100)}%</span>
                    </div>
                    <div className="w-full bg-[#1b1b36] h-3 rounded-full overflow-hidden border border-[#2d2d54]">
                      <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.round(val * 100)}%` }} />
                    </div>
                    {expandComponents && <p className="text-[10px] text-slate-500">{tip}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Actions (copied verbatim from NectarFlowView) */}
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

        {/* TRENDS TAB (copied verbatim from NectarFlowView; hover panel shows NFI only — V2 history has no NDVI/Bloom/Weather) */}
        {activeTab === 'trends' && (
          <div className="flex flex-col gap-3 flex-1 min-h-0 select-none">
            {/* Hero chart — the focal point */}
            <div
              ref={chartContainerRef}
              className="bg-[#0f0f20] border border-[#222240] rounded-2xl p-3 sm:p-4 relative w-full flex-1 min-h-[240px] flex flex-col justify-center"
            >
              {(historyBase.length > 1 || historyCurrent.length > 1) ? (
                <>
                  {/* Inset metrics overlay */}
                  <div className="absolute top-3 left-3 z-20 bg-[#0a0a16]/80 backdrop-blur-sm border border-[#2b2b54]/60 rounded-xl px-3 py-2 shadow-lg pointer-events-none">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-white leading-none">{data.nfi}</span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">NFI</span>
                        <span className="text-[10px] font-bold text-slate-300 flex items-center gap-0.5 capitalize">
                          {resolvedTrendDirection === 'rising' ? <TrendingUp size={10} className="text-green-400" /> : resolvedTrendDirection === 'falling' ? <TrendingDown size={10} className="text-red-400" /> : <Minus size={10} className="text-slate-400" />}
                          {resolvedTrendDirection}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-2">
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider">Rate</span>
                        <span className="text-[11px] font-black text-emerald-400">{Math.round(data.v2.rate_norm * 100)}%</span>
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider">Warmth</span>
                        <span className="text-[11px] font-black text-sky-400">{Math.round(data.v2.warmth * 100)}%</span>
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8px] uppercase font-bold text-slate-500 tracking-wider">Fall</span>
                        <span className="text-[11px] font-black text-orange-400">{Math.round(data.v2.fall_term * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  {/* Enlarge button */}
                  <div className="absolute top-3 right-3 z-20">
                    <button
                      onClick={() => setIsEnlarged(true)}
                      className="p-1.5 bg-[#1b1b36]/80 hover:bg-[#2b2b54] border border-[#2b2b54] rounded-lg text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                      title="Enlarge Landscape Chart"
                    >
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  {renderChartSvg(containerWidth, Math.max(220, containerHeight - 28))}
                </>
              ) : (
                <p className="text-xs text-slate-500 text-center py-10">Insufficient history for trend line</p>
              )}
            </div>

            {/* Compact readout strip — daily values on hover, legend otherwise */}
            <div className="bg-[#121226] border border-[#222240] rounded-xl px-4 py-2.5">
              {hoveredIndex !== null ? (() => {
                const hb = historyBase.find((h: any) => getDayOfYear(h.date) === hoveredIndex);
                const hc = historyCurrent.find((h: any) => getDayOfYear(h.date) === hoveredIndex);
                return (
                  <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
                    <span className="font-extrabold text-white">{getHoveredDateLabel(hoveredIndex)}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400">{baseYearLabel}: <b className="text-blue-400">{hb && hb.forage_index_smoothed != null ? `${(hb.forage_index_smoothed * 100).toFixed(0)}%` : 'N/A'}</b></span>
                      <span className="text-slate-400">{currentYear}: <b className="text-amber-500">{hc && hc.forage_index_smoothed != null ? `${(hc.forage_index_smoothed * 100).toFixed(0)}%` : 'N/A'}</b></span>
                      {hc && (
                        <span className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] ${getPhaseColors(hc.phase).bg} ${getPhaseColors(hc.phase).text}`}>
                          {getPhaseColors(hc.phase).emoji} {getPhaseColors(hc.phase).label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 flex-wrap">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded bg-blue-500 inline-block" />{baseYearLabel}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded bg-amber-500 inline-block" />{currentYear} (current)</span>
                  </div>
                  <span className="text-slate-500 italic">Hover for daily values</span>
                </div>
              )}
            </div>

            {/* Weekly values — collapsible detail */}
            <div>
              <button
                onClick={() => setExpandTrends(!expandTrends)}
                className="w-full flex items-center justify-between text-[11px] uppercase font-bold text-slate-500 tracking-wider px-1 py-1.5 hover:text-slate-300 cursor-pointer"
              >
                <span>{currentYear} Weekly Values</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${expandTrends ? 'rotate-180' : ''}`} />
              </button>
              {expandTrends && (
                <div className="mt-1 bg-[#121226] border border-[#222240] rounded-xl p-3 space-y-1.5 text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200">
                  {historyCurrent.filter((_: any, idx: number) => idx % 7 === 0 || idx === historyCurrent.length - 1).map((h: any, i: number) => (
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
          </div>
        )}

        {/* APIARIES TAB (copied verbatim from NectarFlowView) */}
        {activeTab === 'apiaries' && (
          <div className="space-y-4">
            <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider pl-1 select-none">
              Your Apiaries ({apiariesList.length})
            </h3>
            <div className="space-y-3">
              {apiariesList.map((a: any) => {
                const isSelected = a.id === selectedApiaryId;
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
      </div>

      {/* Bottom Nav (copied verbatim from NectarFlowView, Settings tab omitted for V2 preview) */}
      <div className="w-full absolute bottom-0 left-0 right-0 bg-[#0f0f20]/95 backdrop-blur-lg border-t border-[#222240] px-6 py-2.5 flex items-center justify-around z-20 select-none">
        {([
          { key: 'home' as const,     icon: <Activity size={20} />,   label: 'Home' },
          { key: 'trends' as const,   icon: <TrendingUp size={20} />, label: 'Trends' },
          { key: 'apiaries' as const, icon: <MapPin size={20} />,     label: 'Apiaries' },
        ]).map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${activeTab === key ? 'text-amber-500 scale-105' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {icon}
            <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </div>

      {/* Enlarged chart modal (copied verbatim from NectarFlowView) */}
      {isEnlarged && (
        <div className="fixed inset-0 z-50 bg-[#07070d] flex flex-col justify-between overflow-hidden">
          <div
            className="portrait:w-[100vh] portrait:h-[100vw] portrait:absolute portrait:top-0 portrait:left-full portrait:origin-top-left portrait:rotate-90 landscape:w-full landscape:h-full flex flex-col p-6 justify-between"
          >
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

            <div className="flex-1 flex items-center justify-center bg-[#0d0d1a] border border-[#20203c] rounded-2xl p-4 my-2">
              {(() => {
                const isPortrait = window.innerHeight > window.innerWidth;
                const chartW = isPortrait ? window.innerHeight - 48 : window.innerWidth - 48;
                const chartH = isPortrait ? window.innerWidth * 0.60 : window.innerHeight * 0.60;
                return renderChartSvg(Math.max(300, chartW), Math.max(120, chartH), true);
              })()}
            </div>

            {/* Fullscreen hover panel (copied verbatim from NectarFlowView; NDVI/Bloom/Weather columns omitted) */}
            <div className="bg-[#121226] border border-[#222240] rounded-xl p-3 min-h-[50px] select-none">
              {hoveredIndex !== null ? (
                <div className="flex items-center justify-between text-xs w-full gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Calendar Day</span>
                    <span className="font-extrabold text-white text-[11px] mt-0.5">
                      {getHoveredDateLabel(hoveredIndex)}
                    </span>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div className="flex justify-between items-center bg-[#1b1b36]/40 px-2 py-1 rounded border border-[#2b2b54]/40">
                      <span className="text-slate-400 text-[9px] font-bold">{baseYearLabel} NFI:</span>
                      <span className="font-black text-blue-400 text-[10px]">
                        {historyBase.find((h: any) => getDayOfYear(h.date) === hoveredIndex)?.forage_index_smoothed !== undefined &&
                        historyBase.find((h: any) => getDayOfYear(h.date) === hoveredIndex)?.forage_index_smoothed !== null
                          ? `${(historyBase.find((h: any) => getDayOfYear(h.date) === hoveredIndex)!.forage_index_smoothed * 100).toFixed(0)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#1b1b36]/40 px-2 py-1 rounded border border-[#2b2b54]/40">
                      <span className="text-slate-400 text-[9px] font-bold">{currentYear} NFI:</span>
                      <span className="font-black text-amber-500 text-[10px]">
                        {historyCurrent.find((h: any) => getDayOfYear(h.date) === hoveredIndex)?.forage_index_smoothed !== undefined &&
                        historyCurrent.find((h: any) => getDayOfYear(h.date) === hoveredIndex)?.forage_index_smoothed !== null
                          ? `${(historyCurrent.find((h: any) => getDayOfYear(h.date) === hoveredIndex)!.forage_index_smoothed * 100).toFixed(0)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const curr = historyCurrent.find((h: any) => getDayOfYear(h.date) === hoveredIndex);
                    if (!curr) return null;
                    return (
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] uppercase font-bold text-slate-500">{currentYear} Phase</span>
                        <span className={`font-extrabold px-2 py-0.5 rounded-full text-[9px] mt-0.5 ${getPhaseColors(curr.phase).bg} ${getPhaseColors(curr.phase).text}`}>
                          {getPhaseColors(curr.phase).emoji} {getPhaseColors(curr.phase).label}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs w-full">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Latest Status</span>
                    <span className="font-extrabold text-white text-[11px] mt-0.5 flex items-center gap-1">
                      {resolvedTrendDirection === 'rising' ? <TrendingUp size={12} className="text-green-400" /> : resolvedTrendDirection === 'falling' ? <TrendingDown size={12} className="text-red-400" /> : <Minus size={12} className="text-slate-400" />}
                      {resolvedTrendDirection ? `${resolvedTrendDirection} trend` : 'Flat trend'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-400">
                    <div>Nectar: <span className="font-bold text-amber-500">{forageIndexVal}</span></div>
                    <div>Rate: <span className="font-bold text-emerald-400">{Math.round(data.v2.rate_norm * 100)}%</span></div>
                    <div>Warmth: <span className="font-bold text-sky-400">{Math.round(data.v2.warmth * 100)}%</span></div>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-500">Current Phase</span>
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

      <div style={{ paddingBottom: '60px' }} className="text-center">
        <span className="text-[9px] text-slate-700 font-semibold uppercase tracking-widest">Nectar Flow V2 · tester preview</span>
      </div>
    </div>
  );
};
