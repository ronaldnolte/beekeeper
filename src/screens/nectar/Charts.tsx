// The three Nectar charts — SPEC C §3.6–3.7, FORMULAS §4. Hand-drawn SVG so the geometry is
// exactly the spec's: same left/right padding everywhere, so all three line up.

import { useId, type PointerEvent } from 'react';
import type { ChartModel } from '../../../shared/nectar/chart';
import { NORMAL_BLUE, PANEL, phaseColour } from './style';

export const PAD_L = 40;
export const PAD_R = 15;
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const xOfDay = (day: number, w: number) => PAD_L + (day / 365) * (w - PAD_L - PAD_R);

/** Pointer x → chart day (uses /364, as the original — FORMULAS §4.4). */
export function dayAtX(clientX: number, rect: DOMRect, w: number): number {
  const x = ((clientX - rect.left) / rect.width) * w;
  return Math.min(364, Math.max(0, Math.round(((x - PAD_L) / (w - PAD_L - PAD_R)) * 364)));
}

interface MainProps {
  model: ChartModel;
  width: number;
  height: number;
  hoverDay: number | null;
  onHover: (day: number | null) => void;
  full?: boolean;
  /** Band kept clear at the top for the number box (Ron, 2026-09-27: the box used to hide the peaks). */
  topInset?: number;
}

export function MainChart({ model, width: W, height: H, hoverDay, onHover, full, topInset = 0 }: MainProps) {
  const gid = useId().replace(/:/g, '');
  const plotW = W - PAD_L - PAD_R;
  const yMax = model.yAxisMax;
  const top = 15 + topInset;
  const y = (v: number) => H - 20 - (v / yMax) * (H - 20 - top);
  const normal = [...model.normal.entries()];
  const cur = model.current;

  if (normal.length <= 1 && cur.length <= 1) {
    return (
      <div style={{ height: H }} className="flex items-center justify-center text-sm" aria-live="polite">
        <span style={{ color: PANEL.label }}>Insufficient history for trend line</span>
      </div>
    );
  }

  const normalPath = normal.map(([d, n], i) => `${i ? 'L' : 'M'}${xOfDay(d, W).toFixed(2)},${y(n.normal).toFixed(2)}`).join('');
  const areaPath = cur.length
    ? `M${xOfDay(cur[0].day, W)},${y(0)}` + cur.map(c => `L${xOfDay(c.day, W).toFixed(2)},${y(c.value).toFixed(2)}`).join('') + `L${xOfDay(cur[cur.length - 1].day, W)},${y(0)}Z`
    : '';
  const last = cur[cur.length - 1];
  const grid = [yMax, yMax * 0.75, yMax * 0.5, yMax * 0.25, 0];

  const move = (e: PointerEvent<SVGSVGElement>) => onHover(dayAtX(e.clientX, e.currentTarget.getBoundingClientRect(), W));
  const hoverNormal = hoverDay == null ? undefined : model.normal.get(hoverDay)?.normal;
  const hoverCurrent = hoverDay == null ? undefined : cur.find(c => c.day === hoverDay);
  const hx = hoverDay == null ? 0 : PAD_L + (hoverDay / 364) * plotW;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ touchAction: 'none', display: 'block' }}
      onPointerMove={move}
      onPointerDown={move}
      onPointerLeave={() => onHover(null)}
      onPointerUp={e => e.pointerType !== 'mouse' && onHover(null)}
      onPointerCancel={() => onHover(null)}
      role="img"
      aria-label="Nectar index this season against the normal"
    >
      <defs>
        <linearGradient id={`area${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2ECC71" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#2ECC71" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Horizontal grid: five labelled lines, the middle one dashed. */}
      {grid.map((v, i) => (
        <g key={i}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke={PANEL.grid} strokeWidth="1" strokeDasharray={i === 2 ? '3 3' : undefined} />
          <text x={PAD_L - 5} y={y(v) + 3} textAnchor="end" fontSize="9" fontWeight="700" fill={PANEL.label}>
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}

      {/* Months at their true day-of-year positions, inside the drawing (SCAR S-NEC-22). */}
      {MONTH_STARTS.map((d, i) => (
        <g key={i}>
          {i > 0 && <line x1={xOfDay(d, W)} x2={xOfDay(d, W)} y1={top} y2={H - 20} stroke={PANEL.grid} strokeWidth="1" opacity="0.6" />}
          <text x={xOfDay(d, W)} y={H - 5} textAnchor={i === 0 ? 'start' : 'middle'} fontSize="9" fontWeight="700" fill={PANEL.label}>
            {MONTHS[i]}
          </text>
        </g>
      ))}

      {areaPath && <path d={areaPath} fill={`url(#area${gid})`} />}
      <path d={normalPath} fill="none" stroke={NORMAL_BLUE} strokeWidth={full ? 2.5 : 1.5} opacity={full ? 1 : 0.8} strokeLinejoin="round" />

      {/* Current year: one segment per day in that day's phase colour. */}
      {cur.slice(1).map((c, i) => (
        <line
          key={c.date}
          x1={xOfDay(cur[i].day, W)}
          y1={y(cur[i].value)}
          x2={xOfDay(c.day, W)}
          y2={y(c.value)}
          stroke={phaseColour(c.phase)}
          strokeWidth={full ? 3 : 2}
          strokeLinecap="round"
        />
      ))}

      {last && (
        <g>
          <circle className="nectar-pulse" cx={xOfDay(last.day, W)} cy={y(last.value)} r="4" fill={phaseColour(last.phase)} />
          <circle cx={xOfDay(last.day, W)} cy={y(last.value)} r="3" fill={phaseColour(last.phase)} />
        </g>
      )}

      {hoverDay != null && (
        <g pointerEvents="none">
          <line x1={hx} x2={hx} y1={top} y2={H - 20} stroke="#9ca3c9" strokeWidth="1" strokeDasharray="3 3" />
          {hoverNormal != null && <circle cx={hx} cy={y(hoverNormal)} r="4.5" fill={NORMAL_BLUE} stroke="#fff" strokeWidth="1.5" />}
          {hoverCurrent && <circle cx={hx} cy={y(hoverCurrent.value)} r="4.5" fill={phaseColour(hoverCurrent.phase)} stroke="#fff" strokeWidth="1.5" />}
        </g>
      )}
    </svg>
  );
}

