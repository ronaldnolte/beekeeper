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

function monthlyAvg(history: V2Response['full_history']): { month: string; avg: number; phase: Phase }[] {
  const sums: number[] = new Array(12).fill(0);
  const counts: number[] = new Array(12).fill(0);
  const phases: Phase[][] = Array.from({ length: 12 }, () => []);
  for (const pt of history) {
    const m = parseInt(pt.date.slice(5, 7), 10) - 1;
    sums[m] += pt.forage_index_smoothed;
    counts[m]++;
    phases[m].push(pt.phase);
  }
  return MONTHS.map((month, i) => {
    const avg = counts[i] ? sums[i] / counts[i] : 0;
    // majority phase
    const freq: Partial<Record<Phase, number>> = {};
    for (const p of phases[i]) freq[p] = (freq[p] ?? 0) + 1;
    const majorityPhase = (Object.entries(freq).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] ?? 'TRANSITION') as Phase;
    return { month, avg, phase: majorityPhase };
  });
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

      const apiUrl = import.meta.env.DEV
        ? '/api/nectar-index-v2'
        : 'https://beekeeper.beektools.com/api/nectar-index-v2';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000); // GEE can take ~30s
      try {
        const res = await fetch(`${apiUrl}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`, {
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
  const monthly = monthlyAvg(data.full_history);
  const maxMonthly = Math.max(...monthly.map(m => m.avg), 0.01);

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

      {/* Monthly bar chart */}
      <div className="mx-4 mb-4 bg-[#111128] border border-[#222240] rounded-2xl p-4">
        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3">Season Calendar (monthly avg)</p>
        <div className="flex items-end gap-1 h-20">
          {monthly.map(({ month, avg, phase }) => {
            const barH = maxMonthly > 0 ? Math.max(4, Math.round((avg / maxMonthly) * 72)) : 4;
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{ height: `${barH}px`, backgroundColor: PHASE_COLORS[phase].bar, opacity: 0.85 }}
                />
                <span className="text-[8px] text-slate-500 font-bold">{month}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-3 flex-wrap">
          {(['IN_FLOW', 'FLOW_STARTING', 'FLOW_ENDING', 'DEARTH'] as Phase[]).map(p => (
            <div key={p} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PHASE_COLORS[p].bar }} />
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
