// Nectar Flow V2 — tester preview.
// UI is identical to NectarFlowView; only the data source and the "Nectar Drivers"
// panel differ (replaced with V2 index components).
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import {
  MapPin, TrendingUp, TrendingDown, Minus, ChevronDown,
  Activity, AlertTriangle, RefreshCw, Sparkles, ShieldAlert,
  Maximize2, X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers (copied from NectarFlowView) ────────────────────────────────────

const getPhaseColors = (phase: string) => {
  switch (phase) {
    case 'IN_FLOW':       return { bg: 'bg-[#2ECC71]', text: 'text-white', label: 'In Flow',      emoji: '🌼' };
    case 'FLOW_STARTING': return { bg: 'bg-[#F1C40F]', text: 'text-black', label: 'Flow Starting', emoji: '🌱' };
    case 'FLOW_ENDING':   return { bg: 'bg-[#E67E22]', text: 'text-white', label: 'Flow Ending',   emoji: '🍂' };
    case 'DEARTH':        return { bg: 'bg-[#E74C3C]', text: 'text-white', label: 'Dearth',        emoji: '🏜️' };
    default:              return { bg: 'bg-[#95A5A6]', text: 'text-white', label: 'Transition',    emoji: '🌫️' };
  }
};

const getPhaseColor = (phase: string) => {
  switch (phase) {
    case 'IN_FLOW':       return '#2ECC71';
    case 'FLOW_STARTING': return '#F1C40F';
    case 'FLOW_ENDING':   return '#E67E22';
    case 'DEARTH':        return '#E74C3C';
    default:              return '#95A5A6';
  }
};

const getDayOfYear = (dateStr: string): number => {
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.min(364, Math.max(0, Math.floor((d.getTime() - start.getTime()) / 86400000)));
};

const getDayOfYearFraction = (dateStr: string) => getDayOfYear(dateStr) / 365;

const getHoveredDateLabel = (day: number) => {
  const date = new Date(2025, 0, 1 + day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getPhaseAdvice = (phase: string): string[] => {
  switch (phase) {
    case 'IN_FLOW':       return ['Add honey supers (space) to prevent swarming.', 'Stop supplemental feeding immediately.', 'Monitor brood nests for queen cups and swarm cells.'];
    case 'FLOW_ENDING':   return ['Reduce hive entrance sizes to protect against robbing.', 'Avoid making splits or exposing comb to the air.', 'Plan or prepare sugar syrup for supplemental feeding.'];
    case 'DEARTH':        return ['Feed sugar syrup / protein patties if hives are light.', 'Ensure entrance reducers or robbing screens are installed.', 'Avoid opening hives for long periods; robbing risk is extreme.'];
    case 'FLOW_STARTING': return ['Super your colonies early to catch the start of flow.', 'Check for rapid queen egg-laying and brood nest expansion.', 'Slow down or wind down any supplemental feeding.'];
    default:              return ['Monitor hive weight and colony population weekly.', 'Ensure bees have access to a clean water source nearby.', 'Check that hive entrances are clean and unblocked.'];
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

export const NectarFlowV2View: React.FC = () => {
  const { selectedApiaryId, apiariesList } = useAppStore();
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [data, setData]           = useState<V2Response | null>(null);

  const [activeTab, setActiveTab] = useState<'home' | 'apiaries' | 'trends'>('home');
  const [expandToday, setExpandToday]         = useState(false);
  const [expandComponents, setExpandComponents] = useState(false);
  const [expandTrends, setExpandTrends]       = useState(false);
  const [hoveredIndex, setHoveredIndex]       = useState<number | null>(null);
  const [isEnlarged, setIsEnlarged]           = useState(false);
  const [containerWidth, setContainerWidth]   = useState(320);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) { const w = e.contentRect.width; if (w > 0) setContainerWidth(w); }
    });
    obs.observe(chartContainerRef.current);
    return () => obs.disconnect();
  }, [activeTab]);

  // Auto-select single apiary
  useEffect(() => {
    if (!selectedApiaryId) {
      if (apiariesList.length === 1) {
        useAppStore.setState({ selectedApiaryId: apiariesList[0].id, selectedApiaryName: apiariesList[0].name });
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
      const { lat, lng } = apiary;
      if (lat == null || lng == null) throw new Error('Apiary coordinates are missing. Please edit apiary first.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        const res = await fetch(`/api/nectar-index-v2?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) { const t = await res.text(); throw new Error(t || `API error ${res.status}`); }
        setData(await res.json());
      } finally { clearTimeout(timeout); }
    } catch (e: any) {
      setError(e.name === 'AbortError' ? 'Request timed out. Earth Engine can take up to 60s.' : e.message);
    } finally { setLoading(false); }
  }, [selectedApiaryId]);

  useEffect(() => { setData(null); setError(null); loadData(); }, [selectedApiaryId, loadData]);

  const handlePointerLeave = () => setHoveredIndex(null);

  // ── No apiary ──────────────────────────────────────────────────────────────
  if (!selectedApiaryId) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center justify-center gap-6 shadow-2xl border border-[#2a2a4a] w-full max-w-md">
          <div className="text-center">
            <h3 className="text-2xl font-black text-amber-500">Select Apiary Yard</h3>
            <p className="text-xs text-slate-400 font-medium mt-2 leading-relaxed">Choose a location to compute the foraging nectar index.</p>
          </div>
          <div className="w-full flex flex-col gap-3">
            {apiariesList.map((a: any) => (
              <button key={a.id}
                onClick={() => useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name })}
                className="w-full bg-[#24243e] border border-[#3b3b5c] p-4 rounded-2xl text-center font-bold text-sm hover:border-amber-500 active:scale-98 transition-all duration-200">
                {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-2xl border border-[#2a2a4a] text-center w-full max-w-md">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-amber-500 text-lg mt-2">Connecting GEE & Open-Meteo...</p>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">Retrieving Sentinel-2 imagery, computing vegetation indices, and merging weather data.</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 text-white bg-[#0f0f1a]">
        <div className="bg-[#1a1a2e]/80 backdrop-blur-md rounded-3xl p-8 text-center border border-red-500/30 shadow-2xl bg-red-950/10 w-full max-w-md">
          <AlertTriangle className="text-red-500 mx-auto mb-3" size={40} />
          <p className="text-red-400 font-black text-lg mb-2">Fetch failed</p>
          <p className="text-xs text-red-300/80 font-medium leading-relaxed mb-6">{error}</p>
          <button onClick={loadData} className="w-full py-3 bg-red-900/40 text-red-200 border border-red-800/40 hover:bg-red-900/60 rounded-2xl text-sm font-bold transition-all">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // ── Data prep (same year-split logic as V1) ────────────────────────────────
  const years = Array.from(new Set((data.full_history || []).map(h => parseInt(h.date.slice(0, 4), 10)))).sort() as number[];
  const currentYear = years[years.length - 1] || new Date().getFullYear();
  const historicalYears = years.filter(y => y < currentYear);
  const baseYear = years[0] || currentYear - 1;
  const baseYearLabel = historicalYears.length > 1
    ? `${historicalYears[0]}-${historicalYears[historicalYears.length - 1]} Avg`
    : `${baseYear}`;

  const historyCurrent = (data.full_history || []).filter(h => parseInt(h.date.slice(0, 4), 10) === currentYear);

  const historyBaseMap: Record<number, { sum: number; count: number }> = {};
  for (let i = 0; i < 365; i++) historyBaseMap[i] = { sum: 0, count: 0 };
  (data.full_history || []).forEach(h => {
    if (parseInt(h.date.slice(0, 4), 10) < currentYear) {
      const idx = getDayOfYear(h.date);
      historyBaseMap[idx].sum += h.forage_index_smoothed;
      historyBaseMap[idx].count += 1;
    }
  });
  const historyBase = Array.from({ length: 365 }, (_, idx) => {
    const cell = historyBaseMap[idx];
    const avg = cell.count > 0 ? cell.sum / cell.count : null;
    const date = new Date(2025, 0, 1 + idx);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: dateStr, forage_index_smoothed: avg };
  }).filter(h => h.forage_index_smoothed !== null) as { date: string; forage_index_smoothed: number }[];

  const colors   = getPhaseColors(data.phase);
  const advice   = getPhaseAdvice(data.phase);
  const nfiDisp  = data.nfi;
  const slopeVal = data.slope ?? 0;
  const trendDir = data.trend_direction;
  const pct      = (v: number) => `${Math.round(v * 100)}%`;

  // ── Chart (copied verbatim from NectarFlowView.renderChartSvg) ────────────
  const renderChartSvg = (width: number, height: number, isFullscreen = false) => {
    const paddingLeft = 40, paddingRight = 15, paddingTop = 15, paddingBottom = 20;
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    if (!historyBase.length && !historyCurrent.length) {
      return <div className="flex items-center justify-center text-xs text-slate-500" style={{ height }}>Insufficient history for trend line</div>;
    }

    const baseVals = historyBase.map(h => h.forage_index_smoothed).filter(v => v !== null && !isNaN(v));
    const currVals = historyCurrent.map(h => h.forage_index_smoothed).filter(v => v !== null && !isNaN(v));
    const maxHistoryVal = Math.max(...baseVals, ...currVals, 0.20);
    const targetYMax = maxHistoryVal * 1.10;
    let yMax = 1.0, yGridValues = [1.0, 0.75, 0.50, 0.25, 0.0];
    if      (targetYMax <= 0.20) { yMax = 0.20; yGridValues = [0.20, 0.15, 0.10, 0.05, 0.0]; }
    else if (targetYMax <= 0.40) { yMax = 0.40; yGridValues = [0.40, 0.30, 0.20, 0.10, 0.0]; }
    else if (targetYMax <= 0.60) { yMax = 0.60; yGridValues = [0.60, 0.45, 0.30, 0.15, 0.0]; }
    else if (targetYMax <= 0.80) { yMax = 0.80; yGridValues = [0.80, 0.60, 0.40, 0.20, 0.0]; }

    const yCoord = (val: number) => height - paddingBottom - (val / yMax) * chartHeight;
    const getX   = (d: string)   => paddingLeft + getDayOfYearFraction(d) * chartWidth;

    // Area fill
    let areaPoints = '', isFirstArea = true, firstAreaX = paddingLeft, lastAreaX = paddingLeft;
    for (const h of historyCurrent) {
      if (h.forage_index_smoothed != null && !isNaN(h.forage_index_smoothed)) {
        const x = getX(h.date), y = yCoord(h.forage_index_smoothed);
        if (isFirstArea) { areaPoints += `${x},${y}`; firstAreaX = x; isFirstArea = false; }
        else areaPoints += ` L ${x},${y}`;
        lastAreaX = x;
      }
    }
    const areaPath = areaPoints ? `M ${firstAreaX},${yCoord(0)} L ${areaPoints} L ${lastAreaX},${yCoord(0)} Z` : '';

    // Baseline path
    let basePath = '', isFirstBase = true;
    for (const h of historyBase) {
      if (h.forage_index_smoothed != null && !isNaN(h.forage_index_smoothed)) {
        const x = getX(h.date), y = yCoord(h.forage_index_smoothed);
        basePath += isFirstBase ? `M ${x},${y}` : ` L ${x},${y}`;
        isFirstBase = false;
      }
    }

    // Current year phase segments
    const segments: React.ReactNode[] = [];
    for (let i = 0; i < historyCurrent.length - 1; i++) {
      const h1 = historyCurrent[i], h2 = historyCurrent[i + 1];
      if (h1.forage_index_smoothed != null && !isNaN(h1.forage_index_smoothed) &&
          h2.forage_index_smoothed != null && !isNaN(h2.forage_index_smoothed)) {
        segments.push(
          <line key={`seg-${i}`}
            x1={getX(h1.date)} y1={yCoord(h1.forage_index_smoothed)}
            x2={getX(h2.date)} y2={yCoord(h2.forage_index_smoothed)}
            stroke={getPhaseColor(h1.phase)} strokeWidth={isFullscreen ? 3 : 2} strokeLinecap="round" />
        );
      }
    }

    // Dot at end of current year line
    let dotX = paddingLeft, dotY = yCoord(0), dotColor = '#95A5A6';
    if (historyCurrent.length > 0) {
      const last = historyCurrent[historyCurrent.length - 1];
      if (last.forage_index_smoothed != null && !isNaN(last.forage_index_smoothed)) {
        dotX = getX(last.date); dotY = yCoord(last.forage_index_smoothed); dotColor = getPhaseColor(last.phase);
      }
    }

    const handleMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const day = Math.min(364, Math.max(0, Math.round(((clientX - rect.left - paddingLeft) / chartWidth) * 364)));
      setHoveredIndex(day);
    };

    const baseHov = historyBase.find(h => getDayOfYear(h.date) === hoveredIndex);
    const currHov = historyCurrent.find(h => getDayOfYear(h.date) === hoveredIndex);
    const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const bands = [
      { id: 'peak',       label: 'PEAK',       low: 0.75, high: 1.00, color: '#2ECC71', opacity: 0.03 },
      { id: 'flow',       label: 'FLOW',        low: 0.30, high: 0.75, color: '#F1C40F', opacity: 0.03 },
      { id: 'transition', label: 'TRANSITION',  low: 0.20, high: 0.30, color: '#E67E22', opacity: 0.03 },
      { id: 'dearth',     label: 'DEARTH',      low: 0.00, high: 0.20, color: '#E74C3C', opacity: 0.03 },
    ];

    return (
      <div className="w-full flex flex-col justify-between" style={{ height }}>
        <svg className="w-full cursor-crosshair select-none"
          viewBox={`0 0 ${width} ${height}`}
          style={{ height: `${height}px`, touchAction: 'none' }}
          onMouseMove={handleMove} onTouchMove={handleMove}
          onMouseLeave={handlePointerLeave} onTouchEnd={handlePointerLeave}>
          <defs>
            <linearGradient id="v2AreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#2ECC71" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {bands.map(b => {
            const lo = Math.max(0, Math.min(yMax, b.low)), hi = Math.max(0, Math.min(yMax, b.high));
            if (hi <= lo) return null;
            return (
              <g key={b.id}>
                <rect x={paddingLeft} y={yCoord(hi)} width={chartWidth} height={yCoord(lo) - yCoord(hi)} fill={b.color} opacity={b.opacity} />
                <text x={paddingLeft + 10} y={(yCoord(hi) + yCoord(lo)) / 2 + 3} fill={b.color} opacity="0.3" fontSize={isFullscreen ? 9 : 7} fontWeight="800">{b.label}</text>
              </g>
            );
          })}

          {yGridValues.map(val => {
            const y = yCoord(val), dashed = Math.abs(val - yMax / 2) < 0.0001;
            return (
              <g key={val}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#ffffff" strokeOpacity={dashed ? 0.08 : 0.04} strokeWidth="0.8" strokeDasharray={dashed ? '1,2' : undefined} />
                <text x={paddingLeft - 8} y={y + 3} fill="#64748b" fontSize={isFullscreen ? 9 : 8} fontWeight="bold" textAnchor="end">{(val * 100).toFixed(0)}%</text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#v2AreaFill)" />}
          {basePath  && <path d={basePath} fill="none" stroke="#2563eb" strokeWidth={isFullscreen ? 2.5 : 1.5} opacity="0.8" />}
          {segments}

          {historyCurrent.length > 0 && (
            <g>
              <circle cx={dotX} cy={dotY} r={isFullscreen ? 3 : 2} fill={dotColor} stroke="#0f0f20" strokeWidth="0.8" />
              <circle cx={dotX} cy={dotY} r={isFullscreen ? 5 : 3.5} fill={dotColor} opacity="0.2">
                <animate attributeName="r" values={isFullscreen ? '3;6;3' : '2;4;2'} dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.05;0.3" dur="2.5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {hoveredIndex !== null && (() => {
            const hX = paddingLeft + (hoveredIndex / 364) * chartWidth;
            return (
              <g>
                <line x1={hX} y1={paddingTop} x2={hX} y2={height - paddingBottom} stroke="#475569" strokeWidth="1" strokeDasharray="2,2" />
                {baseHov?.forage_index_smoothed != null && (
                  <circle cx={hX} cy={yCoord(baseHov.forage_index_smoothed)} r={isFullscreen ? 3.5 : 2.5} fill="#2563eb" stroke="#ffffff" strokeWidth="1" />
                )}
                {currHov?.forage_index_smoothed != null && (
                  <circle cx={hX} cy={yCoord(currHov.forage_index_smoothed)} r={isFullscreen ? 3.5 : 2.5} fill={getPhaseColor(currHov.phase)} stroke="#ffffff" strokeWidth="1" />
                )}
              </g>
            );
          })()}
        </svg>

        <div className="flex justify-between w-full text-slate-500 font-bold border-t border-[#222240]/40 pt-1.5 mt-1 select-none"
          style={{ paddingLeft: `${paddingLeft}px`, paddingRight: `${paddingRight}px`, fontSize: isFullscreen ? '9px' : '8px' }}>
          {months.map(m => <span key={m}>{m}</span>)}
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex-1 overflow-hidden flex flex-col text-white bg-[#0a0a14] relative">

      {/* Apiary selector */}
      {apiariesList.length > 1 && (
        <div className="w-full bg-[#12121f] border-b border-[#2a2a4a] px-4 py-2.5 flex items-center gap-2 z-20">
          <MapPin size={14} className="text-amber-500 flex-shrink-0" />
          <select value={selectedApiaryId || ''}
            onChange={e => {
              const a = apiariesList.find((x: any) => x.id === e.target.value);
              if (a) useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
            }}
            className="flex-1 bg-transparent text-white text-sm font-semibold outline-none cursor-pointer appearance-none border-none"
            style={{ WebkitAppearance: 'none' }}>
            {apiariesList.map((a: any) => (
              <option key={a.id} value={a.id} className="bg-[#1a1a2e] text-white">{a.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="text-slate-400 flex-shrink-0 pointer-events-none" />
        </div>
      )}

      {/* Status banner */}
      <div className={`w-full ${colors.bg} ${colors.text} p-5 text-center shadow-lg transition-all duration-300 relative select-none z-10`}>
        <div className="absolute top-4 right-4">
          <button onClick={loadData} className="p-2 bg-black/10 border border-white/20 rounded-full hover:bg-black/20 transition-all cursor-pointer" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
        <h1 className="text-3xl font-black tracking-wide flex items-center justify-center gap-2">
          {colors.emoji} {colors.label}
        </h1>
        <p className="text-xs font-semibold opacity-90 mt-1 max-w-[340px] mx-auto leading-normal">{data.transitionAdvice}</p>
        <div className="flex items-center justify-center gap-2 mt-3 select-none">
          <span className="bg-black/15 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/10">NFI: {nfiDisp}</span>
          <span className="bg-black/15 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/10">
            {trendDir === 'rising' ? '↑' : trendDir === 'falling' ? '↓' : '→'} {trendDir}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

        {activeTab === 'home' && (
          <>
            {/* Today at a Glance */}
            <div onClick={() => setExpandToday(v => !v)}
              className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg active:scale-[0.99] transition-all duration-150 cursor-pointer select-none">
              <div className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                  <Activity size={16} /> Today at a Glance
                </h3>
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${expandToday ? 'rotate-180' : ''}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Nectar Index (V2)</span>
                  <span className="text-2xl font-black text-white">{nfiDisp}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trend</span>
                  <span className={`text-2xl font-black flex items-center gap-1 ${slopeVal > 0.002 ? 'text-green-400' : slopeVal < -0.002 ? 'text-red-400' : 'text-slate-300'}`}>
                    {slopeVal > 0.002 ? <TrendingUp size={20} /> : slopeVal < -0.002 ? <TrendingDown size={20} /> : <Minus size={20} />}
                    {trendDir}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Greening Rate</span>
                  <span className="text-lg font-extrabold text-white mt-0.5">{pct(data.v2.rate_norm)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Warmth Gate</span>
                  <span className="text-lg font-extrabold text-white mt-0.5">{pct(data.v2.warmth)}</span>
                </div>
              </div>
              {expandToday && (
                <div className="mt-5 pt-4 border-t border-[#2b2b4d] space-y-2 text-xs text-slate-300 animate-in slide-in-from-top-2 duration-200">
                  {[
                    ['Greenness (NDVI/EVI)', pct(data.v2.greenness)],
                    ['Vigor (above baseline)', pct(data.v2.vigor)],
                    ['Moisture (NDWI)', pct(data.v2.moisture)],
                    ['Rate norm (core signal)', pct(data.v2.rate_norm)],
                    ['Fall term (photo×dew)', pct(data.v2.fall_term)],
                    ['Warmth gate (14d temp)', pct(data.v2.warmth)],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between border-b border-[#20203a] pb-1.5">
                      <span>{label}</span><span className="font-bold text-white">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* V2 Index Components (replaces Nectar Drivers) */}
            <div onClick={() => setExpandComponents(v => !v)}
              className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg active:scale-[0.99] transition-all duration-150 cursor-pointer select-none">
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
                      <span className="text-amber-400">{pct(val)}</span>
                    </div>
                    <div className="w-full bg-[#1b1b36] h-3 rounded-full overflow-hidden border border-[#2d2d54]">
                      <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: pct(val) }} />
                    </div>
                    {expandComponents && <p className="text-[10px] text-slate-500">{tip}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Actions */}
            <div className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg select-none">
              <div className="border-b border-[#2b2b4d] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                  <ShieldAlert size={16} /> Recommended Actions
                </h3>
              </div>
              <ul className="space-y-3 text-xs leading-relaxed text-slate-300">
                {advice.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="text-amber-500 font-bold mt-0.5">•</span><span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {activeTab === 'trends' && (
          <div className="bg-[#151529]/80 border border-[#2b2b4d] rounded-3xl p-5 shadow-lg select-none">
            <div onClick={() => setExpandTrends(v => !v)}
              className="flex items-center justify-between border-b border-[#2b2b4d] pb-3 mb-4 cursor-pointer">
              <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider flex items-center gap-2">
                <TrendingUp size={16} /> 12-Month Nectar Trend
              </h3>
              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${expandTrends ? 'rotate-180' : ''}`} />
            </div>
            <div ref={chartContainerRef} className="bg-[#0f0f20] border border-[#222240] rounded-2xl p-4 flex flex-col items-center justify-center relative w-full">
              {(historyBase.length > 1 || historyCurrent.length > 1) ? (
                <div className="w-full flex flex-col justify-between">
                  <div className="absolute top-3 right-3 z-10">
                    <button onClick={() => setIsEnlarged(true)}
                      className="p-1.5 bg-[#1b1b36]/80 hover:bg-[#2b2b54] border border-[#2b2b54] rounded-lg text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                      title="Enlarge chart">
                      <Maximize2 size={14} />
                    </button>
                  </div>
                  {renderChartSvg(containerWidth, 160)}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Insufficient history for trend line</p>
              )}
            </div>

            {/* Hover / summary panel */}
            <div className="mt-3 bg-[#121226] border border-[#222240] rounded-xl p-4">
              {hoveredIndex !== null ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-[#222240]/60 pb-2">
                    <span className="text-xs font-bold text-slate-400">Calendar Day</span>
                    <span className="text-sm font-extrabold text-white">{getHoveredDateLabel(hoveredIndex)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center justify-between bg-[#1b1b36]/40 p-2 rounded-lg border border-[#2b2b54]/40">
                      <span className="text-slate-400 font-bold">{baseYearLabel} NFI:</span>
                      <span className="font-black text-blue-400">
                        {historyBase.find(h => getDayOfYear(h.date) === hoveredIndex)?.forage_index_smoothed != null
                          ? `${(historyBase.find(h => getDayOfYear(h.date) === hoveredIndex)!.forage_index_smoothed * 100).toFixed(0)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-[#1b1b36]/40 p-2 rounded-lg border border-[#2b2b54]/40">
                      <span className="text-slate-400 font-bold">{currentYear} NFI:</span>
                      <span className="font-black text-amber-500">
                        {historyCurrent.find(h => getDayOfYear(h.date) === hoveredIndex)?.forage_index_smoothed != null
                          ? `${(historyCurrent.find(h => getDayOfYear(h.date) === hoveredIndex)!.forage_index_smoothed * 100).toFixed(0)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  {(() => {
                    const curr = historyCurrent.find(h => getDayOfYear(h.date) === hoveredIndex);
                    if (!curr) return null;
                    return (
                      <div className="flex justify-between items-center bg-[#1b1b36]/60 p-2 rounded-lg border border-[#2b2b54]/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400">{currentYear} Phase</span>
                        <span className={`font-extrabold px-2.5 py-0.5 rounded-full text-[10px] ${getPhaseColors(curr.phase).bg} ${getPhaseColors(curr.phase).text}`}>
                          {getPhaseColors(curr.phase).emoji} {getPhaseColors(curr.phase).label}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-[#222240]/60 pb-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Trend Direction</span>
                      <span className="font-extrabold text-white capitalize mt-0.5 flex items-center gap-1">
                        {trendDir === 'rising' ? <TrendingUp size={12} className="text-green-400" /> : trendDir === 'falling' ? <TrendingDown size={12} className="text-red-400" /> : <Minus size={12} className="text-slate-400" />}
                        {trendDir} trend
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Current Phase</span>
                      <span className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] mt-0.5 ${colors.bg} ${colors.text}`}>
                        {colors.emoji} {colors.label}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex justify-between text-slate-400">
                      <span>NFI (V2):</span><span className="font-bold text-amber-500">{nfiDisp}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Greening Rate:</span><span className="font-bold text-emerald-400">{pct(data.v2.rate_norm)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Fall Term:</span><span className="font-bold text-orange-400">{pct(data.v2.fall_term)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Warmth Gate:</span><span className="font-bold text-sky-400">{pct(data.v2.warmth)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'apiaries' && (
          <div className="space-y-4">
            <h3 className="text-sm uppercase font-extrabold text-amber-500 tracking-wider pl-1 select-none">Your Apiaries ({apiariesList.length})</h3>
            <div className="space-y-3">
              {apiariesList.map((a: any) => (
                <div key={a.id}
                  onClick={() => { if (a.id !== selectedApiaryId) { useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name }); setActiveTab('home'); } }}
                  className={`bg-[#151529]/80 border ${a.id === selectedApiaryId ? 'border-amber-500/80' : 'border-[#2b2b4d]'} rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all select-none`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3.5 h-3.5 rounded-full ${a.id === selectedApiaryId ? colors.bg : 'bg-slate-500'}`} />
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-sm">{a.name}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">{a.id === selectedApiaryId ? 'Active · Updated today' : 'Tap to select'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav (matches V1) */}
      <div className="w-full absolute bottom-0 left-0 right-0 bg-[#0f0f20]/95 backdrop-blur-lg border-t border-[#222240] px-6 py-2.5 flex items-center justify-around z-20 select-none">
        {([
          { key: 'home',      icon: <Activity size={20} />,    label: 'Home' },
          { key: 'trends',    icon: <TrendingUp size={20} />,  label: 'Trends' },
          { key: 'apiaries',  icon: <MapPin size={20} />,      label: 'Apiaries' },
        ] as const).map(({ key, icon, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${activeTab === key ? 'text-amber-500 scale-105' : 'text-slate-500 hover:text-slate-300'}`}>
            {icon}<span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </div>

      {/* Enlarged chart modal (matches V1) */}
      {isEnlarged && (
        <div className="fixed inset-0 z-50 bg-[#07070d] flex flex-col justify-between overflow-hidden">
          <div className="portrait:w-[100vh] portrait:h-[100vw] portrait:absolute portrait:top-0 portrait:left-full portrait:origin-top-left portrait:rotate-90 landscape:w-full landscape:h-full flex flex-col p-6 justify-between">
            <div className="flex items-center justify-between w-full border-b border-[#2b2b4d] pb-2.5 mb-2 select-none">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-amber-500" size={18} />
                <h3 className="text-sm font-black text-amber-500 tracking-wider uppercase">
                  {useAppStore.getState().selectedApiaryName} — Nectar Index Trend
                </h3>
              </div>
              <button onClick={() => { setIsEnlarged(false); setHoveredIndex(null); }}
                className="p-2 bg-[#1b1b36] border border-[#2b2b54] rounded-full hover:bg-[#2b2b54] active:scale-95 transition-all text-slate-400 hover:text-white cursor-pointer">
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
            <div className="bg-[#121226] border border-[#222240] rounded-xl p-3 min-h-[50px] select-none">
              <div className="flex items-center justify-between text-xs w-full">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-slate-500">Latest Status</span>
                  <span className="font-extrabold text-white text-[11px] mt-0.5">
                    {trendDir === 'rising' ? '↑ Rising' : trendDir === 'falling' ? '↓ Falling' : '→ Flat'} trend
                  </span>
                </div>
                <div className="flex gap-4 text-[10px] text-slate-400">
                  <div>NFI: <span className="font-bold text-amber-500">{nfiDisp}</span></div>
                  <div>Rate: <span className="font-bold text-emerald-400">{pct(data.v2.rate_norm)}</span></div>
                  <div>Warmth: <span className="font-bold text-sky-400">{pct(data.v2.warmth)}</span></div>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-500">Phase</span>
                  <span className={`font-extrabold px-2 py-0.5 rounded-full text-[9px] mt-0.5 ${colors.bg} ${colors.text}`}>
                    {colors.emoji} {colors.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pb-1 text-center" style={{ paddingBottom: '60px' }}>
        <span className="text-[9px] text-slate-700 font-semibold uppercase tracking-widest">Nectar Flow V2 · tester preview</span>
      </div>
    </div>
  );
};
