// Forecast (inspection windows) — SPEC C §2, FORMULAS §5 (screenshots B03, B13–B15).

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '../../app/store';
import { resolveApiaryCoords } from '../../lib/location';
import { ApiaryButtonsCard, EmptyApiariesCard } from '../../components/ApiaryPicker';
import { FORECAST_URL, scoreForecast, type InspectionWindow, type OpenMeteoForecast } from '../../../shared/forecast/scoring';
import { CellDetail, ScoringGuide } from './Dialogs';
import { TIER, hourLabel } from './style';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'loaded'; windows: InspectionWindow[] };

export default function ForecastScreen() {
  const { state, selectApiary } = useApp();
  const { apiaries } = state;
  const apiary = apiaries.find(a => a.id === state.selectedApiaryId) ?? null;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [cell, setCell] = useState<InspectionWindow | null>(null);
  const [guide, setGuide] = useState(false);

  // Only one apiary → select it automatically (SCAR S-UI-14).
  useEffect(() => {
    if (!state.selectedApiaryId && apiaries.length === 1) selectApiary(apiaries[0]);
  }, [state.selectedApiaryId, apiaries, selectApiary]);

  useEffect(() => {
    if (!apiary) return;
    const ctl = new AbortController();
    setLoad({ kind: 'loading' });
    (async () => {
      let coords;
      try {
        coords = await resolveApiaryCoords(apiary, ctl.signal);
      } catch (err) {
        if (ctl.signal.aborted) return;
        const msg = (err as Error).message;
        return setLoad({ kind: 'error', message: msg.startsWith('Apiary has no location') ? 'This apiary does not have coordinates. Please edit the apiary to add coordinates.' : msg });
      }
      try {
        // The screen never passes a country, so the model is always gfs_seamless.
        const res = await fetch(FORECAST_URL(coords.lat, coords.lng), { signal: ctl.signal });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as OpenMeteoForecast;
        if (!ctl.signal.aborted) setLoad({ kind: 'loaded', windows: scoreForecast(data) });
      } catch {
        if (!ctl.signal.aborted) setLoad({ kind: 'error', message: 'Failed to load weather data' });
      }
    })();
    return () => ctl.abort();
  }, [apiary]);

  const grid = useMemo(() => {
    if (load.kind !== 'loaded') return null;
    const dates = [...new Set(load.windows.map(w => w.date))].sort();
    let hours = [...new Set(load.windows.map(w => w.hour))].sort((a, b) => a - b);
    const at = new Map(load.windows.map(w => [`${w.date} ${w.hour}`, w]));
    // Trim rows from the bottom while, for every date, the hour is missing or too close to sunset.
    while (hours.length) {
      const h = hours[hours.length - 1];
      const dead = dates.every(d => {
        const w = at.get(`${d} ${h}`);
        return !w || w.issuesV2.some(i => i.toLowerCase().includes('sunset'));
      });
      if (!dead) break;
      hours = hours.slice(0, -1);
    }
    return { dates, hours, at };
  }, [load]);

  const several = apiaries.length > 1;

  return (
    <div className="max-w-2xl mx-auto px-2 pt-4 pb-4">
      <div className="text-center">
        <h2 className="text-2xl font-black text-wood">Hive Forecast</h2>
        {apiary && several ? (
          <div className="relative inline-flex items-center mt-1">
            <select
              aria-label="Apiary"
              value={apiary.id}
              onChange={e => selectApiary(apiaries.find(a => a.id === e.target.value) ?? null)}
              className="appearance-none bg-transparent text-center text-sm font-bold text-text-muted pr-8 pl-2 outline-none"
            >
              {apiaries.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-1 text-text-muted pointer-events-none" />
          </div>
        ) : (
          <p className="mt-1 text-sm font-bold text-text-muted">{apiary ? apiary.name : 'Select Location'}</p>
        )}
      </div>

      <div className="mt-6">
        {apiaries.length === 0 ? (
          <EmptyApiariesCard message="Please create an apiary yard first to view the weather forecast." />
        ) : !apiary ? (
          <ApiaryButtonsCard apiaries={apiaries} subtitle="Choose an apiary to view the 7-day inspection forecast." onPick={selectApiary} />
        ) : load.kind === 'loading' ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-12 h-12 rounded-full border-4 border-wood border-t-transparent animate-spin" role="status" />
            <p className="font-bold text-text-muted animate-pulse">Analyzing meteorological data...</p>
          </div>
        ) : load.kind === 'error' ? (
          <div className="card p-6 text-center">
            <h3 className="text-lg font-black text-bad">Error</h3>
            <p className="mt-2 text-text-muted">{load.message}</p>
          </div>
        ) : (
          grid && (
            <>
              <div className="mx-auto w-fit rounded-3xl bg-white/80 shadow-sm px-5 py-3 text-center">
                <p className="text-[11px] font-black uppercase tracking-wider text-wood">Decision points (0-9)</p>
                <div className="mt-1 flex items-center justify-center gap-3 text-xs font-bold text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-600" /> Optimal 7-9
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Viable 4-6
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Inadvisable 0-3
                  </span>
                </div>
              </div>

              <p className="mt-6 flex items-center justify-center gap-3 text-[13px] font-bold">
                <span className="italic text-text-muted">Tap a cell for details</span>
                <span className="text-text-muted">|</span>
                <button type="button" onClick={() => setGuide(true)} className="text-primary-ink underline decoration-dotted underline-offset-4">
                  How are scores calculated?
                </button>
              </p>

              <div className="mt-5 mx-1 sm:mx-auto max-w-[520px] rounded-2xl bg-white shadow-md overflow-hidden">
                <table className="w-full border-collapse table-fixed">
                  <thead>
                    <tr>
                      <th className="w-[48px] py-3 text-wood font-black text-sm">Time</th>
                      {grid.dates.map(d => (
                        <th key={d} className="py-3 text-center">
                          <span className="block text-sm font-black text-wood leading-tight">
                            <span className="sm:hidden">{WEEKDAYS[weekday(d)].slice(0, 2)}</span>
                            <span className="hidden sm:inline">{WEEKDAYS[weekday(d)]}</span>
                          </span>
                          <span className="block text-[11px] font-medium text-text-muted">
                            {+d.slice(5, 7)}/{+d.slice(8, 10)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.hours.map(h => (
                      <tr key={h}>
                        <td className="text-center text-sm font-bold text-text-muted h-14 border-t border-divider/60">{hourLabel(h)}</td>
                        {grid.dates.map(d => {
                          const w = grid.at.get(`${d} ${h}`);
                          if (!w) return <td key={d} className="bg-bg/60 border border-white" />;
                          const tier = TIER[w.classification];
                          return (
                            <td key={d} className={`${tier.bg} border border-white/70 p-0`}>
                              <button
                                type="button"
                                onClick={() => setCell(w)}
                                aria-label={`${d} ${hourLabel(h)}: ${w.scoreV2} of 9, ${w.classification}`}
                                className={`w-full h-14 font-black text-lg tabular-nums ${w.classification === 'Inadvisable' ? 'text-black' : 'text-white'}`}
                              >
                                {w.scoreV2}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-8 text-center text-xs italic font-medium text-text-muted">White numerals = OK to inspect • Black numerals = Not recommended</p>
            </>
          )
        )}
      </div>

      {cell && <CellDetail w={cell} onClose={() => setCell(null)} />}
      {guide && <ScoringGuide onClose={() => setGuide(false)} />}
    </div>
  );
}
