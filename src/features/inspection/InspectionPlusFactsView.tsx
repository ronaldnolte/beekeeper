import React, { useState } from 'react';
import { Camera, Check, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { updateInspection, discardInspection } from '../../data/inspectionRepository';
import {
  QUEEN_STATUS_OPTIONS,
  BROOD_PATTERN_OPTIONS,
  TEMPERAMENT_OPTIONS,
  STORES_OPTIONS,
} from './inspectionOptions';

/**
 * Inspection Plus — Screen 1 (quick facts).
 * Operates on the draft inspection created by the chooser. Pills are enlarged
 * for gloved hands. Typed observations are intentionally omitted here — in Plus
 * the notes are voice-driven (screen 2). "Done" saves the draft and exits;
 * "+ Photos & voice" persists the facts then opens screen 2.
 */
export const InspectionPlusFactsView: React.FC = () => {
  const { selectedRecord, navigateTo, goBack, selectInspection } = useAppStore();
  const draftId = selectedRecord?.id as string | undefined;
  const hiveId = selectedRecord?.hive_id as string | undefined;

  const [date, setDate] = useState(() =>
    selectedRecord?.timestamp
      ? new Date(selectedRecord.timestamp).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [queenStatus, setQueenStatus] = useState<string>(selectedRecord?.queen_status || 'seen');
  const [broodPattern, setBroodPattern] = useState<string>(selectedRecord?.brood_pattern || 'good');
  const [temperament, setTemperament] = useState<string>(selectedRecord?.temperament || 'moderate');
  const [honeyStores, setHoneyStores] = useState<string>(selectedRecord?.honey_stores || 'adequate');
  const [pollenStores, setPollenStores] = useState<string>(selectedRecord?.pollen_stores || 'adequate');
  const [saving, setSaving] = useState(false);

  const persist = async (): Promise<boolean> => {
    if (!draftId || !hiveId) return false;
    const payload = {
      hive_id: hiveId,
      timestamp: new Date(date + 'T12:00:00').toISOString(),
      queen_status: queenStatus,
      brood_pattern: broodPattern,
      temperament,
      honey_stores: honeyStores,
      pollen_stores: pollenStores,
      observations: selectedRecord?.observations || '',
    };
    setSaving(true);
    try {
      await updateInspection(draftId, payload);
      // Keep the in-memory record in sync for screen 2. Drop the _isNewDraft flag —
      // once the user has saved/advanced, Cancel must no longer discard the draft.
      const { _isNewDraft, ...rest } = (selectedRecord ?? {}) as Record<string, any>;
      selectInspection({ _model_type: 'inspection', ...rest, ...payload, id: draftId });
      return true;
    } catch (e: any) {
      alert('Could not save: ' + (e?.message ?? e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePhotos = async () => {
    if (await persist()) navigateTo('INSPECTION_PLUS');
  };

  const handleDone = async () => {
    if (await persist()) goBack();
  };

  // Cancel: if this is a brand-new, untouched draft, discard it so backing out of
  // Plus doesn't leave an empty draft behind. Otherwise just go back.
  const handleCancel = async () => {
    if ((selectedRecord as Record<string, any>)?._isNewDraft && draftId) {
      if (!confirm('Discard this draft? Nothing will be saved.')) return;
      setSaving(true);
      try {
        await discardInspection(draftId);
      } catch (e: any) {
        alert('Could not discard: ' + (e?.message ?? e));
        setSaving(false);
        return;
      }
    }
    goBack();
  };

  const renderPills = (
    title: string,
    icon: string,
    options: { value: string; label: string }[],
    value: string,
    setter: (v: string) => void
  ) => (
    <div>
      <h3 className="text-sm font-black text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5 uppercase tracking-wide">
        <span>{icon}</span> {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setter(opt.value)}
            className={`px-4 py-3 rounded-2xl border-2 font-bold text-sm transition-all flex-grow text-center min-h-[52px] ${
              value === opt.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                : 'border-[var(--color-card-border)] bg-[var(--color-input-bg)] text-[var(--color-text-muted)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (!draftId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
        <p className="font-bold text-[var(--color-text)] mb-3">No draft inspection</p>
        <button onClick={goBack} className="bg-[var(--color-primary)] text-white px-5 py-3 rounded-2xl font-bold">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-3 sm:p-4 space-y-3 pb-24">
        <div className="w-full max-w-2xl flex items-center gap-2 text-[var(--color-primary)] font-black">
          <Sparkles size={20} /> <span>Plus inspection · draft</span>
        </div>

        <div className="w-full max-w-2xl card p-3 sm:p-4">
          <h3 className="text-sm font-black text-[var(--color-text-muted)] mb-2 flex items-center gap-1.5 uppercase tracking-wide">
            <span>📅</span> Date
          </h3>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-12 px-3 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-primary)] font-bold text-base border border-[var(--color-card-border)] focus:border-[var(--color-primary)] outline-none"
          />
        </div>

        <div className="w-full max-w-2xl card p-3 sm:p-4 space-y-4">
          {renderPills('Queen Status', '👑', QUEEN_STATUS_OPTIONS, queenStatus, setQueenStatus)}
          {renderPills('Brood Pattern', '🐝', BROOD_PATTERN_OPTIONS, broodPattern, setBroodPattern)}
          {renderPills('Temperament', '🌡️', TEMPERAMENT_OPTIONS, temperament, setTemperament)}
        </div>

        <div className="w-full max-w-2xl card p-3 sm:p-4 space-y-4">
          {renderPills('Honey', '🍯', STORES_OPTIONS, honeyStores, setHoneyStores)}
          {renderPills('Pollen', '🌼', STORES_OPTIONS, pollenStores, setPollenStores)}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="w-full flex-shrink-0 flex justify-center gap-2.5 p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 dark:bg-black/55 dark:border-white/10 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          onClick={handleCancel}
          disabled={saving}
          aria-label="Cancel"
          className="w-16 flex-shrink-0 bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-0.5 active:scale-95 dark:bg-black/30 dark:border-white/10 dark:text-white disabled:opacity-50"
        >
          <X size={20} />
          <span className="text-[10px]">Cancel</span>
        </button>
        <button
          onClick={handlePhotos}
          disabled={saving}
          className="flex-1 max-w-md bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Camera size={22} /> Photos &amp; Voice
        </button>
        <button
          onClick={handleDone}
          disabled={saving}
          className="w-16 flex-shrink-0 bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-0.5 active:scale-95 dark:bg-black/30 dark:border-white/10 dark:text-white disabled:opacity-50"
        >
          <Check size={20} />
          <span className="text-[10px]">Done</span>
        </button>
      </div>
    </div>
  );
};
