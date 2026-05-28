import React, { useState } from 'react';
import { createInspection, updateInspection, deleteInspection } from '../../data/inspectionRepository';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2, Hexagon } from 'lucide-react';
import { HistoryFeed } from '../../shared/components/HistoryFeed';
import { SubTabBar } from '../../shared/components/SubTabBar';

const QUEEN_STATUS_OPTIONS = [
  { value: 'seen', label: 'Seen' },
  { value: 'eggs_present', label: 'Eggs' },
  { value: 'larvae_present', label: 'Larvae' },
  { value: 'capped_brood', label: 'Capped' },
  { value: 'virgin', label: 'Virgin' },
  { value: 'no_queen', label: 'NO QUEEN' },
  { value: 'queen_cells', label: 'Q. Cells' },
];

const BROOD_PATTERN_OPTIONS = [
  { value: 'excellent', label: 'Solid' },
  { value: 'good', label: 'Good' },
  { value: 'spotty', label: 'Spotty' },
  { value: 'poor', label: 'Poor' },
];

const TEMPERAMENT_OPTIONS = [
  { value: 'calm', label: 'Calm' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'defensive', label: 'Defensive' },
  { value: 'aggressive', label: 'Aggressive' },
];

const STORES_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Some' },
  { value: 'adequate', label: 'Half' },
  { value: 'abundant', label: 'Full' },
];

export const InspectionFormView: React.FC = () => {
  const { selectedHiveId, selectedRecord, goBack, selectInspection } = useAppStore();
  const [loading, setLoading] = useState(false);
  
  const [date, setDate] = useState(() => {
    if (selectedRecord?.timestamp) {
      return new Date(selectedRecord.timestamp).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [queenStatus, setQueenStatus] = useState<string>(selectedRecord?.queen_status || 'seen');
  const [broodPattern, setBroodPattern] = useState<string>(selectedRecord?.brood_pattern || 'good');
  const [temperament, setTemperament] = useState<string>(selectedRecord?.temperament || 'moderate');
  const [honeyStores, setHoneyStores] = useState<string>(selectedRecord?.honey_stores || 'adequate');
  const [pollenStores, setPollenStores] = useState<string>(selectedRecord?.pollen_stores || 'adequate');
  const [observations, setObservations] = useState(selectedRecord?.observations || '');
  const [isFormOpen, setIsFormOpen] = useState(!!selectedRecord);

  // Keep form in sync if the user taps a different history item while the form is already open
  React.useEffect(() => {
    if (selectedRecord) {
      setIsFormOpen(true);
      setDate(new Date(selectedRecord.timestamp).toISOString().split('T')[0]);
      setQueenStatus(selectedRecord.queen_status || 'seen');
      setBroodPattern(selectedRecord.brood_pattern || 'good');
      setTemperament(selectedRecord.temperament || 'moderate');
      setHoneyStores(selectedRecord.honey_stores || 'adequate');
      setPollenStores(selectedRecord.pollen_stores || 'adequate');
      setObservations(selectedRecord.observations || '');
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setQueenStatus('seen');
      setBroodPattern('good');
      setTemperament('moderate');
      setHoneyStores('adequate');
      setPollenStores('adequate');
      setObservations('');
    }
  }, [selectedRecord]);

  const handleSave = async () => {
    if (!selectedHiveId) return;
    setLoading(true);

    const payload = {
      hive_id: selectedHiveId,
      timestamp: new Date(date + 'T12:00:00').toISOString(),
      queen_status: queenStatus,
      brood_pattern: broodPattern,
      temperament: temperament,
      honey_stores: honeyStores,
      pollen_stores: pollenStores,
      observations: observations
    };

    let error;
    try {
      if (selectedRecord) {
        await updateInspection(selectedRecord.id, payload);
      } else {
        await createInspection(payload);
      }
    } catch (e: any) {
      error = e;
    }

    setLoading(false);
    
    if (error) {
      alert('Failed to save inspection: ' + error.message);
    } else {
      selectInspection(null);
      goBack();
    }
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;
    if (!confirm('Are you sure you want to delete this inspection?')) return;
    
    setLoading(true);
    try {
      await deleteInspection(selectedRecord.id);
      setLoading(false);
      selectInspection(null);
      goBack();
    } catch (e: any) {
      setLoading(false);
      alert('Failed to delete inspection: ' + e.message);
    }
  };

  const renderPills = (title: string, icon: string, options: any[], value: string, setter: (val: string) => void) => (
    <div>
      <h3 className="text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button 
            key={opt.value}
            onClick={() => setter(opt.value)}
            className={`px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all flex-grow text-center min-h-[48px] ${
              value === opt.value 
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]' 
                : 'border-[var(--color-card-border)] bg-[var(--color-input-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (!isFormOpen) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-4 space-y-4">
          <SubTabBar activeView="INSPECTION_FORM" />
          <div className="w-full max-w-2xl mb-2">
            <button
              onClick={() => setIsFormOpen(true)}
              className="w-full bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg transition-colors shadow-lg shadow-[var(--color-primary)]/20 flex items-center justify-center gap-2 active:scale-95"
            >
              + Add Inspection
            </button>
          </div>

          <div className="w-full max-w-2xl">
            <HistoryFeed hiveId={selectedHiveId!} filter="inspections" />
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

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      
      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-3 sm:p-4 space-y-4 pb-28">
        <SubTabBar activeView="INSPECTION_FORM" />
        {/* Date card */}
        <div className="w-full max-w-2xl card p-4">
          <h3 className="text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
            <span>📅</span> Date
          </h3>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full h-12 px-4 py-0 block rounded-xl bg-[var(--color-input-bg)] text-[var(--color-primary)] font-bold text-base border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none"
          />
        </div>

        {/* Notes card */}
        <div className="w-full max-w-2xl card p-4">
          <h3 className="text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
            <span>📝</span> Notes
          </h3>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Tap here to add field notes..."
            className="w-full h-24 p-3.5 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none resize-none font-medium text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
          />
        </div>

        {/* Queen & Brood card */}
        <div className="w-full max-w-2xl card p-4 space-y-5">
          {renderPills('Queen Status', '👑', QUEEN_STATUS_OPTIONS, queenStatus, setQueenStatus)}
          {renderPills('Brood Pattern', '🐝', BROOD_PATTERN_OPTIONS, broodPattern, setBroodPattern)}
          {renderPills('Temperament', '🌡️', TEMPERAMENT_OPTIONS, temperament, setTemperament)}
        </div>

        {/* Stores card */}
        <div className="w-full max-w-2xl card p-4 space-y-5">
          <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Stores</h3>
          {renderPills('Honey', '🍯', STORES_OPTIONS, honeyStores, setHoneyStores)}
          {renderPills('Pollen', '🌼', STORES_OPTIONS, pollenStores, setPollenStores)}
        </div>
      </div>

      {/* Segregated Bottom Save Bar */}
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
