// Nectar Flow — SPEC C §3 (screenshots B05–B12).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Info, Maximize2, MapPin, Minus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp } from '../../app/store';
import { SelectionList } from '../../components/SelectionList';
import { Spinner } from '../../components/Chrome';
import { apiarySubtitle } from '../../lib/location';
import { buildChartModel } from '../../../shared/nectar/chart';
import { useNectar } from './data';
import { DifferenceChart, MainChart, SeasonChart } from './Charts';
import { ReadoutStrip } from './Readout';
import { DetailsSheet } from './DetailsSheet';
import { FullScreen, requestBrowserFullscreen } from './FullScreen';
import { PANEL, PHASE_LABEL, phaseColour } from './style';

const REVIEW = new URLSearchParams(window.location.search).get('review') === '1';
const NAV_SPACE = 88; // bottom nav pill + its margin
// Deliberate change from the original (Ron, 2026-09-27): the number box sits in its own band
// above the plot instead of covering the top of the chart.
const OVERLAY_BAND = 72;

function useElementWidth() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  // A callback ref re-attaches the observer once the panel exists (SCAR S-NEC-23).
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

function useViewportHeight() {
  const [h, setH] = useState(window.innerHeight);
  useEffect(() => {
    const on = () => setH(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return h;
}

function LoadingCard({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250); // live counter, 4× a second
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-190px)] px-2">
      <div className="card w-full p-12 text-center">
        <Spinner className="w-12 h-12 mx-auto" />
        <h2 className="mt-6 text-lg leading-7 font-bold text-primary-ink">Analyzing satellite imagery…</h2>
        <p className="mt-4 text-[13px] leading-5 text-text-muted">
          Pulling recent satellite and weather data for your apiary and computing the nectar forecast. This usually takes 10–30 seconds, and a little longer the first time each day.
        </p>
        <p className="mt-6 text-2xl font-black text-primary-ink tabular-nums">{Math.floor((now - startedAt) / 1000)}s</p>
      </div>
    </div>
  );
}

