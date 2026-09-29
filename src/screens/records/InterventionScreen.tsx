// Interventions — SPEC B §17 (screenshots B31, B32).

import { useState, type ReactNode } from 'react';
import { Archive, Crown, Droplet, Hash, Pill, Save, Scissors, Trash2, Wrench, type LucideIcon } from 'lucide-react';
import { useApp } from '../../app/store';
import { HistoryFeed } from '../../components/HistoryFeed';
import { noonLocalIso, recordDay } from '../../lib/recordDates';
import { INTERVENTION_TYPES, deleteIntervention, saveIntervention } from '../../lib/records';
import { BottomBar, RecordTabs, ReturnToHiveBar } from './RecordParts';

const ICONS: Record<string, LucideIcon> = {
  feeding: Droplet,
  treatment: Pill,
  manipulation: Wrench,
  cross_comb_fix: Scissors,
  requeen: Crown,
  honey_harvest: Archive,
  other: Hash,
};

/** Card with a title-case heading ("📅 Date") — the intervention and varroa forms. */
export function FormCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-2.5 mb-3 text-sm font-bold text-text">
        <span aria-hidden="true" className="w-6 flex justify-center">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export const dateInput = 'w-full h-12 rounded-2xl bg-white/70 px-4 text-base font-bold text-primary outline-none focus:ring-4 focus:ring-primary-ring';
export const notesInput = 'w-full rounded-2xl bg-white/70 px-4 py-3 text-base text-text outline-none focus:ring-4 focus:ring-primary-ring placeholder:text-text-muted resize-y';

/** Bottom bar of the intervention and varroa forms: Cancel, trash (edit only), Save/Update. */
export function FormActions({ editing, busy, onCancel, onDelete, onSave }: { editing: boolean; busy: boolean; onCancel: () => void; onDelete: () => void; onSave: () => void }) {
  return (
    <BottomBar gap="gap-3">
      <button type="button" onClick={onCancel} disabled={busy} className="w-[30%] h-[60px] rounded-2xl bg-white shadow-sm text-sm font-bold text-text disabled:opacity-60">
        Cancel
      </button>
      {editing && (
        <button type="button" aria-label="Delete" onClick={onDelete} disabled={busy} className="w-[60px] h-[60px] shrink-0 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-md disabled:opacity-50">
          <Trash2 size={24} />
        </button>
      )}
      <button type="button" onClick={onSave} disabled={busy} className="flex-1 h-[60px] rounded-2xl bg-primary text-white text-xl font-black flex items-center justify-center gap-3 shadow-md disabled:opacity-60">
        <Save size={24} /> {editing ? 'Update' : 'Save'}
      </button>
    </BottomBar>
  );
}

function InterventionForm({ onDone }: { onDone: (toHive: boolean) => void }) {
  const { state } = useApp();
  const rec = state.selectedRecord?.kind === 'intervention' ? state.selectedRecord : null;
  const id = rec?.id ?? null;
  const [day, setDay] = useState(() => recordDay(rec?.timestamp as string | undefined));
  const [type, setType] = useState<string>((rec?.type as string) || 'feeding');
  const [details, setDetails] = useState((rec?.description as string) ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveIntervention(id, state.selectedHiveId!, { timestamp: noonLocalIso(day), type, description: details });
      onDone(true);
    } catch (err) {
      window.alert(`Failed to save intervention: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this intervention?')) return;
    setBusy(true);
    try {
      await deleteIntervention(id);
      onDone(true);
    } catch (err) {
      window.alert(`Failed to delete intervention: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormCard icon="📅" title="Date">
        <input type="date" aria-label="Date" value={day} onChange={e => setDay(e.target.value)} className={dateInput} />
      </FormCard>
      <FormCard icon="🔧" title="Intervention Type">
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Intervention type">
          {INTERVENTION_TYPES.map(([label, value]) => {
            const Icon = ICONS[value];
            const on = value === type;
            const tone = value === 'requeen' ? 'border-purple-500 bg-purple-500/15 text-purple-600' : 'border-primary bg-primary/15 text-primary';
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(value)}
                className={`h-[72px] rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 font-bold transition-colors ${on ? tone : 'border-transparent bg-white/70 text-text-muted'}`}
              >
                <Icon size={22} />
                <span className="text-[11px]">{label}</span>
              </button>
            );
          })}
        </div>
      </FormCard>
      <FormCard icon="📝" title="Details">
        <textarea
          aria-label="Details"
          value={details}
          onChange={e => setDetails(e.target.value)}
          rows={3}
          placeholder={type === 'requeen' ? 'Queen source, markings, reason for replacement...' : 'Tap here to add details...'}
          className={notesInput}
        />
      </FormCard>
      <FormActions editing={!!id} busy={busy} onCancel={() => onDone(false)} onDelete={() => void remove()} onSave={() => void save()} />
    </div>
  );
}

export default function InterventionScreen() {
  const { state, selectRecord, navigate } = useApp();
  const [adding, setAdding] = useState(false);
  const hiveId = state.selectedHiveId;
  const editing = state.selectedRecord?.kind === 'intervention';

  const done = (toHive: boolean) => {
    setAdding(false);
    selectRecord(null);
    if (toHive) navigate('HIVE_DETAIL', { keepRecord: false });
  };

  return (
    <div className="max-w-2xl mx-auto px-2.5 pt-2 pb-36">
      <RecordTabs active="INTERVENTION_FORM" />
      {adding || editing ? (
        <InterventionForm key={state.selectedRecord?.id ?? 'new'} onDone={done} />
      ) : (
        <>
          <button type="button" onClick={() => setAdding(true)} disabled={!hiveId} className="w-full h-[58px] rounded-3xl bg-primary text-white text-lg font-black shadow-md disabled:opacity-60">
            + Add Intervention
          </button>
          <div className="mt-5">
            {hiveId && (
              <HistoryFeed
                hiveId={hiveId}
                filter="interventions"
                onOpen={item => {
                  selectRecord({ ...item.row, id: item.id, kind: 'intervention' });
                  navigate('INTERVENTION_FORM');
                }}
              />
            )}
          </div>
          <ReturnToHiveBar />
        </>
      )}
    </div>
  );
}
