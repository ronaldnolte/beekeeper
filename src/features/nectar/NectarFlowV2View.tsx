// Nectar Flow — satellite-driven nectar index (formerly "V2").
// Pipeline: Sentinel-2 greenness fusion → rate-of-change core → fall-bloom term →
// warmth weighting → EWMA smooth → phase classification. Served by /api/nectar-index-v2.
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { chartDayOfYear, MONTH_STARTS, MONTH_LABELS } from '../../../api/_season';
import { useAppStore } from '../../store/useAppStore';
import { SelectionList } from '../../shared/components/SelectionList';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import { supabase } from '../../data/supabase';
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
  Maximize2,
  Satellite,
  Info,
  X,
} from 'lucide-react';

/** "Aug 28" — scene dates are plain YYYY-MM-DD, so parse them as UTC, not local. */
function formatSceneDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

declare const __BUILD_TIME__: string;

type Phase = 'DEARTH' | 'TRENDING_UP' | 'IN_FLOW' | 'TRENDING_DOWN';

interface ServerTiming {
  earth_engine_ms: number;
  weather_ms: number;
  pipeline_ms: number;
  server_total_ms: number;
  satellite_observations: number;
}

interface V2Response {
  nfi: number;
  phase: Phase;
  status: string;

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
  // The satellite's own schedule, separate from what it managed to see.
  // last_pass / next_pass are overflights, which happen whatever the weather;
  // last_image is the most recent pass that produced usable numbers. When those
  // two dates differ, cloud is the difference.
  satellite?: {
    last_pass: string | null;
    last_image: string | null;
    next_pass: string | null;
    pass_count: number;
    image_count: number;
  };
  _timing?: ServerTiming;
}

// Client-measured phases plus the server's self-reported breakdown.
interface LoadTiming {
  coordMs: number;      // Supabase apiary-coordinate lookup
  roundTripMs: number;  // full API request (server compute + network + any CDN)
  server: ServerTiming | null;
}

