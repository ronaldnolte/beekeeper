import React, { useState } from 'react';
import { createInspection, updateInspection, deleteInspection } from '../../data/inspectionRepository';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2, Hexagon, Camera, ClipboardList, Sparkles, X } from 'lucide-react';
import { HistoryFeed } from '../../shared/components/HistoryFeed';
import { SubTabBar } from '../../shared/components/SubTabBar';
import { DraftReviewSection } from './DraftReviewSection';

import {
  QUEEN_STATUS_OPTIONS,
  BROOD_PATTERN_OPTIONS,
  TEMPERAMENT_OPTIONS,
  STORES_OPTIONS,
  INSPECTION_DEFAULTS,
} from './inspectionOptions';

export const InspectionFormView: React.FC = () => {
  const { selectedHiveId, selectedRecord, goBack, selectInspection, navigateTo } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Plus path: create the inspection as a draft up front, then walk the two-screen
  // Plus flow (quick facts → photos & voice). The record exists immediately so
  // attachments can hang off it during capture.
  const handleStartPlus = async () => {
    if (!selectedHiveId) return;
    setShowChooser(false);
    setLoading(true);
    const timestamp = new Date().toISOString();
    try {
      const { id } = await createInspection({
        hive_id: selectedHiveId,
        timestamp,
        ...INSPECTION_DEFAULTS,
        review_status: 'draft',
      });
      selectInspection({
        _model_type: 'inspection',
        id,
        hive_id: selectedHiveId,
        timestamp,
        review_status: 'draft',
        // Marks a brand-new draft so the facts screen's Cancel can discard it if
        // the user backs out immediately. Cleared once they engage (see persist()).
        _isNewDraft: true,
        ...INSPECTION_DEFAULTS,
      });
      navigateTo('INSPECTION_PLUS_FACTS');
    } catch (e: any) {
      alert('Could not start inspection: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };
  
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
      <h3 className="text-xs font-black text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
        <span>{icon}</span> {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button 
            key={opt.value}
            onClick={() => setter(opt.value)}
            className={`px-3 py-2 rounded-xl border-2 font-bold text-xs transition-all flex-grow text-center min-h-[38px] ${
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
              onClick={() => setShowChooser(true)}
              disabled={loading}
              className="w-full bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg transition-colors shadow-lg shadow-[var(--color-primary)]/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              + Add Inspection
            </button>
          </div>

          <DraftReviewSection
            hiveId={selectedHiveId!}
            refreshTrigger={refreshKey}
            onChange={() => setRefreshKey((k) => k + 1)}
          />

          <div className="w-full max-w-2xl">
            <HistoryFeed hiveId={selectedHiveId!} filter="inspections" refreshTrigger={refreshKey} />
          </div>
        </div>

        {/* Standard / Plus chooser — the single doorway to a new inspection */}
        {showChooser && (
          <div
            className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowChooser(false)}
          >
            <div
              className="w-full max-w-md bg-[var(--color-bg)] rounded-3xl p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-[var(--color-text)]">New inspection</h2>
                <button
                  onClick={() => setShowChooser(false)}
                  className="w-9 h-9 rounded-full bg-[var(--color-input-bg)] flex items-center justify-center text-[var(--color-text-muted)]"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                onClick={handleStartPlus}
                className="w-full text-left mb-3 p-4 rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-2 font-black text-[var(--color-primary)] mb-1">
                  <Sparkles size={20} /> Plus
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Guided capture with photos &amp; voice notes — great at the hive. Saves as a
                  draft to review later.
                </p>
              </button>

              <button
                onClick={() => {
                  setShowChooser(false);
                  setIsFormOpen(true);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-input-bg)] active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-2 font-black text-[var(--color-text)] mb-1">
                  <ClipboardList size={20} /> Standard
                </div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Just the facts — the quick form, saved straight away.
                </p>
              </button>
            </div>
          </div>
        )}

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
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-2.5 sm:p-4 space-y-3 pb-24">
        <SubTabBar activeView="INSPECTION_FORM" />
        
        {/* Date & Notes Card (Combined & Responsive Grid) */}
        <div className="w-full max-w-2xl card p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <h3 className="text-xs font-black text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
                <span>📅</span> Date
              </h3>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-10 px-3 py-0 block rounded-xl bg-[var(--color-input-bg)] text-[var(--color-primary)] font-bold text-sm border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <h3 className="text-xs font-black text-[var(--color-text-muted)] mb-1.5 flex items-center gap-1.5 uppercase tracking-wide">
                <span>📝</span> Notes
              </h3>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Tap here to add field notes..."
                className="w-full h-10 sm:h-20 p-2.5 px-3 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none resize-none font-medium text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] custom-scrollbar"
              />
            </div>
          </div>
        </div>

        {/* Photos & voice — available once the inspection exists (has an id) */}
        {selectedRecord && (
          <button
            type="button"
            onClick={() => navigateTo('INSPECTION_PLUS')}
            className="w-full max-w-2xl card p-3.5 flex items-center justify-center gap-2 font-black text-sm text-[var(--color-primary)] border-2 border-dashed border-[var(--color-primary)]/40 active:scale-[0.99] transition-transform"
          >
            <Camera size={20} /> Photos &amp; Voice
          </button>
        )}

        {/* Queen & Brood card */}
        <div className="w-full max-w-2xl card p-3 sm:p-4 space-y-3">
          {renderPills('Queen Status', '👑', QUEEN_STATUS_OPTIONS, queenStatus, setQueenStatus)}
          {renderPills('Brood Pattern', '🐝', BROOD_PATTERN_OPTIONS, broodPattern, setBroodPattern)}
          {renderPills('Temperament', '🌡️', TEMPERAMENT_OPTIONS, temperament, setTemperament)}
        </div>

        {/* Stores card */}
        <div className="w-full max-w-2xl card p-3 sm:p-4 space-y-3">
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
