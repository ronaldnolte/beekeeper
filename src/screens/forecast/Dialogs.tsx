// Forecast dialogs — SPEC C §2, APPENDIX-B B1/B2 (screenshot B14).

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import type { InspectionWindow } from '../../../shared/forecast/scoring';
import { TIER, hourLabel } from './style';
import { Overlay } from '../../components/Overlay';

function GlassDialog({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  return (
    <Overlay>
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-quick" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[1.5rem] bg-[#f3f1ee]/90 backdrop-blur-xl border border-white/70 shadow-2xl p-5 animate-sheet-in"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
    </Overlay>
  );
}

function Header({ title, children, onClose }: { title: string; children?: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <h2 className="text-xl leading-7 font-black text-wood">{title}</h2>
        {children}
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-text-muted">
        <X size={26} />
      </button>
    </div>
  );
}

function Tile({ label, value, pts, max, alert }: { label: string; value: string; pts: number; max: number; alert?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white px-3.5 py-3 ${alert ? 'border-2 border-red-500' : 'border-2 border-transparent'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <div className="mt-0.5 flex items-baseline justify-between">
        <span className="text-sm text-text">{value}</span>
        <span className="text-[11px] font-bold text-text-muted">
          {pts}/{max}
        </span>
      </div>
    </div>
  );
}

export function CellDetail({ w, onClose }: { w: InspectionWindow; onClose: () => void }) {
  const longDate = new Date(`${w.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const drop = w.pressureDelta3hr; // positive = falling pressure
  const moderate = drop >= 1.5 && drop < 4.0;
  const deltaColour = drop >= 4.0 ? 'text-red-600' : drop >= 1.5 ? 'text-orange-500' : 'text-blue-600';
  const tier = TIER[w.classification];

  return (
    <GlassDialog onClose={onClose} label="Inspection Window Details">
      <Header title="Inspection Window Details" onClose={onClose}>
        <p className="mt-1 text-sm font-bold uppercase tracking-wide text-text-muted">
          {longDate} <span className="ml-1.5 text-primary-ink">{hourLabel(w.hour)}</span>
        </p>
      </Header>

      <div className={`relative mt-4 rounded-3xl ${tier.bg} py-4 text-center text-white shadow-md overflow-hidden`}>
        <span aria-hidden="true" className="absolute right-3 top-2 text-4xl font-black text-white/10">
          V2
        </span>
        <p className="text-[44px] leading-tight font-black tabular-nums">
          {w.scoreV2} / 9
        </p>
        <p className="text-sm font-black uppercase">{tier.label}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Tile label="Temperature" value={`${Math.round(w.tempF)}°F`} pts={w.breakdownV2.Temperature} max={3} alert={w.tempF < 57 || w.tempF > 92} />
        <Tile label="Time of Day" value={hourLabel(w.hour)} pts={w.breakdownV2['Time of Day']} max={2} />
        <Tile label="Sky Condition" value={w.cloud <= 30 ? 'Sunny' : 'Cloudy'} pts={w.breakdownV2['Sky Condition']} max={2} />
        <Tile label="Wind Speed" value={`${Math.round(w.windMph)}mph`} pts={w.breakdownV2['Wind Speed']} max={2} alert={w.windMph > 18} />
      </div>

      <div className="mt-4 rounded-2xl bg-white px-3.5 py-3 flex justify-between gap-3 text-xs">
        <div>
          <p className="font-bold text-text-muted">Barometric Pressure</p>
          <p className="font-bold text-text">{w.pressureHpa.toFixed(1)} hPa</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-text-muted">3-Hour Delta</p>
          <p className={`font-bold ${deltaColour}`}>
            {drop > 0 ? '↓' : '↑'} {Math.abs(drop).toFixed(1)} hPa/3h
            {moderate && <span className="ml-1">(-2 Penalty)</span>}
          </p>
        </div>
      </div>

      {w.issuesV2.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <p className="flex items-center gap-2 font-black">
            <AlertTriangle size={18} /> Tripped Fail-Safes:
          </p>
          <ul className="mt-1 list-disc pl-6 text-xs font-medium space-y-0.5">
            {w.issuesV2.map(i => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : moderate ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
          Warning: Moderate pressure drop detected (possible storm front approaching). Keep inspection brief!
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-3 py-3 flex items-center gap-2 text-xs font-bold text-green-700">
          <CheckCircle2 size={14} className="shrink-0" /> Fail-safes cleared! Inspection is safe to conduct.
        </div>
      )}
    </GlassDialog>
  );
}

const RULES = [
  ['Temperature', '3 pts', 'Warm weather is safer. Brood chilling is a primary concern.', 'Optimal: 68°F - 85°F (3 pts). Sub-optimal: 58°F - 67°F or 86°F - 91°F (1 pt). Else (0 pts).'],
  ['Time of Day', '2 pts', 'Inspect after the colony wakes up and before foragers return.', 'Optimal: >= 1 hour since temperature hit 55°F AND starts >= 1 hour before sunset (2 pts). Else (0 pts).'],
  ['Sky Condition', '2 pts', 'Sunny, clear weather encourages flight and lowers defensive tempers.', 'Clear / Sunny (< 30% clouds) (2 pts). Partly Cloudy (30% - 70% clouds) (1 pt). Overcast (> 70% clouds) (0 pts).'],
  ['Wind Speed', '2 pts', 'Calm winds preserve hive warmth and prevent flight disruptions.', 'Optimal: < 10mph (2 pts). Sub-optimal: 10 - 15mph (1 pt). Else (0 pts).'],
] as const;

const FAILSAFES = [
  ['Brood Chill Threshold:', 'Temperature < 57°F (14°C) (extreme cold risk)'],
  ['Comb Heat/Heat Stroke:', 'Temperature > 92°F (33°C) (slumping wax risk)'],
  ['Flight Disruption Wind:', 'Wind speed > 18mph (colony aggression risk)'],
  ['Active Precipitation:', 'Raining, stormy, or precipitation chance ≥ 50%'],
  ['Severe Storm Plunge:', '3-hour barometric pressure drop ≥ 4.0 hPa (severe front approaching)'],
  ['Wake-up Temperature:', 'Must be at least 1 hour since temperature crossed ≥ 55°F (colony activity wake-up buffer)'],
  ['Sunset Safety Buffer:', 'Inspection must start at least 1 hour before daily sunset (allows foragers to safely return to hive)'],
] as const;

/** Deliberate change #22 (Ron, 2026-09-29): the guide now says a failed check turns the cell red; the live text claimed points were set to 0, which the grid never did. */
export function ScoringGuide({ onClose }: { onClose: () => void }) {
  return (
    <GlassDialog onClose={onClose} label="How Scores are Calculated">
      <Header title="How Scores are Calculated" onClose={onClose}>
        <p className="mt-1 text-[11px] font-black uppercase tracking-wider text-text-muted">Optimal conditions for hive inspections</p>
      </Header>
      <p className="mt-4 text-xs text-text-muted leading-relaxed">
        The V2 suitability score (0-9) is calculated using a weighted points scoring matrix. High scores indicate ideal conditions for opening the hive with minimal stress to the colony.
      </p>

      <p className="mt-5 text-xs font-black uppercase tracking-wider text-wood">Weighted points matrix</p>
      <div className="mt-2 space-y-2">
        {RULES.map(([label, pts, desc, detail]) => (
          <div key={label} className="rounded-2xl bg-white p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-text">{label}</span>
              <span className="rounded-full bg-primary-wash px-2.5 py-0.5 text-xs font-black text-primary-ink">{pts}</span>
            </div>
            <p className="mt-1 text-xs text-text-muted">{desc}</p>
            <p className="mt-1.5 font-mono text-[10px] text-text">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-red-800">
        <p className="text-sm font-black">Safety Fail-Safes (Forces Red Cell Abort)</p>
        <p className="mt-1 text-xs">
          If any of these conditions is true, the cell turns <strong>red (Inadvisable)</strong>. It still shows the points it scored, so you can see how close it came:
        </p>
        <ul className="mt-2 list-disc pl-5 text-xs space-y-1">
          {FAILSAFES.map(([name, text]) => (
            <li key={name}>
              <strong>{name}</strong> {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3.5 text-blue-900">
        <p className="text-sm font-black">Storm Front Tracking</p>
        {/* The literal asterisks are shown on screen today (not rendered as Markdown). */}
        <p className="mt-1 text-xs">
          A moderate 3-hour pressure drop (between 1.5 and 4.0 hPa) does not completely abort the inspection, but it applies a **-2 point penalty** to reflect the approaching weather disturbance.
        </p>
      </div>

      <button type="button" onClick={onClose} className="mt-5 w-full h-12 rounded-2xl bg-wood text-white font-black">
        Got it!
      </button>
    </GlassDialog>
  );
}
