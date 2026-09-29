// Varroa mite tests — SPEC B §18, FORMULAS §6 (screenshots B33–B35).

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Calendar, Check, Info, Microscope } from 'lucide-react';
import { useApp } from '../../app/store';
import { Spinner } from '../../components/Chrome';
import { EditPencil } from '../../components/EditPencil';
import { noonLocalIso, utcDay } from '../../lib/recordDates';
import { deleteVarroa, listRequeens, listVarroa, saveVarroa, thresholdForDay, type VarroaTest } from '../../lib/records';
import { CHART_W, LABEL_H, PLOT_H, buildVarroaChart } from '../../lib/varroaChart';
import { miteLoad, varroaStatus, type VarroaStatus } from '../../../shared/varroa';
import { FormActions, FormCard, dateInput, notesInput } from './InterventionScreen';
import { RecordTabs, ReturnToHiveBar } from './RecordParts';

const TONE: Record<VarroaStatus, { text: string; border: string; value: string; chip: string; panel: string }> = {
  Critical: { text: 'text-red-600', border: '#EF4444', value: '#DC2626', chip: 'bg-red-100 text-red-600', panel: 'bg-red-50 border-red-200' },
  // White on amber (deliberate change #5: the live app drew amber on amber, screenshot B33).
  'Above Limit': { text: 'text-amber-600', border: '#F59E0B', value: '#A16207', chip: 'bg-primary text-white', panel: 'bg-amber-50 border-amber-200' },
  OK: { text: 'text-green-600', border: '#22C55E', value: '#16A34A', chip: 'bg-green-100 text-green-600', panel: 'bg-green-50 border-green-200' },
};

const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98' viewBox='0 0 56 98'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 32L0 82' fill='none' stroke='%23E99B1A' stroke-opacity='0.12' stroke-width='2'/%3E%3C/svg%3E\")";

const statusOf = (t: Pick<VarroaTest, 'mite_count' | 'bee_count' | 'threshold'>) => varroaStatus(miteLoad(t.mite_count, t.bee_count), t.threshold);

