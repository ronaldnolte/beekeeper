// Readout strip under the chart panel — SPEC C §3.5 (screenshots B07, B10).

import { Satellite, Timer } from 'lucide-react';
import type { ChartModel } from '../../../shared/nectar/chart';
import type { NectarResponse, Phase } from './data';
import { NORMAL_BLUE, PANEL, PHASE_EMOJI, PHASE_LABEL, chipStyle, monDay, monDayOfChartDay, pct, phaseColour } from './style';

export function PhaseChip({ phase, className = '' }: { phase: Phase; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-black ${className}`} style={chipStyle(phase)}>
      <span aria-hidden="true">{PHASE_EMOJI[phase]}</span>
      {PHASE_LABEL[phase]}
    </span>
  );
}

export function SatelliteLine({ satellite }: { satellite: NectarResponse['satellite'] }) {
  if (!satellite?.last_image) return null;
  return (
    <p
      className="flex items-start gap-2 text-[13px] leading-snug"
      style={{ color: '#a3a6c8' }}
      title="Passes are orbital and happen on schedule. Whether one produces usable data depends on cloud cover over your yard."
    >
      <Satellite size={14} className="shrink-0 mt-0.5" />
      <span>
        Satellite: last image <strong className="text-white">{monDay(satellite.last_image)}</strong>
        {satellite.next_pass && (
          <>
            {' '}
            · next pass <strong className="text-white">{monDay(satellite.next_pass)}</strong>
          </>
        )}{' '}
        — <em>usable data depends on cloud cover</em>
      </span>
    </p>
  );
}

export function Legend({ model, current = '(current)' }: { model: ChartModel; current?: string }) {
  return (
    <span className="flex items-center gap-4 text-[15px] text-[#d6d8ee]">
      <span className="flex items-center gap-2">
        <span className="w-4 h-[3px] rounded-full" style={{ background: NORMAL_BLUE }} />
        {model.baseYearLabel}
      </span>
      <span className="flex items-center gap-2">
        <span className="w-4 h-[3px] rounded-full" style={{ background: '#2ECC71' }} />
        {model.currentYear}
        {current ? ` ${current}` : ''}
      </span>
    </span>
  );
}

export function ReadoutStrip({ model, data, hoverDay }: { model: ChartModel; data: NectarResponse; hoverDay: number | null }) {
  // Both states are always rendered in the same grid cell, the inactive one invisible, so the
  // strip keeps the taller height and hovering never changes the page height. (A scrollbar
  // appearing/disappearing shifted the whole page sideways — Ron, 2026-09-27.)
  const hovering = hoverDay != null;
  const day = hoverDay ?? model.current[model.current.length - 1]?.day ?? 0;
  const normal = model.normal.get(day)?.normal;
  const cur = model.current.find(c => c.day === day);
  const phase = cur?.phase as Phase | undefined;
  const layer = { gridArea: "1 / 1" };

  return (
    <div className="grid rounded-2xl px-4 py-3.5 text-xs" style={{ background: PANEL.strip, border: `1px solid ${PANEL.border}` }}>
      <div style={layer} className={hovering ? "invisible" : ""} aria-hidden={hovering}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1 font-mono text-[9px]" style={{ color: "#6b6f95" }}>
              <Timer size={10} /> {__BUILD_TIME__}
            </span>
            <Legend model={model} />
          </div>
          {data.satellite?.last_image ? (
            <SatelliteLine satellite={data.satellite} />
          ) : (
            <p className="text-xs" style={{ color: "#a3a6c8" }}>
              Hover for daily values
            </p>
          )}
        </div>
      </div>
      <div style={layer} className={hovering ? "" : "invisible"} aria-hidden={!hovering} aria-live="polite">
        <p className="text-sm font-black text-white">{monDayOfChartDay(day)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 text-[#c7c9e0]">
          <span>
            {model.baseYearLabel}: <strong style={{ color: "#3b82f6" }}>{pct(normal)}</strong>
          </span>
          <span>
            {model.currentYear}: <strong style={{ color: phase ? phaseColour(phase) : undefined }}>{pct(cur?.value)}</strong>
          </span>
          {phase && <PhaseChip phase={phase} />}
        </div>
      </div>
    </div>
  );
}
