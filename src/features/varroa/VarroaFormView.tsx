import React, { useState, useEffect } from 'react';
import { 
  fetchVarroaTests, 
  createVarroaTest, 
  updateVarroaTest, 
  deleteVarroaTest 
} from '../../data/varroaRepository';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2, Microscope, Hexagon, Check, AlertTriangle, Info, Calendar } from 'lucide-react';
import { SubTabBar } from '../../shared/components/SubTabBar';
import { supabase } from '../../data/supabase';

// HBHC Monthly Thresholds
export function getHBHCThreshold(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  // Jan(0), Feb(1), Mar(2) → 1%
  if (month <= 2) return 1;
  // Apr(3), May(4) → 3%
  if (month <= 4) return 3;
  // Jun(5), Jul(6), Aug(7) → 3%
  if (month <= 7) return 3;
  // Sep(8), Oct(9) → 2%
  if (month <= 9) return 2;
  // Nov(10), Dec(11) → 1%
  return 1;
}

function getStatusInfo(pct: number, threshold: number) {
  if (pct >= threshold * 1.5) {
    return {
      label: 'Critical',
      color: 'text-red-600 dark:text-red-400',
      border: 'border-red-500/30',
      bg: 'bg-red-50/70 dark:bg-red-950/20',
      icon: <AlertTriangle size={20} className="text-red-500" />
    };
  }
  if (pct >= threshold) {
    return {
      label: 'Above Limit',
      color: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-50/70 dark:bg-amber-950/20',
      icon: <AlertTriangle size={20} className="text-amber-500" />
    };
  }
  return {
    label: 'OK',
    color: 'text-green-600 dark:text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-50/70 dark:bg-green-950/20',
    icon: <Check size={20} className="text-green-500" />
  };
}

