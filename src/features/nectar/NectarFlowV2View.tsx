import React, { useEffect, useState, useCallback } from 'react';
import { Leaf, RefreshCw, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';

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

const PHASE_COLORS: Record<Phase, { bg: string; text: string; bar: string; label: string }> = {
  IN_FLOW:       { bg: 'bg-emerald-500/20',  text: 'text-emerald-400',  bar: '#22c55e', label: 'Peak Flow' },
  FLOW_STARTING: { bg: 'bg-yellow-500/20',   text: 'text-yellow-400',   bar: '#eab308', label: 'Flow Building' },
  FLOW_ENDING:   { bg: 'bg-orange-500/20',   text: 'text-orange-400',   bar: '#f97316', label: 'Flow Ending' },
  DEARTH:        { bg: 'bg-red-500/20',      text: 'text-red-400',      bar: '#ef4444', label: 'Dearth' },
  TRANSITION:    { bg: 'bg-slate-700/40',    text: 'text-slate-300',    bar: '#64748b', label: 'Transitional' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function NectarTrendChart({ history }: { history: V2Response['full_history'] }) {
  // Last 12 months
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const pts = history.filter(p => p.date >= cutoffStr);
  if (pts.length < 2) return <p className="text-slate-600 text-xs text-center py-4">Not enough history</p>;

  const VB_W = 400, VB_H = 120;
  const PL = 26, PR = 8, PT = 6, PB = 20;
  const cW = VB_W - PL - PR, cH = VB_H - PT - PB;

  const t0 = new Date(pts[0].date + 'T00:00').getTime();
  const t1 = new Date(pts[pts.length - 1].date + 'T00:00').getTime();
  const tSpan = t1 - t0 || 1;

  const toX = (d: string) => PL + ((new Date(d + 'T00:00').getTime() - t0) / tSpan) * cW;
  const toY = (v: number) => PT + (1 - v) * cH;

  // Split into phase-colored segments — each run of same phase = one <path>
  type Seg = { d: string; color: string };
  const segments: Seg[] = [];
  let i = 0;
  while (i < pts.length) {
    const phase = pts[i].phase;
    const color = PHASE_COLORS[phase].bar;
    let j = i;
    while (j < pts.length && pts[j].phase === phase) j++;
    // Include one overlap point so segments connect visually
    const slice = pts.slice(i, Math.min(j + 1, pts.length));
    const d = slice.map((p, k) =>
      `${k === 0 ? 'M' : 'L'}${toX(p.date).toFixed(1)},${toY(p.forage_index_smoothed).toFixed(1)}`
    ).join(' ');
    segments.push({ d, color });
    i = j;
  }

  // One label per month that falls in range
  const seen = new Set<string>();
  const monthLabels: { x: number; label: string }[] = [];
  for (const p of pts) {
    const ym = p.date.slice(0, 7);
    if (!seen.has(ym)) {
      seen.add(ym);
      monthLabels.push({ x: toX(p.date), label: MONTHS[parseInt(p.date.slice(5, 7), 10) - 1] });
    }
  }

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ display: 'block' }}>
      {/* Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <g key={v}>
          <line x1={PL} y1={toY(v)} x2={VB_W - PR} y2={toY(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={PL - 3} y={toY(v) + 3} fontSize="8" fill="#475569" textAnchor="end">{Math.round(v * 100)}</text>
        </g>
      ))}
      {/* Phase-colored line segments */}
      {segments.map((seg, idx) => (
        <path key={idx} d={seg.d} stroke={seg.color} strokeWidth="2.5" fill="none"
          strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* Month labels */}
      {monthLabels.map(({ x, label }) => (
        <text key={label + x} x={x} y={VB_H - 4} fontSize="8" fill="#475569" textAnchor="middle">{label}</text>
      ))}
    </svg>
  );
}

function ApiarySelector() {
  const { apiariesList, selectedApiaryId } = useAppStore();
  if (!apiariesList || apiariesList.length <= 1) return null;
  return (
    <div className="relative w-full mb-4">
      <select
        className="w-full bg-[#1a1a2e] border border-[#2a2a4a] text-white text-sm rounded-xl px-3 py-2 appearance-none pr-8"
        value={selectedApiaryId ?? ''}
        onChange={e => useAppStore.setState({ selectedApiaryId: e.target.value })}
      >
        {apiariesList.map((a: any) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

export const NectarFlowV2View: React.FC = () => {
  const { selectedApiaryId, apiariesList } = useAppStore();
  const [data, setData] = useState<V2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Auto-select single apiary
  useEffect(() => {
    if (!selectedApiaryId && apiariesList?.length === 1) {
      useAppStore.setState({ selectedApiaryId: apiariesList[0].id });
    }
  }, [selectedApiaryId, apiariesList]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const apiary = await fetchApiaryWithCoords(id);
      const { lat, lng } = apiary;
      if (lat == null || lng == null) throw new Error('Apiary coordinates are missing. Please edit the apiary first.');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000); // GEE can take ~30s
      try {
        const res = await fetch(`/api/nectar-index-v2?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `API error ${res.status}`);
        }
        setData(await res.json());
      } finally {
        clearTimeout(timeout);
      }
    } catch (e: any) {
      setError(e.name === 'AbortError' ? 'Request timed out. Earth Engine can take up to 60s.' : e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedApiaryId) load(selectedApiaryId);
  }, [selectedApiaryId, load]);

  // --- No apiary selected ---
  if (!selectedApiaryId) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 bg-[#0a0a14]">
        <ApiarySelector />
        <p className="text-slate-400 text-sm text-center">Select an apiary to view the nectar index.</p>
      </div>
    );
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center gap-4 bg-[#0a0a14] text-white">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Fetching satellite + weather data…</p>
        <p className="text-slate-600 text-xs">Earth Engine queries can take 20–40s</p>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center gap-4 p-6 bg-[#0a0a14] text-white">
        <ApiarySelector />
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 w-full max-w-sm text-center">
          <p className="text-red-400 text-sm font-medium">{error}</p>
        </div>
        <button
          onClick={() => load(selectedApiaryId)}
          className="flex items-center gap-2 bg-[#1a1a2e] border border-[#2a2a4a] text-slate-300 text-sm rounded-xl px-4 py-2 hover:bg-[#2a2a4a] transition-colors"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const colors = PHASE_COLORS[data.phase];
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  const trendIcon = data.trend_direction === 'rising' ? '↑' : data.trend_direction === 'falling' ? '↓' : '→';
  const trendColor = data.trend_direction === 'rising' ? 'text-green-400' : data.trend_direction === 'falling' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="w-full flex-1 overflow-y-auto flex flex-col bg-[#0a0a14] text-white">
      {/* Apiary selector */}
      <div className="px-4 pt-4">
        <ApiarySelector />
      </div>

      {/* Status banner */}
      <div className={`mx-4 mb-4 rounded-2xl p-5 ${colors.bg} border border-white/5`}>
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-bold uppercase tracking-widest ${colors.text}`}>
            {colors.label}
          </span>
          <button
            onClick={() => load(selectedApiaryId)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex items-end gap-3 mt-2">
          <span className="text-5xl font-black">{data.nfi}</span>
          <div className="flex flex-col mb-1">
            <span className="text-slate-400 text-xs font-semibold">/ 100</span>
            <span className={`text-sm font-bold ${trendColor}`}>{trendIcon} {data.trend_direction}</span>
          </div>
          <div className="ml-auto">
            <Leaf size={28} className={colors.text} />
          </div>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed mt-3">{data.transitionAdvice}</p>
      </div>

      {/* 12-month NFI trend line */}
      <div className="mx-4 mb-4 bg-[#111128] border border-[#222240] rounded-2xl p-4">
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3">12-Month Nectar Trend</p>
        <NectarTrendChart history={data.full_history} />
        <div className="flex gap-3 mt-3 flex-wrap">
          {(['IN_FLOW', 'FLOW_STARTING', 'FLOW_ENDING', 'DEARTH', 'TRANSITION'] as Phase[]).map(p => (
            <div key={p} className="flex items-center gap-1">
              <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: PHASE_COLORS[p].bar }} />
              <span className="text-[9px] text-slate-500 font-medium">{PHASE_COLORS[p].label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* V2 breakdown (collapsible) */}
      <div className="mx-4 mb-6 bg-[#111128] border border-[#222240] rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          onClick={() => setShowBreakdown(b => !b)}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">V2 Index Components</span>
          <ChevronDown size={14} className={`text-slate-500 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
        </button>
        {showBreakdown && (
          <div className="px-4 pb-4 space-y-2 border-t border-[#222240]">
            {[
              { label: 'Greenness', value: data.v2.greenness, tip: 'NDVI/EVI fusion' },
              { label: 'Vigor', value: data.v2.vigor, tip: 'above winter baseline' },
              { label: 'Moisture mod', value: data.v2.moisture, tip: 'NDWI canopy water' },
              { label: 'Rate (core)', value: data.v2.rate_norm, tip: 'greening velocity' },
              { label: 'Fall term', value: data.v2.fall_term, tip: 'photoperiod × dewpoint' },
              { label: 'Warmth gate', value: data.v2.warmth, tip: '14-day mean temp ramp' },
            ].map(({ label, value, tip }) => (
              <div key={label} className="flex items-center gap-2 mt-2">
                <div className="w-24 shrink-0">
                  <p className="text-[10px] font-bold text-slate-300">{label}</p>
                  <p className="text-[9px] text-slate-600">{tip}</p>
                </div>
                <div className="flex-1 bg-[#1a1a2e] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-amber-400/70 rounded-full transition-all"
                    style={{ width: `${Math.round(value * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 w-8 text-right font-mono">{pct(value)}</span>
              </div>
            ))}
            <p className="text-[9px] text-slate-600 pt-2">
              index = rate_norm × warmth + fall_term × wFall. Params: alpha=0.18, rateLag=24d, dpLo=45°F, dpHi=55°F, wFall=0.7.
            </p>
          </div>
        )}
      </div>

      {/* V2 label */}
      <div className="pb-4 text-center">
        <span className="text-[9px] text-slate-700 font-semibold uppercase tracking-widest">
          Nectar Flow V2 · tester preview
        </span>
      </div>
    </div>
  );
};