export const NectarFlowV2View: React.FC = () => {
  const { selectedApiaryId, apiariesList } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<V2Response | null>(null);


  // Expandable panels state
  const [expandToday, setExpandToday] = useState(false);
  const [expandComponents, setExpandComponents] = useState(false);
  const [expandTrends, setExpandTrends] = useState(false);

  // Hover cursor state for trends chart
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Enlarged Landscape Modal State
  const [isEnlarged, setIsEnlarged] = useState(false);
  // The old DETAILS sub-tab, now a panel behind the (i) on the chart.
  const [showDetails, setShowDetails] = useState(false);
  const [containerWidth, setContainerWidth] = useState(320);
  const [chartHeight, setChartHeight] = useState(300);
  // Resolved lat/lng actually sent to the API (post zip-geocoding). Shown next to
  // the apiary name so dev/prod runs can be confirmed to use identical coordinates.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Per-phase load timing (diagnostics) + a live elapsed counter for the spinner.
  // Load timing is still measured and logged to the console as [nectar timing]; it is no
  // longer held in state because nothing renders it since the diagnostic bar came out.
  const [elapsedSec, setElapsedSec] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Size the chart explicitly from the scroll-area height (flex-1 fill did not
  // propagate reliably here). Fills the space down to the readout strip / nav.
  useEffect(() => {
    const compute = () => {
      const el = contentRef.current;
      if (!el) return;
      // reserve = content padding + readout strip + weekly toggle + nav clearance + chart chrome
      setChartHeight(Math.max(220, el.clientHeight - 255));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [loading, data]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
    // Re-run once data loads: the chart container only mounts after the loading
    // guard clears, so on a Trends-default mount the ref is null on first run.
  }, [loading, data]);

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

  const loadData = useCallback(async (forceFresh = false, externalSignal?: AbortSignal) => {
    if (!selectedApiaryId) return;
    setLoading(true);
    setError(null);
    try {
      const coordStart = performance.now();
      const apiary = await fetchApiaryWithCoords(selectedApiaryId);
      const coordMs = Math.round(performance.now() - coordStart);
      // Superseded while we were resolving coordinates (apiary switch / unmount /
      // StrictMode's dev double-invoke) — bail before kicking off the slow fetch.
      if (externalSignal?.aborted) return;
      const lat = apiary.lat;
      const lng = apiary.lng;
      if (lat === null || lng === null || lat === undefined || lng === undefined) {
        throw new Error('This apiary coordinates are missing. Please edit apiary first.');
      }
      setCoords({ lat, lng });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      // Propagate an outer cancel into this request so we never leave a stale Earth
      // Engine call running or let an abandoned load overwrite fresher data.
      const onOuterAbort = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', onOuterAbort, { once: true });
      }
      try {
        const params = new URLSearchParams({
          lat: lat.toFixed(4), lng: lng.toFixed(4),
        });
        // Cache control: the refresh button forces a fresh fetch that bypasses the
        // Vercel CDN + browser cache (unique URL); normal loads use a per-day key so
        // repeat visits within a day stay fast but data still refreshes daily.
        if (forceFresh) {
          params.set('nocache', Date.now().toString());
        } else {
          params.set('_d', new Date().toISOString().slice(0, 10));
        }
        // Absolute host only in the packaged Capacitor app (it loads from a
        // localhost scheme, so a relative /api path would not reach the server).
        // Web — prod, preview, and dev via the Vite proxy — stays same-origin.
        const apiBase = Capacitor.isNativePlatform()
          ? 'https://beekeeper.beektools.com/api/nectar-index-v2'
          : '/api/nectar-index-v2';
        // The endpoint requires a signed-in user (it triggers paid Earth
        // Engine work) — pass the session token in the Authorization header.
        const { data: { session } } = await supabase.auth.getSession();
        const fetchStart = performance.now();
        const res = await fetch(`${apiBase}?${params}`, {
          signal: controller.signal,
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `API error ${res.status}`);
        }
        const json = await res.json();
        const roundTripMs = Math.round(performance.now() - fetchStart);
        if (externalSignal?.aborted) return; // superseded — don't clobber newer data
        const loadTiming: LoadTiming = { coordMs, roundTripMs, server: json._timing ?? null };
        // eslint-disable-next-line no-console
        console.log('[nectar timing]', loadTiming);

        setData(json);
      } finally {
        clearTimeout(timeout);
        if (externalSignal) externalSignal.removeEventListener('abort', onOuterAbort);
      }
    } catch (err: any) {
      // An intentional outer cancel is not an error worth showing the user.
      if (externalSignal?.aborted) return;
      setError(err.name === 'AbortError' ? 'Request timed out. Earth Engine can take up to 60s.' : err.message || 'Failed to load nectar flow index');
    } finally {
      // Skip on an intentional cancel so we don't stomp the superseding load's state.
      if (!externalSignal?.aborted) setLoading(false);
    }
  }, [selectedApiaryId]);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    loadData(false, controller.signal);
    // Cancel the in-flight request if the apiary changes or the view unmounts —
    // and, in dev, cancels StrictMode's first invocation so only one fetch runs.
    return () => controller.abort();
  }, [selectedApiaryId, loadData]);

  // Live elapsed-seconds counter for the loading screen so a long wait visibly
  // progresses instead of sitting on a static spinner.
  useEffect(() => {
    if (!loading) return;
    setElapsedSec(0);
    const start = Date.now();
    const id = setInterval(() => setElapsedSec(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [loading]);

  // Phase color mapping (copied verbatim from NectarFlowView)
  const getPhaseColors = (phase: string) => {
    switch (phase) {
      case 'IN_FLOW':
        return { bg: 'bg-[#2ECC71]', text: 'text-black', label: 'In Flow', emoji: '🌼' };
      case 'TRENDING_UP':
        return { bg: 'bg-[#58D68D]', text: 'text-black', label: 'Trending Up', emoji: '🌱' };
      case 'TRENDING_DOWN':
        // White, NOT the text token: these two badges are filled with a dark colour,
        // so their label has to contrast with the badge, not with the page.
        return { bg: 'bg-[#1E8449]', text: 'text-white', label: 'Trending Down', emoji: '🍂' };
      case 'DEARTH':
      default:
        // Darker than the chart's #E74C3C on purpose. White on #E74C3C measures 3.8:1, and
        // the advice line under it is small text, which needs 4.5:1 — genuinely hard to
        // read, and worse outdoors on a phone at a hive. #C0392B measures 5.4:1.
        return { bg: 'bg-[#C0392B]', text: 'text-white', label: 'Dearth', emoji: '🏜️' };
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'IN_FLOW': return '#2ECC71';
      case 'TRENDING_UP': return '#58D68D';
      case 'TRENDING_DOWN': return '#1E8449';
      case 'DEARTH': return '#E74C3C';
      default: return '#95A5A6';
    }
  };

  const handlePointerLeave = () => {
    setHoveredIndex(null);
  };

  // Phase advice (copied verbatim from NectarFlowView)

  // Choosing a yard is the same act here as on the Apiaries screen, so it uses
  // the same component and reads the same way — Ron, 2026-08-31: "the apiary
  // selection seems as though it should match the apiary option". This screen
  // used to roll its own dark buttons, which is also why the picker looked like
  // a different app from the list two taps away.
  if (!selectedApiaryId) {
    return (
      <div className="w-full flex-1 overflow-y-auto bg-[var(--color-bg)]">
        <div className="mx-auto w-full max-w-2xl px-4 pt-5 pb-28">
          <h3 className="text-xl font-black text-[var(--color-text)]">Which yard?</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Nectar Flow reads the landscape around one apiary at a time.
          </p>
          <div className="mt-5">
            <SelectionList
              items={apiariesList.map((a: any) => ({
                id: a.id,
                title: a.name,
                subtitle: a.zip_code
                  ? `ZIP: ${a.zip_code}`
                  : (a.latitude ? 'Location: Coordinates' : 'No location set'),
                icon: <MapPin size={22} />,
                raw: a,
              }))}
              emptyMessage="No apiaries yet. Add one on the Apiaries tab and it will show up here."
              onSelect={(id) => {
                const a = apiariesList.find((x: any) => x.id === id);
                useAppStore.setState({ selectedApiaryId: id, selectedApiaryName: a?.name });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Loading (copied verbatim from NectarFlowView)
  if (loading) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 bg-[var(--color-bg)]">
        <div className="card p-12 flex flex-col items-center justify-center gap-4 text-center w-full max-w-md">
          <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="font-bold text-[var(--color-primary-ink)] text-lg mt-2">Analyzing satellite imagery…</p>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-[280px]">
            Pulling recent satellite and weather data for your apiary and computing the
            nectar forecast. This usually takes 10–30 seconds, and a little longer the
            first time each day.
          </p>
          <p className="text-2xl font-black text-[var(--color-primary-ink)] tabular-nums mt-1">{elapsedSec}s</p>
        </div>
      </div>
    );
  }

  // Error (copied verbatim from NectarFlowView)
  if (error) {
    return (
      <div className="w-full flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 bg-[var(--color-bg)]">
        <div className="card p-8 text-center border-2 border-[var(--color-bad)]/30 w-full max-w-md">
          <AlertTriangle className="text-[var(--color-bad)] mx-auto mb-3" size={40} />
          <p className="text-[var(--color-bad)] font-black text-lg mb-2">Fetch failed</p>
          <p className="text-xs text-[var(--color-text-muted)] font-medium leading-relaxed mb-6">{error}</p>
          <button
            onClick={() => loadData(true)}
            className="w-full py-3 bg-[var(--color-bad)] text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
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
  const resolvedTrendDirection = data.trend_direction;
  const forageIndexVal = data.nfi.toString();
  const deltaVal = data.slope ?? 0;
  const deltaStr = Math.abs(deltaVal) <= 0.002
    ? '0.0%'
    : (deltaVal > 0 ? '+' : '') + (deltaVal * 100).toFixed(1) + '%';

  // Helper functions (copied verbatim from NectarFlowView)
  const getDayOfYear = chartDayOfYear;

  const getDayOfYearFraction = (dateStr: string) => {
    return getDayOfYear(dateStr) / 365;
  };

  const getHoveredDateLabel = (day: number) => {
    const date = new Date(Date.UTC(2025, 0, 1 + day));
    // timeZone UTC to match how the date was built. Without it, anyone west of UTC sees
    // the previous day's label.
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
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
    const date = new Date(Date.UTC(2025, 0, 1 + dayIdx));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
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
        <div className="flex items-center justify-center text-xs text-[var(--color-text-muted)]" style={{ height }}>
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
    // Month boundaries at their TRUE position on the axis.
    //
    // These labels were a flex row with justify-between, which spaces twelve of them evenly
    // edge to edge, while the DATA is plotted at its real day-of-year fraction. Two
    // different scales, and the error grew through the year: the "Aug" label sat at 63.6%
    // of the width where 1 August falls at 58.1% — about twenty days out — and December was
    // a full month adrift. Late August read as the start of the month.
    const monthMarks = MONTH_LABELS.map((label, i) => ({
      label,
      x: paddingLeft + (MONTH_STARTS[i] / 365) * chartWidth,
    }));

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

          {/* The phase zone bands were removed 2026-08-28. They drew four level ranges
              (dearth to 20, flow from 30, peak from 75) that matched neither the engine nor
              each other, at 3% opacity so they were barely visible anyway. Ron: "setting
              arbitrary limits is likely going to never work in all places." */}

          {/* Month boundaries and their labels. Both inside the svg on purpose: they share
              one coordinate system with the curve, so they cannot drift apart however the
              chart is scaled or padded. */}
          {monthMarks.map((m, i) => (
            <g key={`mo-${m.label}`}>
              {i > 0 && (
                <line
                  x1={m.x} y1={paddingTop}
                  x2={m.x} y2={height - paddingBottom}
                  stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1"
                />
              )}
              <text
                x={m.x} y={height - 5}
                fill="#64748b"
                fontSize={isFullscreen ? '9' : '8'}
                fontWeight="bold"
                textAnchor={i === 0 ? 'start' : 'middle'}
              >
                {m.label}
              </text>
            </g>
          ))}

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

        {/* Month labels are drawn inside the svg, so nothing goes here. */}
      </div>
    );
  };

  return (
    // Page furniture is light like the rest of the app; the chart panel and its
    // fullscreen view stay dark on purpose — see the comment at the chart.
    <div className="w-full flex-1 overflow-hidden flex flex-col text-[var(--color-text)] bg-[var(--color-bg)] relative">

      {/* Apiary Selector (copied verbatim from NectarFlowView) */}
      {apiariesList.length > 1 && (
        <div className="w-full bg-[var(--color-bg-raised)] border-b border-[var(--color-divider)] px-4 py-2.5 flex items-center gap-2 z-20">
          <MapPin size={14} className="text-[var(--color-primary)] flex-shrink-0" />
          <select
            value={selectedApiaryId || ''}
            onChange={(e) => {
              const a = apiariesList.find((x: any) => x.id === e.target.value);
              if (a) useAppStore.setState({ selectedApiaryId: a.id, selectedApiaryName: a.name });
            }}
            className="flex-1 bg-transparent text-[var(--color-text)] text-sm font-semibold outline-none cursor-pointer appearance-none border-none"
            style={{ WebkitAppearance: 'none' }}
          >
            {apiariesList.map((a: any) => (
              <option key={a.id} value={a.id} className="bg-[var(--color-bg-raised)] text-[var(--color-text)]">{a.name}</option>
            ))}
          </select>
          {coords && (
            <span className="text-[10px] font-mono text-[var(--color-text-muted)] flex-shrink-0 tabular-nums" title="Resolved coordinates sent to the index API">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
          <ChevronDown size={14} className="text-[var(--color-text-muted)] flex-shrink-0 pointer-events-none" />
        </div>
      )}

      {/* The full-width phase banner was removed 2026-09-08. It was a whole
          horizontal band carrying one word and a number the chart's own overlay
          already showed — NFI appeared twice on one screen. Ron: "If we write
          Dearth next to the NFI, we can eliminate the Red banner." The phase now
          lives in the overlay, tinted by its colour, and Refresh moved to the
          chart's control trio where the other chart actions are.

          The banner advice went earlier, 2026-08-28. Ron: "I think its spotty at
          best. Too many variables. Many of which are not even on the chart." */}

      {/* The load-timing bar was removed: the per-phase numbers were useful while the
          satellite fetch was being tuned, and are not useful day to day. Timings are
          still logged to the console as [nectar timing]. */}

      {/* Scrollable content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

        {/* TRENDS TAB (copied verbatim from NectarFlowView; hover panel shows NFI only — V2 history has no NDVI/Bloom/Weather) */}
        {(
          <div className="space-y-3 select-none">
            {/* Hero chart — the focal point */}
            <div
              ref={chartContainerRef}
              className="bg-[#0f0f20] border border-[#222240] rounded-2xl p-3 sm:p-4 relative w-full"
            >
              {(historyBase.length > 1 || historyCurrent.length > 1) ? (
                <>
                  {/* The state of the yard, in one place. This absorbed the
                      full-width phase banner: the index, the phase and the
                      direction now read as one line instead of one number here
                      and the same number in a red band above. The phase carries
                      its own colour, so the state is legible before the words
                      are. Rate / Warmth / Fall moved behind the (i) — they are
                      diagnostics, not the headline. */}
                  <div className="absolute top-3 left-3 z-20 bg-[#0a0a16]/85 backdrop-blur-sm border border-[#2b2b54]/60 rounded-xl px-3 py-2 shadow-lg pointer-events-none">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-white leading-none">{data.nfi}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">NFI</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-sm font-black leading-none" style={{ color: getPhaseColor(data.phase) }}>
                        {colors.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 capitalize">
                        {resolvedTrendDirection === 'rising' ? <TrendingUp size={10} /> : resolvedTrendDirection === 'falling' ? <TrendingDown size={10} /> : <Minus size={10} />}
                        {resolvedTrendDirection}
                      </span>
                    </div>
                  </div>

                  {/* Chart controls — one trio, equal weight, so none of them
                      hides in the plot the way the lone expand icon did. */}
                  <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
                    <button
                      onClick={() => loadData(true)}
                      className="p-2 bg-[#1b1b36]/80 hover:bg-[#2b2b54] border border-[#2b2b54] rounded-lg text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                      title="Refresh — fetches fresh satellite data, bypassing the cache"
                      aria-label="Refresh"
                    >
                      <RefreshCw size={15} />
                    </button>
                    <button
                      onClick={() => setShowDetails(true)}
                      className="p-2 bg-[#1b1b36]/80 hover:bg-[#2b2b54] border border-[#2b2b54] rounded-lg text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                      title="What is behind this number"
                      aria-label="Details"
                    >
                      <Info size={15} />
                    </button>
                    <button
                      onClick={() => setIsEnlarged(true)}
                      className="p-2 bg-[#1b1b36]/80 hover:bg-[#2b2b54] border border-[#2b2b54] rounded-lg text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                      title="Full screen"
                      aria-label="Full screen"
                    >
                      <Maximize2 size={15} />
                    </button>
                  </div>
                  {renderChartSvg(containerWidth, chartHeight)}
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
                      <span className="text-slate-400">{currentYear}: <b style={{ color: getPhaseColor(hc?.phase ?? '') }}>{hc && hc.forage_index_smoothed != null ? `${(hc.forage_index_smoothed * 100).toFixed(0)}%` : 'N/A'}</b></span>
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
                    <span className="text-[9px] font-mono text-slate-600" title="Build timestamp">⏱ {__BUILD_TIME__}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded bg-blue-500 inline-block" />{baseYearLabel}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-[2px] rounded bg-[#2ECC71] inline-block" />{currentYear} (current)</span>
                  </div>
                  {/* The satellite's schedule. Overflights are orbital and
                      happen regardless of weather; whether one yields a usable
                      image does not, which the note says outright so nobody
                      waits on a date expecting guaranteed fresh data. */}
                  {data.satellite?.last_image ? (
                    <span
                      className="flex items-center gap-1.5 text-slate-500"
                      title="Passes are orbital and happen on schedule. Whether one produces usable data depends on cloud cover over your yard."
                    >
                      <Satellite size={11} className="flex-shrink-0" />
                      <span>
                        Satellite: last image <b className="text-slate-300">{formatSceneDate(data.satellite.last_image)}</b>
                        {data.satellite.next_pass && (
                          <> · next pass <b className="text-slate-300">{formatSceneDate(data.satellite.next_pass)}</b></>
                        )}
                        <span className="italic"> — usable data depends on cloud cover</span>
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Hover for daily values</span>
                  )}
                </div>
              )}
            </div>

            {/* Weekly values — collapsible detail */}
            <div>
              <button
                onClick={() => setExpandTrends(!expandTrends)}
                className="w-full flex items-center justify-between text-[11px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider px-1 py-1.5 hover:text-[var(--color-text)] cursor-pointer"
              >
                <span>{currentYear} Weekly Values</span>
                <ChevronDown size={14} className={`transition-transform duration-300 ${expandTrends ? 'rotate-180' : ''}`} />
              </button>
              {expandTrends && (
                <div className="mt-1 bg-[var(--color-bg-raised)] border border-[var(--color-divider)] rounded-xl p-3 space-y-1.5 text-xs text-[var(--color-text)] animate-[rise-in_var(--dur-base)_var(--ease-soft)]">
                  {historyCurrent.filter((_: any, idx: number) => idx % 7 === 0 || idx === historyCurrent.length - 1).map((h: any, i: number) => (
                    <div key={i} className="flex justify-between border-b border-[var(--color-divider)] pb-1.5">
                      <span>{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="font-bold text-[var(--color-text)]">
                        {h.forage_index_smoothed !== null && !isNaN(h.forage_index_smoothed) ? `${(h.forage_index_smoothed * 100).toFixed(0)}%` : 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>


      {/* Details — what is behind the number. This was the DETAILS sub-tab;
          it became a panel so the screen could lose a whole navigation bar.
          Ron, 2026-09-08: "Details could just be an information details (i in
          a circle) on the chart". */}
      {showDetails && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center animate-[fade-in_var(--dur-base)_var(--ease-soft)]"
          onClick={() => setShowDetails(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--color-bg)] p-4 shadow-2xl animate-[sheet-in_var(--dur-slow)_var(--ease-soft)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Nectar index details"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black text-[var(--color-text)]">Behind this number</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-divider)] active:scale-95"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
            {/* Today at a Glance */}
            <div
              onClick={() => setExpandToday(!expandToday)}
              className="card p-5 active:scale-[0.99] transition-all duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-[var(--color-primary)] tracking-wider flex items-center gap-2">
                  <Activity size={16} /> Today at a Glance
                </h3>
                <ChevronDown size={16} className={`text-[var(--color-text-muted)] transition-transform duration-300 ${expandToday ? 'rotate-180' : ''}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Nectar Index</span>
                  <span className="text-2xl font-black text-[var(--color-text)]">{forageIndexVal}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Trend</span>
                  <span className={`text-2xl font-black flex items-center gap-1 ${deltaVal > 0.002 ? 'text-[var(--color-good-deep)]' : deltaVal < -0.002 ? 'text-[var(--color-bad)]' : 'text-[var(--color-text)]'}`}>
                    {deltaVal > 0.002 ? <TrendingUp size={20} /> : deltaVal < -0.002 ? <TrendingDown size={20} /> : <Minus size={20} />}
                    {deltaStr}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Greening Rate</span>
                  <span className="text-lg font-extrabold text-[var(--color-text)] mt-0.5">{Math.round(data.v2.rate_norm * 100)}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">Warmth</span>
                  <span className="text-lg font-extrabold text-[var(--color-text)] mt-0.5">{Math.round(data.v2.warmth * 100)}%</span>
                </div>
              </div>
              {expandToday && (
                <div className="mt-5 pt-4 border-t border-[var(--color-divider)] space-y-2 text-xs text-[var(--color-text)] animate-[rise-in_var(--dur-base)_var(--ease-soft)]">
                  {[
                    ['Greenness (NDVI/EVI)', `${Math.round(data.v2.greenness * 100)}%`],
                    ['Vigor (above baseline)', `${Math.round(data.v2.vigor * 100)}%`],
                    ['Moisture (NDWI)', `${Math.round(data.v2.moisture * 100)}%`],
                    ['Rate norm (core signal)', `${Math.round(data.v2.rate_norm * 100)}%`],
                    ['Fall term (photo×dew)', `${Math.round(data.v2.fall_term * 100)}%`],
                    ['Warmth gate (14d temp)', `${Math.round(data.v2.warmth * 100)}%`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between border-b border-[var(--color-divider)] pb-1.5">
                      <span>{label}</span><span className="font-bold text-[var(--color-text)]">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* V2 Index Components (replaces Nectar Drivers) */}
            <div
              onClick={() => setExpandComponents(!expandComponents)}
              className="card p-5 active:scale-[0.99] transition-all duration-150 cursor-pointer select-none"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-divider)] pb-3 mb-4">
                <h3 className="text-sm uppercase font-extrabold text-[var(--color-primary)] tracking-wider flex items-center gap-2">
                  <Sparkles size={16} /> Index Components
                </h3>
                <ChevronDown size={16} className={`text-[var(--color-text-muted)] transition-transform duration-300 ${expandComponents ? 'rotate-180' : ''}`} />
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Greenness',   val: data.v2.greenness,  color: 'bg-emerald-500', tip: 'NDVI/EVI fusion' },
                  { label: 'Moisture',    val: data.v2.moisture,   color: 'bg-sky-500',     tip: 'NDWI canopy water' },
                  { label: 'Rate (core)', val: data.v2.rate_norm,  color: 'bg-[var(--color-primary)]',   tip: 'greening velocity' },
                  { label: 'Fall term',   val: data.v2.fall_term,  color: 'bg-orange-500',  tip: 'photoperiod × dewpoint' },
                  { label: 'Warmth',      val: data.v2.warmth,     color: 'bg-red-500',     tip: '14-day mean temp ramp' },
                ].map(({ label, val, color, tip }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span>{label}</span>
                      <span className="text-[var(--color-primary)]">{Math.round(val * 100)}%</span>
                    </div>
                    <div className="w-full bg-[var(--color-divider)] h-3 rounded-full overflow-hidden border border-[var(--color-card-border)]">
                      <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.round(val * 100)}%` }} />
                    </div>
                    {expandComponents && <p className="text-[10px] text-[var(--color-text-muted)]">{tip}</p>}
                  </div>
                ))}
              </div>
            </div>

            </div>
          </div>
        </div>
      )}

      {/* Enlarged chart modal (copied verbatim from NectarFlowView) */}
      {isEnlarged && (
        <div className="fixed inset-0 z-50 bg-[#07070d] flex flex-col justify-between overflow-hidden">
          <div
            className="portrait:w-[100vh] portrait:h-[100vw] portrait:absolute portrait:top-0 portrait:left-full portrait:origin-top-left portrait:rotate-90 landscape:w-full landscape:h-full flex flex-col p-6 justify-between"
          >
            <div className="flex items-center justify-between w-full border-b border-[#2b2b4d] pb-2.5 mb-2 select-none">
              {/* Title AND key. Full screen used to drop the legend, leaving two
                  coloured lines with nothing saying which year was which — Ron,
                  2026-09-08: the associated information is left behind, "so I
                  would argue it isn't The Chart". */}
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center gap-2 shrink-0">
                  <TrendingUp className="text-[var(--color-primary)]" size={18} />
                  <h3 className="text-sm font-black text-[var(--color-primary)] tracking-wider uppercase truncate">
                    {useAppStore.getState().selectedApiaryName} — Nectar Index Trend
                  </h3>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-[2px] rounded bg-blue-500 inline-block" />{baseYearLabel}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-[2px] rounded bg-[#2ECC71] inline-block" />{currentYear}
                  </span>
                  {data.satellite?.last_image && (
                    <span className="flex items-center gap-1.5">
                      <Satellite size={11} />
                      last image <b className="text-slate-300">{formatSceneDate(data.satellite.last_image)}</b>
                      {data.satellite.next_pass && (
                        <> · next pass <b className="text-slate-300">{formatSceneDate(data.satellite.next_pass)}</b></>
                      )}
                    </span>
                  )}
                </div>
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
                      <span className="font-black text-[var(--color-primary)] text-[10px]">
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
                      {resolvedTrendDirection === 'rising' ? <TrendingUp size={12} className="text-green-400" /> : resolvedTrendDirection === 'falling' ? <TrendingDown size={12} className="text-red-400" /> : <Minus size={12} className="text-slate-500" />}
                      {resolvedTrendDirection ? `${resolvedTrendDirection} trend` : 'Flat trend'}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-500">
                    <div>Nectar: <span className="font-bold text-[var(--color-primary)]">{forageIndexVal}</span></div>
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

    </div>
  );
};