/** Split a series at zero crossings into same-sign runs (FORMULAS §4.5). */
function signedRuns(points: { x: number; v: number }[]) {
  const runs: { positive: boolean; pts: { x: number; v: number }[] }[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const positive = p.v >= 0;
    const run = runs[runs.length - 1];
    if (!run || run.positive !== positive) {
      if (run) {
        const prev = points[i - 1];
        const denom = Math.abs(prev.v) + Math.abs(p.v);
        const t = Math.abs(prev.v) / (denom || 1);
        const cross = { x: prev.x + (p.x - prev.x) * t, v: 0 };
        run.pts.push(cross);
        runs.push({ positive, pts: [cross, p] });
      } else runs.push({ positive, pts: [p] });
    } else run.pts.push(p);
  }
  return runs;
}

interface SecondaryProps {
  width: number;
  height: number;
  points: { day: number; v: number }[];
  span: number;
  labels: [string, string, string];
  labelColours: [string, string, string];
  fillOpacity: number;
  line?: { colour: string };
}

function SecondaryChart({ width: W, height: H, points, span, labels, labelColours, fillOpacity, line }: SecondaryProps) {
  const top = 8;
  const bottom = H - 8;
  const zero = (top + bottom) / 2;
  const half = (bottom - top) / 2;
  const y = (v: number) => zero - (v / span) * half;
  const pts = points.map(p => ({ x: xOfDay(p.day, W), v: p.v }));
  const runs = signedRuns(pts);
  const last = pts[pts.length - 1];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }} aria-hidden="true">
      {runs.map((r, i) => (
        <path
          key={i}
          d={`M${r.pts[0].x},${zero}` + r.pts.map(p => `L${p.x.toFixed(2)},${y(p.v).toFixed(2)}`).join('') + `L${r.pts[r.pts.length - 1].x},${zero}Z`}
          fill={r.positive ? 'var(--color-good)' : 'var(--color-bad-bright)'}
          opacity={fillOpacity}
        />
      ))}
      <line x1={PAD_L} x2={W - PAD_R} y1={zero} y2={zero} stroke={PANEL.zero} strokeWidth="1" />
      {line && (
        <>
          <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${y(p.v).toFixed(2)}`).join('')} fill="none" stroke={line.colour} strokeWidth="1.6" />
          {last && <circle cx={last.x} cy={y(last.v)} r="3" fill={line.colour} />}
        </>
      )}
      {[top + 4, zero + 3, bottom].map((ly, i) => (
        <text key={i} x={PAD_L - 6} y={ly} textAnchor="end" fontSize="9" fontWeight="800" fill={labelColours[i]}>
          {labels[i]}
        </text>
      ))}
    </svg>
  );
}

export function DifferenceChart({ model, width, height }: { model: ChartModel; width: number; height: number }) {
  if (model.difference.length < 2 || model.differenceSpan == null) return null;
  const span = model.differenceSpan;
  const n = Math.round(100 * span);
  return (
    <SecondaryChart
      width={width}
      height={height}
      points={model.difference.map(d => ({ day: d.day, v: d.difference }))}
      span={span}
      labels={[`+${n}`, '0', `-${n}`]}
      labelColours={['#2ECC71', '#c7c9e0', '#E8695B']}
      fillOpacity={0.45}
    />
  );
}

export function SeasonChart({ model, width, height }: { model: ChartModel; width: number; height: number }) {
  if (model.seasonToDate == null || model.seasonToDateSpan == null) return null;
  const span = model.seasonToDateSpan;
  const colour = model.seasonToDate >= 0 ? '#2ECC71' : '#E8695B';
  return (
    <SecondaryChart
      width={width}
      height={height}
      points={model.difference.map(d => ({ day: d.day, v: d.seasonToDate }))}
      span={span}
      labels={[`+${span}`, '0', `-${span}`]}
      labelColours={['#8b8fb5', '#c7c9e0', '#8b8fb5']}
      fillOpacity={0.35}
      line={{ colour }}
    />
  );
}