function SeasonChart({ tests, requeens }: { tests: VarroaTest[]; requeens: string[] }) {
  const { columns, colW, anyRequeen } = buildVarroaChart(tests, requeens);
  const legend = 'flex items-center gap-1.5';
  return (
    <div className="card p-4">
      <h3 className="text-sm font-black uppercase tracking-wider text-text-muted">Mite load by season (rolling)</h3>
      <svg viewBox={`0 0 ${CHART_W} ${PLOT_H + LABEL_H}`} className="w-full mt-6 overflow-visible" role="img" aria-label="Mite load by season">
        {columns.map((c, i) => {
          const prev = columns[i - 1];
          return (
            <g key={c.label}>
              <line x1={c.x0} x2={c.x0 + colW} y1={c.thresholdY} y2={c.thresholdY} stroke="#EF4444" strokeOpacity={0.6} strokeWidth={1.2} strokeDasharray="3 3" />
              {prev && prev.thresholdY !== c.thresholdY && <line x1={c.x0} x2={c.x0} y1={prev.thresholdY} y2={c.thresholdY} stroke="#EF4444" strokeOpacity={0.6} strokeWidth={1.2} strokeDasharray="3 3" />}
              {c.requeen && (
                <>
                  <line x1={c.cx} x2={c.cx} y1={5} y2={PLOT_H} stroke="#A855F7" strokeWidth={1.2} strokeDasharray="3 3" />
                  <text x={c.cx} y={PLOT_H + 8} fontSize={8} textAnchor="middle">
                    👑
                  </text>
                </>
              )}
              {c.bar && <rect x={c.bar.x} y={c.bar.y} width={c.bar.w} height={c.bar.h} rx={3} fill={c.bar.fill} />}
              {c.dot && (
                <>
                  <circle cx={c.cx} cy={c.dot.cy} r={4.5} fill={c.dot.colour} stroke="#fff" strokeWidth={1} />
                  <text x={c.cx} y={c.dot.cy - 7} fontSize={8} fontWeight={800} fill={c.dot.colour} textAnchor="middle">
                    {c.dot.label}
                  </text>
                </>
              )}
              <text x={c.cx} y={PLOT_H + 22} fontSize={8} fontWeight={c.current ? 900 : 700} fill={c.current ? '#B45309' : '#78716C'} textAnchor="middle">
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-4 pt-4 border-t border-divider flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm font-bold text-text-muted">
        <span className={legend}>
          <span className="text-red-500 tracking-[-0.1em]">- -</span> Threshold
        </span>
        <span className={legend}>
          <span className="w-3 h-3 rounded-full bg-[#10B981]" /> OK
        </span>
        <span className={legend}>
          <span className="w-3 h-3 rounded-full bg-[#F59E0B]" /> Above Limit
        </span>
        <span className={legend}>
          <span className="w-3 h-3 rounded-full bg-[#EF4444]" /> Critical
        </span>
        {anyRequeen && <span className={legend}>👑 Requeen</span>}
      </div>
    </div>
  );
}

function TestCard({ t, onTap }: { t: VarroaTest; onTap: () => void }) {
  const status = statusOf(t);
  const tone = TONE[status];
  const date = new Date(t.tested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <button type="button" onClick={onTap} className="w-full text-left rounded-[1.75rem] bg-card-bg border-2 shadow-sm pl-5 pr-3 py-4 flex items-center gap-2" style={{ borderColor: tone.border, borderLeftWidth: 6 }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="text-lg font-black text-text whitespace-nowrap">{date}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide truncate ${tone.chip}`}>{status}</span>
        </div>
        <p className="mt-1 text-xs font-bold uppercase text-text-muted space-x-2.5 whitespace-nowrap">
          <span>
            Mites: <b className="text-text">{t.mite_count}</b>
          </span>
          <span>
            Bees: <b className="text-text">{t.bee_count}</b>
          </span>
          <span>
            HBHC limit: <b className="text-text">{t.threshold}%</b>
          </span>
        </p>
        {t.notes && <p className="mt-1 text-sm italic text-text-muted truncate">"{t.notes}"</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xl font-black" style={{ color: tone.value }}>
          {miteLoad(t.mite_count, t.bee_count).toFixed(2)}%
        </p>
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Mite load</p>
      </div>
      <EditPencil />
    </button>
  );
}

function VarroaForm({ test, onDone }: { test: VarroaTest | null; onDone: () => void }) {
  const { state } = useApp();
  const [day, setDay] = useState(() => utcDay(test?.tested_at));
  const [bees, setBees] = useState(String(test?.bee_count ?? 300));
  const [mites, setMites] = useState(String(test?.mite_count ?? 0));
  const [notes, setNotes] = useState(test?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const b = Number(bees) || 0;
  const m = Number(mites) || 0;
  const threshold = thresholdForDay(day);
  const load = miteLoad(m, b);
  const status = varroaStatus(load, threshold);
  const tone = TONE[status];

  const save = async () => {
    if (m < 0) return window.alert('Mites found cannot be negative.');
    if (b <= 0) return window.alert('Bee count must be greater than 0.');
    setBusy(true);
    try {
      await saveVarroa(test?.id ?? null, {
        hive_id: state.selectedHiveId!,
        user_id: state.user!.id,
        tested_at: noonLocalIso(day),
        bee_count: b,
        mite_count: m,
        threshold,
        notes: notes.trim() || null,
      });
      onDone();
    } catch (err) {
      window.alert(`Failed to save mite test: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!test || !window.confirm('Are you sure you want to delete this varroa mite test?')) return;
    setBusy(true);
    try {
      await deleteVarroa(test.id);
      onDone();
    } catch (err) {
      window.alert(`Failed to delete mite test: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  const numberInput = 'w-full h-[52px] rounded-2xl bg-white/70 px-4 text-lg font-bold text-text outline-none focus:ring-4 focus:ring-primary-ring';

  return (
    <div className="space-y-4">
      <FormCard icon={<Calendar size={22} className="text-primary" />} title="Test Date">
        <input type="date" aria-label="Test date" value={day} onChange={e => setDay(e.target.value)} className={dateInput} />
      </FormCard>
      <FormCard icon={<Microscope size={22} className="text-primary" />} title="Sample Findings">
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block mb-2 text-xs font-black uppercase tracking-wider text-text-muted"># of bees</span>
            <input type="number" inputMode="numeric" value={bees} onChange={e => setBees(e.target.value)} className={numberInput} />
          </label>
          <label className="block">
            <span className="block mb-2 text-xs font-black uppercase tracking-wider text-text-muted">Mites found</span>
            <input type="number" inputMode="numeric" value={mites} onChange={e => setMites(e.target.value)} className={numberInput} />
          </label>
        </div>
      </FormCard>
      <div className={`rounded-3xl border-2 px-4 py-4 flex items-start justify-between ${tone.panel}`} aria-live="polite">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-text-muted">Mite load</p>
          <p className="text-3xl font-black" style={{ color: tone.value }}>
            {load.toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-wider text-text-muted">HBHC limit</p>
          <p className="text-2xl font-black text-text">{threshold}%</p>
        </div>
        <p className={`flex items-center gap-1.5 text-lg font-black ${tone.text}`}>
          {status === 'OK' ? <Check size={22} /> : <AlertTriangle size={22} />} {status}
        </p>
      </div>
      <p className="flex gap-2 px-2 text-xs text-text-muted">
        <Info size={14} className="shrink-0 mt-0.5" /> Guidelines recommend maintaining a load below 2–3% depending on season.
      </p>
      <FormCard icon="📝" title="Notes (optional)">
        <textarea aria-label="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Test method (e.g. Alcohol Wash, Powdered Sugar), observations..." className={notesInput} />
      </FormCard>
      <FormActions editing={!!test} busy={busy} onCancel={onDone} onDelete={() => void remove()} onSave={() => void save()} />
    </div>
  );
}

export default function VarroaScreen() {
  const { state, selectRecord } = useApp();
  const hiveId = state.selectedHiveId;
  const rec = state.selectedRecord?.kind === 'varroa' ? (state.selectedRecord as unknown as VarroaTest) : null;
  const [adding, setAdding] = useState(false);
  const [tests, setTests] = useState<VarroaTest[] | null>(null);
  const [requeens, setRequeens] = useState<string[]>([]);

  const reload = useCallback(async () => {
    if (!hiveId) return;
    const [t, r] = await Promise.all([listVarroa(hiveId).catch(() => []), listRequeens(hiveId)]);
    setTests(t);
    setRequeens(r);
  }, [hiveId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const done = () => {
    setAdding(false);
    selectRecord(null);
    void reload();
  };

  return (
    <div className="max-w-2xl mx-auto px-2.5 pt-2 pb-36">
      <RecordTabs active="VARROA_FORM" />
      {adding || rec ? (
        <VarroaForm key={rec?.id ?? 'new'} test={rec} onDone={done} />
      ) : (
        <div className="space-y-5">
          <div className="card px-4 py-5 flex items-center justify-between gap-2" style={{ backgroundImage: HONEYCOMB }}>
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-black text-text whitespace-nowrap">
                <Microscope size={22} className="text-primary shrink-0" /> Varroa Mite Testing
              </h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-text-muted">Honey bee health coalition standards</p>
            </div>
            <button type="button" onClick={() => setAdding(true)} disabled={!hiveId} className="shrink-0 w-[30%] max-w-[200px] min-h-[52px] rounded-full bg-primary px-3 py-2 text-sm text-white font-black shadow-md">
              + Add Mite Test
            </button>
          </div>

          {tests === null ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              {tests.length > 0 && <SeasonChart tests={tests} requeens={requeens} />}
              <div>
                <h3 className="mb-3 px-1 text-sm font-black uppercase tracking-wider text-text-muted">Recorded mite tests</h3>
                {tests.length === 0 ? (
                  <div className="rounded-[1.75rem] border-2 border-dashed border-divider bg-card-bg p-8 text-center text-text-muted">No mite tests recorded for this hive yet.</div>
                ) : (
                  <div className="space-y-3">
                    {tests.map(t => (
                      <TestCard
                        key={t.id}
                        t={t}
                        onTap={() => {
                          window.scrollTo({ top: 0 });
                          selectRecord({ ...t, kind: 'varroa' });
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <ReturnToHiveBar />
        </div>
      )}
    </div>
  );
}