export const VarroaFormView: React.FC = () => {
  const { selectedHiveId, selectedRecord, user, goBack, selectInspection } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [tests, setTests] = useState<any[]>([]);
  const [requeenDates, setRequeenDates] = useState<Date[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(!!selectedRecord);
  const [refreshKey, setRefreshKey] = useState(0);

  // Form Fields
  const [date, setDate] = useState(() => {
    if (selectedRecord?.tested_at) {
      return new Date(selectedRecord.tested_at).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [beeCount, setBeeCount] = useState(selectedRecord?.bee_count ?? 300);
  const [miteCount, setMiteCount] = useState(selectedRecord?.mite_count ?? 0);
  const [notes, setNotes] = useState(selectedRecord?.notes || '');

  // Calculate live variables
  const threshold = getHBHCThreshold(new Date(date + 'T12:00:00'));
  const mitePct = beeCount > 0 ? (miteCount / beeCount) * 100 : 0;
  const status = getStatusInfo(mitePct, threshold);

  // Load history
  useEffect(() => {
    const loadVarroaData = async () => {
      if (!selectedHiveId) return;
      setLoading(true);
      try {
        const testData = await fetchVarroaTests(selectedHiveId);
        setTests(testData);

        // Fetch requeen dates for charting correlation
        const { data: requeenInterventions } = await supabase
          .from('interventions')
          .select('timestamp')
          .eq('hive_id', selectedHiveId)
          .eq('type', 'requeen')
          .order('timestamp', { ascending: true });

        if (requeenInterventions) {
          setRequeenDates(requeenInterventions.map((r: any) => new Date(r.timestamp)));
        }
      } catch (e) {
        console.error('Failed to load varroa data', e);
      } finally {
        setLoading(false);
      }
    };

    loadVarroaData();
  }, [selectedHiveId, refreshKey, isFormOpen]);

  // Sync state if active selected record changes (e.g. from history timelines)
  useEffect(() => {
    if (selectedRecord && selectedRecord._model_type === 'varroa_test') {
      setIsFormOpen(true);
      setDate(new Date(selectedRecord.tested_at).toISOString().split('T')[0]);
      setBeeCount(selectedRecord.bee_count ?? 300);
      setMiteCount(selectedRecord.mite_count ?? 0);
      setNotes(selectedRecord.notes || '');
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setBeeCount(300);
      setMiteCount(0);
      setNotes('');
    }
  }, [selectedRecord]);

  const handleSave = async () => {
    if (!selectedHiveId || !user) return;
    if (miteCount < 0) return alert('Mites found cannot be negative.');
    if (beeCount <= 0) return alert('Bee count must be greater than 0.');

    setLoading(true);
    const payload = {
      hive_id: selectedHiveId,
      user_id: user.id,
      tested_at: new Date(date + 'T12:00:00').toISOString(),
      bee_count: beeCount,
      mite_count: miteCount,
      threshold: threshold,
      notes: notes || null
    };

    let error;
    try {
      if (selectedRecord && selectedRecord._model_type === 'varroa_test') {
        await updateVarroaTest(selectedRecord.id, payload);
      } else {
        await createVarroaTest(payload);
      }
    } catch (e: any) {
      error = e;
    }

    setLoading(false);

    if (error) {
      alert('Failed to save mite test: ' + error.message);
    } else {
      selectInspection(null);
      setIsFormOpen(false);
      setRefreshKey(p => p + 1);
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    if (!confirm('Are you sure you want to delete this varroa mite test?')) return;

    setLoading(true);
    try {
      await deleteVarroaTest(selectedRecord.id);
      setLoading(false);
      selectInspection(null);
      setIsFormOpen(false);
      setRefreshKey(p => p + 1);
    } catch (e: any) {
      setLoading(false);
      alert('Failed to delete mite test: ' + e.message);
    }
  };

  const honeycombBgStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='hexagons' fill='%23E99B1A' fill-opacity='0.08' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
  };

  if (!isFormOpen) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-3 sm:p-4 space-y-4">
          <SubTabBar activeView="VARROA_FORM" />

          {/* Premium Tab Header Card with Honeycomb Pattern */}
          <div className="w-full max-w-2xl card p-4 relative overflow-hidden" style={honeycombBgStyle}>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[var(--color-text)] flex items-center gap-2">
                  <Microscope size={22} className="text-[var(--color-primary-dark)]" />
                  Varroa Mite Testing
                </h2>
                <p className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
                  Honey Bee Health Coalition Standards
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-[var(--color-primary)] text-white px-4 py-2.5 rounded-full font-black text-xs transition-transform active:scale-95 hover:bg-[var(--color-primary-dark)] shadow-sm cursor-pointer select-none"
              >
                + Add Mite Test
              </button>
            </div>
          </div>

          {/* Seasonal Mite Load SVG Chart */}
          {tests.length > 0 && (() => {
            const HBHC_PERIODS = [
              { label: 'Jan–Feb', months: [0, 1], threshold: 1 },
              { label: 'Mar', months: [2], threshold: 1 },
              { label: 'Apr–May', months: [3, 4], threshold: 3 },
              { label: 'Jun–Aug', months: [5, 6, 7], threshold: 3 },
              { label: 'Sep–Oct', months: [8, 9], threshold: 2 },
              { label: 'Nov–Dec', months: [10, 11], threshold: 1 },
            ];

            // Rolling last 6 periods timeline ending at current month
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentPeriodIdx = HBHC_PERIODS.findIndex(p => p.months.includes(currentMonth));
            const orderedPeriods: any[] = [];
            for (let i = 5; i >= 0; i--) {
              const idx = (currentPeriodIdx - i + 6) % 6;
              orderedPeriods.push(HBHC_PERIODS[idx]);
            }

            // Aggregate tests into periods
            const periodData = orderedPeriods.map(period => {
              const periodTests = tests.filter(t => {
                const m = new Date(t.tested_at).getMonth();
                return period.months.includes(m);
              });
              if (periodTests.length === 0) return { ...period, tests: [], min: 0, max: 0, latest: 0 };
              const pcts = periodTests.map(t => Number(t.mite_pct));
              const sorted = [...periodTests].sort((a, b) => new Date(b.tested_at).getTime() - new Date(a.tested_at).getTime());
              return {
                ...period,
                tests: periodTests,
                min: Math.min(...pcts),
                max: Math.max(...pcts),
                latest: Number(sorted[0].mite_pct),
              };
            });

            // Dimensions & Scales
            const chartHeight = 85;
            const chartWidth = 260;
            const barWidth = 14;
            const maxVal = Math.max(
              ...periodData.map(p => p.max),
              ...periodData.map(p => p.threshold),
              4 // bottom bound
            ) * 1.25;

            const colWidth = chartWidth / 6;

            // Requeens correlation check
            const displayedMonths = orderedPeriods.flatMap(p => p.months);
            const relevantRequeens = requeenDates.filter(d => displayedMonths.includes(d.getMonth()));

            return (
              <div className="w-full max-w-2xl card p-4 flex flex-col">
                <div className="text-[11px] font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                  Mite Load By Season (Rolling)
                </div>
                <div className="w-full overflow-x-hidden flex justify-center">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 25}`} className="w-full max-w-lg" style={{ height: '140px' }} preserveAspectRatio="xMidYMid meet">
                    {/* Stepped threshold line representing HBHC seasonal standards */}
                    {periodData.map((p, i) => {
                      const x1 = i * colWidth;
                      const x2 = (i + 1) * colWidth;
                      const y = chartHeight - (p.threshold / maxVal) * chartHeight;
                      return (
                        <line
                          key={`thresh-${i}`}
                          x1={x1} y1={y} x2={x2} y2={y}
                          stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3,3" opacity={0.6}
                        />
                      );
                    })}
                    {/* Step connectors */}
                    {periodData.slice(0, -1).map((p, i) => {
                      const nextP = periodData[i + 1];
                      if (p.threshold === nextP.threshold) return null;
                      const x = (i + 1) * colWidth;
                      const y1 = chartHeight - (p.threshold / maxVal) * chartHeight;
                      const y2 = chartHeight - (nextP.threshold / maxVal) * chartHeight;
                      return (
                        <line
                          key={`step-${i}`}
                          x1={x} y1={y1} x2={x} y2={y2}
                          stroke="#EF4444" strokeWidth="1.2" strokeDasharray="2,2" opacity={0.4}
                        />
                      );
                    })}

                    {/* Requeen markers */}
                    {relevantRequeens.map((d, ri) => {
                      const m = d.getMonth();
                      const periodIdx = orderedPeriods.findIndex(p => p.months.includes(m));
                      if (periodIdx < 0) return null;
                      const x = (periodIdx + 0.5) * colWidth;
                      return (
                        <g key={`rq-${ri}`}>
                          <line x1={x} y1={5} x2={x} y2={chartHeight} stroke="#A855F7" strokeWidth="1.5" strokeDasharray="3,2" opacity={0.7} />
                          <text x={x} y={chartHeight + 22} textAnchor="middle" fontSize="9">👑</text>
                        </g>
                      );
                    })}

                    {/* Range bars + latest load point */}
                    {periodData.map((p, i) => {
                      const cx = (i + 0.5) * colWidth;
                      if (p.tests.length === 0) return null;

                      const yMin = chartHeight - (p.min / maxVal) * chartHeight;
                      const yMax = chartHeight - (p.max / maxVal) * chartHeight;
                      const yLatest = chartHeight - (p.latest / maxVal) * chartHeight;
                      const aboveThreshold = p.latest >= p.threshold;
                      
                      const barColor = aboveThreshold ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
                      const dotColor = p.latest >= p.threshold * 1.5 ? '#EF4444' : aboveThreshold ? '#F59E0B' : '#10B981';

                      return (
                        <g key={`bar-${i}`}>
                          {/* Range bar (if more than 1 test recorded this season) */}
                          {p.tests.length > 1 && (
                            <rect
                              x={cx - barWidth / 2}
                              y={yMax}
                              width={barWidth}
                              height={Math.max(yMin - yMax, 3)}
                              rx={3}
                              fill={barColor}
                              stroke={aboveThreshold ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}
                              strokeWidth="0.5"
                            />
                          )}
                          {/* Latest test dot */}
                          <circle
                            cx={cx} cy={yLatest} r={4.5}
                            fill={dotColor}
                            stroke="white" strokeWidth="1.5"
                            className="shadow-sm"
                          />
                          {/* Value percentage label */}
                          <text
                            x={cx} y={yLatest - 7}
                            textAnchor="middle" fontSize="8.5" fontWeight="900"
                            fill={dotColor}
                          >
                            {p.latest.toFixed(1)}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Period timeline labels */}
                    {periodData.map((p, i) => {
                      const cx = (i + 0.5) * colWidth;
                      const isCurrent = i === 5;
                      return (
                        <text
                          key={`label-${i}`}
                          x={cx} y={chartHeight + 12}
                          textAnchor="middle" fontSize="8.5"
                          className={`fill-[var(--color-text-muted)] ${isCurrent ? 'font-black fill-[var(--color-primary-dark)]' : 'font-bold'}`}
                        >
                          {p.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
                {/* SVG Graph Legend */}
                <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-[var(--color-text-muted)] mt-2 pt-2 border-t border-[var(--color-divider)]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-4 h-0 border-t-2 border-dashed border-red-500/80"></span> Threshold
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10B981]"></span> OK
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F59E0B]"></span> Above Limit
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#EF4444]"></span> Critical
                  </span>
                  {relevantRequeens.length > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-4 h-0 border-t-2 border-dashed border-purple-500"></span> 👑 Requeen
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Historical Mite Test List & Table */}
          <div className="w-full max-w-2xl flex flex-col space-y-2">
            <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-1">Recorded Mite Tests</h3>
            {tests.length === 0 ? (
              <div className="card p-8 text-center border-dashed border-2 border-[var(--color-card-border)]">
                <p className="text-[var(--color-text-muted)] font-medium">No mite tests recorded for this hive yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {tests.map(test => {
                  const dateObj = new Date(test.tested_at);
                  const pct = Number(test.mite_pct);
                  const thresh = Number(test.threshold);
                  const statusInfo = getStatusInfo(pct, thresh);

                  return (
                    <div
                      key={test.id}
                      onClick={() => {
                        selectInspection(test);
                        setIsFormOpen(true);
                      }}
                      className={`card p-3.5 border-l-4 transition-all duration-200 cursor-pointer active:scale-98 flex items-center justify-between ${
                        pct >= thresh * 1.5 ? 'border-red-500/80 hover:border-red-400' :
                        pct >= thresh ? 'border-amber-500/80 hover:border-amber-400' :
                        'border-green-500/80 hover:border-green-400'
                      }`}
                    >
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-[var(--color-text)]">
                            {dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            pct >= thresh * 1.5 ? 'bg-red-500/10 text-red-500' :
                            pct >= thresh ? 'bg-amber-500/10 text-amber-500' :
                            'bg-green-500/10 text-green-500'
                          }`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-x-3.5 text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wide">
                          <span>Mites: <strong className="text-[var(--color-text)]">{test.mite_count}</strong></span>
                          <span>Bees: <strong className="text-[var(--color-text)]">{test.bee_count}</strong></span>
                          <span>HBHC Limit: <strong className="text-[var(--color-text)]">{thresh}%</strong></span>
                        </div>
                        {test.notes && (
                          <p className="text-xs text-[var(--color-text-muted)] line-clamp-1 italic mt-1">
                            "{test.notes}"
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className={`text-base font-black ${statusInfo.color}`}>
                          {pct.toFixed(2)}%
                        </span>
                        <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">Mite Load</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Segregated Bottom Action Bar — Return to Hive */}
        <div className="w-full flex-shrink-0 flex justify-center gap-3 p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 dark:bg-black/55 dark:border-white/10 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button 
            onClick={goBack}
            className="flex-1 max-w-md bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-3.5 rounded-full font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm dark:bg-black/30 dark:border-white/10 dark:text-white"
          >
            <Hexagon size={20} />
            Return to Hive Details
          </button>
        </div>
      </div>
    );
  }

  // --- THE RECORD/EDIT FORM VIEW STATE ---
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      
      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-3 sm:p-4 space-y-4 pb-28">
        <SubTabBar activeView="VARROA_FORM" />

        {/* Test Date card */}
        <div className="w-full max-w-2xl card p-4">
          <h3 className="text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
            <Calendar size={18} className="text-[var(--color-primary-dark)]" /> Test Date
          </h3>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full h-12 px-4 py-0 block rounded-xl bg-[var(--color-input-bg)] text-[var(--color-primary)] font-bold text-base border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none"
          />
        </div>

        {/* Counts Card */}
        <div className="w-full max-w-2xl card p-4 space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
            <Microscope size={18} className="text-[var(--color-primary-dark)]" /> Sample Findings
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider"># of Bees</label>
              <input
                type="number"
                min={1}
                value={beeCount || ''}
                onChange={e => setBeeCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="p-3.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Mites Found</label>
              <input
                type="number"
                min={0}
                value={miteCount === 0 ? '0' : miteCount || ''}
                onChange={e => setMiteCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="p-3.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Live Result Display (Mockup 1 Styling) */}
        <div className="w-full max-w-2xl">
          <div className={`border p-4 rounded-2xl flex justify-between items-center transition-all duration-300 ${status.bg} ${status.border}`}>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">Mite Load</span>
              <span className={`text-2xl font-black ${status.color} mt-0.5`}>
                {mitePct.toFixed(2)}%
              </span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-wider">HBHC Limit</span>
              <span className="text-xl font-black text-[var(--color-text)] mt-0.5">
                {threshold}%
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {status.icon}
              <span className={`text-base font-black uppercase tracking-tight ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2.5 mt-1.5 text-[10px] text-[var(--color-text-muted)] font-medium">
            <Info size={11} />
            <span>Guidelines recommend maintaining a load below 2–3% depending on season.</span>
          </div>
        </div>

        {/* Notes card */}
        <div className="w-full max-w-2xl card p-4">
          <h3 className="text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
            <span>📝</span> Notes (optional)
          </h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Test method (e.g. Alcohol Wash, Powdered Sugar), observations..."
            className="w-full h-24 p-3.5 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none resize-none font-medium text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
          />
        </div>
      </div>

      {/* Segregated Bottom Save/Cancel Bar */}
      <div className="w-full flex-shrink-0 flex justify-center gap-2.5 p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 dark:bg-black/55 dark:border-white/10 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            selectInspection(null);
            setIsFormOpen(false);
          }}
          disabled={loading}
          className="flex-1 max-w-[110px] bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm dark:bg-black/30 dark:border-white/10 dark:text-white"
        >
          Cancel
        </button>

        {selectedRecord && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-14 flex-shrink-0 bg-red-500 text-white py-4 rounded-2xl transition-colors shadow-lg flex items-center justify-center disabled:opacity-50 active:scale-95"
          >
            <Trash2 size={22} />
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-grow max-w-md bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg transition-colors shadow-lg shadow-[var(--color-primary)]/30 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
        >
          {loading ? (
            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <Save size={22} />
              {selectedRecord ? 'Update' : 'Save'}
            </>
          )}
        </button>
      </div>

    </div>
  );
};