export default function NectarScreen() {
  const { state, selectApiary } = useApp();
  const { apiaries } = state;
  const apiary = apiaries.find(a => a.id === state.selectedApiaryId) ?? null;
  const [year, setYear] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [panelRef, panelWidth] = useElementWidth();
  const vh = useViewportHeight();

  // Only one apiary → select it automatically (SCAR S-UI-14).
  useEffect(() => {
    if (!state.selectedApiaryId && apiaries.length === 1) selectApiary(apiaries[0]);
  }, [state.selectedApiaryId, apiaries, selectApiary]);

  const { state: load, reload } = useNectar(apiary, REVIEW ? year : null);
  const model = useMemo(() => (load.kind === 'loaded' ? buildChartModel(load.data.full_history) : null), [load]);

  const refresh = useCallback(() => {
    setHoverDay(null);
    void reload();
  }, [reload]);

  // Picker
  if (!apiary) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-5">
        <h2 className="text-xl font-black text-text">Which yard?</h2>
        <p className="mt-1 text-sm text-text-muted">Nectar Flow reads the landscape around one apiary at a time.</p>
        <div className="mt-8 px-4">
          <SelectionList
            items={apiaries.map(a => ({ id: a.id, title: a.name, subtitle: apiarySubtitle(a) }))}
            icon={MapPin}
            emptyMessage="No apiaries yet. Add one on the Apiaries tab and it will show up here."
            onSelect={item => selectApiary(apiaries.find(a => a.id === item.id) ?? null)}
          />
        </div>
      </div>
    );
  }

  // The live app shows the apiary bar only once a load has finished (screenshot B06).
  const showTopBar = apiaries.length > 1 && load.kind !== 'loading';
  const thisYear = new Date().getFullYear();
  const reviewYears = Array.from({ length: Math.max(0, thisYear - 1 - 2022 + 1) }, (_, i) => thisYear - 1 - i);
  const chartW = Math.max(0, panelWidth);
  const chartH = Math.max(150, vh - 76 - (showTopBar ? 40 : 0) - NAV_SPACE - 505);

  return (
    <div>
      {showTopBar && (
        <div className="bg-white border-b border-divider">
          <div className="max-w-2xl mx-auto h-10 px-4 flex items-center gap-3">
            <MapPin size={16} className="text-primary shrink-0" />
            <div className="relative flex-1 min-w-0 flex items-center gap-2">
              <select
                aria-label="Apiary"
                value={apiary.id}
                onChange={e => {
                  setHoverDay(null);
                  selectApiary(apiaries.find(a => a.id === e.target.value) ?? null);
                }}
                className="appearance-none bg-transparent text-[15px] font-medium text-text outline-none min-w-0 flex-1 truncate pr-2"
              >
                {apiaries.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {load.kind === 'loaded' && (
                <span className="font-mono text-[10px] text-text-muted shrink-0">
                  {load.coords.lat.toFixed(4)}, {load.coords.lng.toFixed(4)}
                </span>
              )}
              <ChevronDown size={16} className="text-text-muted shrink-0 pointer-events-none" />
            </div>
            {REVIEW && (
              <select aria-label="Season" value={year ?? ''} onChange={e => setYear(e.target.value ? +e.target.value : null)} className="bg-transparent text-sm font-bold text-text outline-none">
                <option value="">This season</option>
                {reviewYears.map(y => (
                  <option key={y} value={y}>
                    {y} season
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {load.kind === 'loading' && <LoadingCard startedAt={load.startedAt} />}

        {load.kind === 'error' && (
          <div className="card p-6 text-center mt-8">
            <AlertTriangle size={40} className="mx-auto text-bad" />
            <h2 className="mt-3 text-xl font-black">Fetch failed</h2>
            <p className="mt-2 text-text-muted whitespace-pre-wrap break-words">{load.message}</p>
            <button type="button" onClick={refresh} className="mt-6 w-full h-12 rounded-2xl bg-bad text-white font-black">
              Retry Connection
            </button>
          </div>
        )}

        {load.kind === 'loaded' && model && (
          <>
            {/* The chart panel is dark on purpose. */}
            <div className="relative rounded-2xl p-3" style={{ background: PANEL.bg, border: `1px solid ${PANEL.border}` }}>
              <div ref={panelRef}>
                {chartW > 0 && <MainChart model={model} width={chartW} height={chartH + OVERLAY_BAND} hoverDay={hoverDay} onHover={setHoverDay} topInset={OVERLAY_BAND} />}
              </div>

              <div className="absolute left-3 top-3 pointer-events-none rounded-xl px-3 pt-2.5 pb-2" style={{ background: 'rgba(15,15,32,0.92)', border: `1px solid ${PANEL.border}` }}>
                <p className="flex items-baseline gap-2">
                  <span className="text-[30px] font-black text-white tabular-nums leading-none">{load.data.nfi}</span>
                  <span className="text-[10px] font-black" style={{ color: PANEL.label }}>
                    NFI
                  </span>
                </p>
                <p className="mt-1.5 flex items-center gap-2 leading-5">
                  <span className="font-black" style={{ color: phaseColour(load.data.phase) }}>
                    {PHASE_LABEL[load.data.phase]}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[#d6d8ee]">
                    {load.data.trend_direction === 'rising' ? <TrendingUp size={12} /> : load.data.trend_direction === 'falling' ? <TrendingDown size={12} /> : <Minus size={12} />}
                    {load.data.trend_direction.charAt(0).toUpperCase() + load.data.trend_direction.slice(1)}
                  </span>
                </p>
              </div>

              <div className="absolute right-3 top-3 flex gap-2">
                {(
                  [
                    [RefreshCw, 'Refresh — fetches fresh satellite data, bypassing the cache', refresh],
                    [Info, 'What is behind this number', () => setShowDetails(true)],
                    [
                      Maximize2,
                      'Full screen',
                      () => {
                        requestBrowserFullscreen(); // inside the tap
                        setHoverDay(null);
                        setFullScreen(true);
                      },
                    ],
                  ] as const
                ).map(([Icon, label, onClick]) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={onClick}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ background: '#1a1a33', border: `1px solid ${PANEL.border}` }}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>

              {model.difference.length >= 2 && chartW > 0 && (
                <div className="mt-2 pt-3 border-t" style={{ borderColor: PANEL.border }}>
                  <p className="px-1 text-[11px]">
                    <span className="font-black uppercase tracking-wider" style={{ color: '#a5aad6' }}>
                      Difference from normal
                    </span>
                    <span className="ml-3" style={{ color: PANEL.label }}>
                      {model.currentYear} vs {model.baseYearLabel}
                    </span>
                  </p>
                  <DifferenceChart model={model} width={chartW} height={96} />
                </div>
              )}

              {model.seasonToDate != null && chartW > 0 && (
                <div className="mt-2 pt-3 border-t" style={{ borderColor: PANEL.border }}>
                  <p className="px-1 text-[11px]">
                    <span className="font-black uppercase tracking-wider" style={{ color: '#a5aad6' }}>
                      Season to date
                    </span>
                    <span className="ml-3 font-black" style={{ color: model.seasonToDate >= 0 ? '#2ECC71' : '#E8695B' }}>
                      {model.seasonToDateCaption}
                    </span>
                  </p>
                  <SeasonChart model={model} width={chartW} height={88} />
                </div>
              )}
            </div>

            <div className="mt-3">
              <ReadoutStrip model={model} data={load.data} hoverDay={hoverDay} />
            </div>

            <DetailsSheet open={showDetails} onClose={() => setShowDetails(false)} data={load.data} model={model} />
            {fullScreen && <FullScreen apiaryName={apiary.name} data={load.data} model={model} onClose={() => (setFullScreen(false), setHoverDay(null))} />}
          </>
        )}
      </div>
    </div>
  );
}
