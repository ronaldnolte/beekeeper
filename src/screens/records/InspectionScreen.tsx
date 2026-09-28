// Inspections — SPEC B §14 (screenshots B26–B28).

import { useEffect, useState } from 'react';
import { Camera, Share2 } from 'lucide-react';
import { useApp } from '../../app/store';
import { HistoryFeed } from '../../components/HistoryFeed';
import { noonLocalIso, utcDay } from '../../lib/recordDates';
import { supabase } from '../../lib/supabase';
import { BROOD, DEFAULTS, QUEEN, STORES, TEMPERAMENT, deleteInspection, saveInspection, startInspection, type InspectionFields } from '../../lib/inspections';
import { BottomBar, CardSection, PillGroup, RecordTabs, ReturnToHiveBar, SaveButton, SectionTitle, TrashButton } from './RecordParts';
import { ExportSheet } from './ExportSheet';

function InspectionForm() {
  const { state, selectRecord, navigate } = useApp();
  const rec = state.selectedRecord!;
  // Update vs create is decided by the id held here, never by the app-wide selection (SCAR S-INSP-1).
  const [id] = useState<string | null>(rec.id ?? null);
  const [day, setDay] = useState(() => utcDay(rec.timestamp as string | undefined));
  const [f, setF] = useState<InspectionFields>(() => ({
    queen_status: (rec.queen_status as string) ?? DEFAULTS.queen_status,
    brood_pattern: (rec.brood_pattern as string) ?? null,
    temperament: (rec.temperament as string) ?? null,
    honey_stores: (rec.honey_stores as string) ?? null,
    pollen_stores: (rec.pollen_stores as string) ?? null,
    observations: (rec.observations as string) ?? '',
  }));
  const [count, setCount] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<InspectionFields>) => setF(s => ({ ...s, ...patch }));

  useEffect(() => {
    if (!id) return;
    void supabase
      .from('inspection_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('inspection_id', id)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [id]);

  const closeToList = () => {
    selectRecord(null);
    navigate('INSPECTION_FORM', { keepRecord: false });
  };

  const save = async () => {
    setBusy(true);
    try {
      await saveInspection(id, state.selectedHiveId!, noonLocalIso(day), f);
      closeToList();
    } catch (err) {
      window.alert(`Failed to save inspection: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this inspection?')) return;
    setBusy(true);
    try {
      await deleteInspection(id);
      selectRecord(null);
      navigate('HIVE_DETAIL', { keepRecord: false });
    } catch (err) {
      window.alert(`Failed to delete inspection: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  const openPhotos = () => {
    // Re-select the record before opening attachments (SCAR S-INSP-3).
    selectRecord({ ...rec, id: id!, ...f, timestamp: noonLocalIso(day) });
    navigate('INSPECTION_PLUS');
  };

  return (
    <div className="space-y-4">
      <CardSection>
        <SectionTitle icon="📅">Date</SectionTitle>
        <input type="date" value={day} onChange={e => setDay(e.target.value)} className="w-full h-12 rounded-2xl bg-white/70 px-4 text-lg font-bold text-primary outline-none focus:ring-4 focus:ring-primary-ring" />
        <div className="mt-5">
          <SectionTitle icon="📝">Notes</SectionTitle>
          <textarea
            value={f.observations ?? ''}
            onChange={e => set({ observations: e.target.value })}
            placeholder="Tap here to add field notes..."
            rows={1}
            className="w-full min-h-12 rounded-2xl bg-white/70 px-4 py-3 text-base text-text outline-none focus:ring-4 focus:ring-primary-ring placeholder:text-text-muted resize-y"
          />
        </div>
      </CardSection>

      {id && (
        <button type="button" onClick={openPhotos} className="w-full h-[42px] rounded-3xl border-2 border-dashed border-primary/40 text-primary font-black flex items-center justify-center gap-2">
          <Camera size={20} /> Photos &amp; Voice
          {count > 0 && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white">{count}</span>}
        </button>
      )}
      {id && (
        <button type="button" onClick={() => setExportOpen(true)} className="w-full h-[42px] rounded-3xl bg-card-bg border border-card-border shadow-sm font-black text-text flex items-center justify-center gap-3">
          <Share2 size={20} /> Export / Share
        </button>
      )}

      <CardSection className="space-y-5">
        <div>
          <SectionTitle icon="👑">Queen status</SectionTitle>
          <PillGroup label="Queen status" options={QUEEN} value={f.queen_status} onChange={v => set({ queen_status: v })} />
        </div>
        <div>
          <SectionTitle icon="🐝">Brood pattern</SectionTitle>
          <PillGroup label="Brood pattern" options={BROOD} value={f.brood_pattern} onChange={v => set({ brood_pattern: v })} />
        </div>
        <div>
          <SectionTitle icon="🌡️">Temperament</SectionTitle>
          <PillGroup label="Temperament" options={TEMPERAMENT} value={f.temperament} onChange={v => set({ temperament: v })} />
        </div>
      </CardSection>

      <CardSection className="space-y-4">
        <p className="text-sm font-black uppercase tracking-wider text-text-muted">Stores</p>
        <div>
          <SectionTitle icon="🍯">Honey</SectionTitle>
          <PillGroup label="Honey" options={STORES} value={f.honey_stores} onChange={v => set({ honey_stores: v })} />
        </div>
        <div>
          <SectionTitle icon="🌼">Pollen</SectionTitle>
          <PillGroup label="Pollen" options={STORES} value={f.pollen_stores} onChange={v => set({ pollen_stores: v })} />
        </div>
      </CardSection>

      {/* No Cancel: the record already exists; back closes the form (SCAR S-INSP-7). */}
      <BottomBar>
        {id && <TrashButton onClick={() => void remove()} disabled={busy} />}
        <SaveButton label="Save & Exit" onClick={() => void save()} disabled={busy} />
      </BottomBar>

      {exportOpen && id && <ExportSheet inspectionId={id} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

export default function InspectionScreen() {
  const { state, selectRecord, navigate } = useApp();
  const [starting, setStarting] = useState(false);
  const hiveId = state.selectedHiveId;
  const rec = state.selectedRecord;
  const formOpen = !!rec && (rec.kind === undefined || rec.kind === 'inspection');

  const add = async () => {
    if (!hiveId) return;
    setStarting(true);
    try {
      const created = await startInspection(hiveId);
      selectRecord({ ...created, kind: 'inspection' });
      // Its own history entry: browser back closes the form to the list (SCAR S-INSP-5).
      navigate('INSPECTION_FORM');
    } catch (err) {
      window.alert(`Could not start inspection: ${(err as Error).message}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-2.5 pt-2 pb-36">
      <RecordTabs active="INSPECTION_FORM" />
      {formOpen ? (
        <InspectionForm key={rec!.id} />
      ) : (
        <>
          <button type="button" onClick={() => void add()} disabled={starting || !hiveId} className="w-full h-[60px] rounded-3xl bg-primary text-white text-2xl font-black shadow-md disabled:opacity-60">
            + Add Inspection
          </button>
          <div className="mt-5">
            {hiveId && (
              <HistoryFeed
                hiveId={hiveId}
                filter="inspections"
                onOpen={item => {
                  selectRecord({ ...item.row, id: item.id, kind: 'inspection' });
                  navigate('INSPECTION_FORM');
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
