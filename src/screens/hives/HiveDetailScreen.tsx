// Hive Detail — SPEC B §10 (screenshots B24, B25).

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, Hexagon, Microscope, PlusCircle, type LucideIcon } from 'lucide-react';
import { useApp } from '../../app/store';
import type { View } from '../../app/views';
import { Spinner } from '../../components/Chrome';
import { HistoryFeed, type FeedItem } from '../../components/HistoryFeed';
import { defaultBars, isLangstroth, parseBars, type StackPart, type TopBar } from '../../lib/apiaryHiveData';
import { supabase, type Hive } from '../../lib/supabase';
import { StatusBadge } from './HivesScreen';
import { LangstrothVisualizer, TopBarVisualizer } from './Visualizers';

export function HiveActionBar() {
  const { goBack, navigate, selectRecord } = useApp();
  const open = (view: View) => {
    selectRecord(null);
    navigate(view, { keepRecord: false });
  };
  const items: [string, LucideIcon, () => void][] = [
    ['Hives', Hexagon, goBack],
    ['Inspection', ClipboardList, () => open('INSPECTION_FORM')],
    ['Intervention', PlusCircle, () => open('INTERVENTION_FORM')],
    ['Varroa', Microscope, () => open('VARROA_FORM')],
    // Opens the task sheet with this hive as the default.
    ['Task', AlertTriangle, () => open('TASK_FORM')],
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto w-[96%] max-w-[512px] h-16 rounded-full bg-[#1a1a2e] border border-[#2a2a4a] shadow-2xl flex items-stretch px-2">
        {items.map(([label, Icon, onClick]) => (
          <button key={label} type="button" onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-1 text-white/60 active:text-primary">
            <Icon size={22} />
            <span className="text-[10px] leading-none">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

const FORM_FOR: Record<FeedItem['kind'], View> = {
  inspection: 'INSPECTION_FORM',
  intervention: 'INTERVENTION_FORM',
  varroa: 'VARROA_FORM',
  task: 'TASK_FORM',
  snapshot: 'HIVE_DETAIL',
};

export default function HiveDetailScreen() {
  const { state, navigate, selectRecord } = useApp();
  const hiveId = state.selectedHiveId;
  const [hive, setHive] = useState<Hive | null | undefined>(undefined);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!hiveId) return setHive(null);
    setHive(undefined);
    void supabase
      .from('hives')
      .select('*')
      .eq('id', hiveId)
      .maybeSingle()
      .then(({ data }) => setHive(data));
  }, [hiveId]);

  const openItem = useCallback(
    (item: FeedItem) => {
      selectRecord({ ...item.row, id: item.id, kind: item.kind });
      navigate(FORM_FOR[item.kind]);
    },
    [navigate, selectRecord],
  );

  if (hive === undefined) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
        <Spinner /> Loading hive data...
      </div>
    );
  }
  if (hive === null) return <p className="py-20 text-center text-text-muted">Hive not found.</p>;

  const bars = parseBars(hive.bars);
  const lang = isLangstroth(hive.type);

  return (
    <div className="max-w-2xl mx-auto px-3 pt-3 pb-32 space-y-6">
      <div className="card relative pl-7 pr-5 py-5">
        <span className="absolute left-0 inset-y-0 w-1.5 bg-primary" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-black text-text truncate">{hive.name}</h2>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-text-muted">TYPE: {hive.type || 'Standard TBH'}</p>
          </div>
          <StatusBadge />
        </div>
      </div>

      {hive.notes && (
        <div className="card px-6 py-5">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-text-muted">Notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-text">{hive.notes}</p>
        </div>
      )}

      {lang ? (
        <LangstrothVisualizer key={hive.id} hiveId={hive.id} initial={(bars as StackPart[] | null) ?? []} onSaved={() => setRefresh(r => r + 1)} />
      ) : (
        <TopBarVisualizer key={hive.id} hiveId={hive.id} initial={(bars as TopBar[] | null) ?? defaultBars(30)} onSaved={() => setRefresh(r => r + 1)} />
      )}

      <HistoryFeed hiveId={hive.id} filter="tasks" title="Tasks" hideCompletedTasks refreshKey={refresh} onOpen={openItem} />
      <HistoryFeed hiveId={hive.id} filter="snapshots" title="Hive Configuration History" refreshKey={refresh} onOpen={openItem} />

      <HiveActionBar />
    </div>
  );
}
