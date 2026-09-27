// Full-screen chart — SPEC C §3.9 (screenshots B11, B12), SCAR S-NEC-24.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minus, TrendingDown, TrendingUp, X } from 'lucide-react';
import type { ChartModel } from '../../../shared/nectar/chart';
import type { NectarResponse, Phase } from './data';
import { DifferenceChart, MainChart, SeasonChart } from './Charts';
import { Legend, PhaseChip, SatelliteLine } from './Readout';
import { PANEL, monDayOfChartDay, pct } from './style';
import { Overlay } from '../../components/Overlay';

/** Ask the browser for real full screen — must run inside the tap (silently ignored if unsupported). */
export function requestBrowserFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    /* unsupported */
  }
}

function exitBrowserFullscreen() {
  const d = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element };
  try {
    if (d.fullscreenElement) void d.exitFullscreen().catch(() => {});
    else if (d.webkitFullscreenElement) d.webkitExitFullscreen?.();
  } catch {
    /* unsupported */
  }
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return vp;
}

export function FullScreen({ apiaryName, data, model, onClose }: { apiaryName: string; data: NectarResponse; model: ChartModel; onClose: () => void }) {
  const vp = useViewport();
  const portrait = vp.h > vp.w;
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [tab, setTab] = useState<'difference' | 'season'>('difference');
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Measure the chart box itself; nothing renders until measured (SCAR S-NEC-23/24).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const close = () => {
    exitBrowserFullscreen();
    setHoverDay(null);
    onClose();
  };

  const width = size ? Math.max(300, size.w - 24) : 0;
  const avail = size ? Math.max(150, size.h - 24 - 27) : 0;
  const mainH = Math.round(avail * 0.55);
  const secondH = avail - mainH;
  const hasSeason = model.seasonToDate != null;
  const showTab = hasSeason ? tab : 'difference';

  const TrendIcon = data.trend_direction === 'rising' ? TrendingUp : data.trend_direction === 'falling' ? TrendingDown : Minus;
  const direction = data.trend_direction.charAt(0).toUpperCase() + data.trend_direction.slice(1);

  // In portrait the whole panel is turned 90° so the chart is always landscape.
  const frame = portrait
    ? { width: vp.h, height: vp.w, transform: `translateX(${vp.w}px) rotate(90deg)`, transformOrigin: 'top left' }
    : { width: vp.w, height: vp.h };

  const hoverNormal = hoverDay == null ? undefined : model.normal.get(hoverDay)?.normal;
  const hoverCur = hoverDay == null ? undefined : model.current.find(c => c.day === hoverDay);
  const cell = 'rounded-xl px-3 py-2 flex-1 min-w-0';
  const cellStyle = { background: '#16162c', border: `1px solid ${PANEL.border}` };

  return (
    <Overlay>
    <div className="fixed inset-0 z-[200] overflow-hidden" style={{ background: '#07070d' }} role="dialog" aria-modal="true" aria-label="Nectar index full screen">
      <div className="absolute top-0 left-0 flex flex-col gap-2 p-4 overflow-y-auto" style={frame}>
        <div className="flex items-center gap-3 pb-2 border-b" style={{ borderColor: PANEL.border }}>
          <TrendIcon size={20} className="text-primary shrink-0" />
          <h2 className="flex-1 min-w-0 truncate font-black uppercase tracking-wider text-primary text-lg">{apiaryName} — Nectar Index Trend</h2>
          <button type="button" onClick={close} aria-label="Close full screen" className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white" style={{ background: '#24243e', border: `1px solid ${PANEL.border}` }}>
            <X size={20} />
          </button>
        </div>

        <div ref={box} className="flex-1 min-h-[200px] rounded-2xl p-3" style={{ background: PANEL.bg, border: `1px solid ${PANEL.border}` }}>
          {size && (
            <>
              <MainChart model={model} width={width} height={mainH} hoverDay={hoverDay} onHover={setHoverDay} full />
              <div className="flex gap-2 h-[27px] items-center">
                {(['difference', 'season'] as const)
                  .filter(t => t === 'difference' || hasSeason)
                  .map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className="h-[24px] px-3 rounded-full text-[10px] font-black uppercase tracking-wider"
                      style={
                        showTab === t
                          ? { background: 'var(--color-primary)', color: '#1a1a2e' }
                          : { background: '#24243e', color: '#c7c9e0', border: `1px solid ${PANEL.border}` }
                      }
                    >
                      {t === 'difference' ? 'Difference from normal' : 'Season to date'}
                    </button>
                  ))}
              </div>
              {showTab === 'difference' ? <DifferenceChart model={model} width={width} height={secondH} /> : <SeasonChart model={model} width={width} height={secondH} />}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1">
          <Legend model={model} current="" />
          <SatelliteLine satellite={data.satellite} />
        </div>

        <div className="rounded-2xl p-2 flex gap-2 items-stretch" style={{ background: PANEL.strip, border: `1px solid ${PANEL.border}` }}>
          {hoverDay != null ? (
            <>
              <div className="px-2 py-1 min-w-[90px]">
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: PANEL.label }}>Calendar day</p>
                <p className="font-black text-white">{monDayOfChartDay(hoverDay)}</p>
              </div>
              <div className={cell} style={cellStyle}>
                <p className="text-[10px] font-black text-white">{model.baseYearLabel} NFI:</p>
                <p className="font-black" style={{ color: '#3b82f6' }}>{pct(hoverNormal)}</p>
              </div>
              <div className={cell} style={cellStyle}>
                <p className="text-[10px] font-black text-white">{model.currentYear} NFI:</p>
                <p className="font-black text-primary">{pct(hoverCur?.value)}</p>
              </div>
              <div className="px-2 py-1">
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: PANEL.label }}>{model.currentYear} phase</p>
                {hoverCur && <PhaseChip phase={hoverCur.phase as Phase} />}
              </div>
            </>
          ) : (
            <>
              <div className="px-2 py-1 min-w-[90px]">
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: PANEL.label }}>Latest status</p>
                <p className="font-black text-white">{direction} trend</p>
              </div>
              <div className={cell} style={cellStyle}>
                <p className="text-white text-sm">Nectar: <strong>{data.nfi}</strong></p>
              </div>
              <div className={cell} style={cellStyle}>
                <p className="text-white text-sm">Rate: <strong>{pct(data.v2.rate_norm)}</strong></p>
              </div>
              <div className={cell} style={cellStyle}>
                <p className="text-white text-sm">Warmth: <strong>{pct(data.v2.warmth)}</strong></p>
              </div>
              <div className="px-2 py-1">
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: PANEL.label }}>Current phase</p>
                <PhaseChip phase={data.phase} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </Overlay>
  );
}
