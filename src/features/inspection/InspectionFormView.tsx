import React, { useState } from 'react';
import { createInspection, updateInspection, deleteInspection } from '../../data/inspectionRepository';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2 } from 'lucide-react';
import { HistoryFeed } from '../../shared/components/HistoryFeed';

const QUEEN_STATUS_OPTIONS = [
  { value: 'seen', label: 'Seen' },
  { value: 'eggs_present', label: 'Eggs' },
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
  { value: 'abundant', label: 'Abundant' },
  { value: 'adequate', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'none', label: 'None' },
];

export const InspectionFormView: React.FC = () => {
  const { selectedHiveId, selectedRecord, goBack, selectInspection } = useAppStore();
  const [loading, setLoading] = useState(false);
  
  // Form State initialized from selectedRecord if editing an existing inspection
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
      selectInspection(null); // Clear editing state
      goBack(); // Return to Hive Details
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

  const renderPills = (title: string, options: any[], value: string, setter: (val: string) => void) => (
    <div>
      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {options.map((opt) => (
          <button 
            key={opt.value}
            onClick={() => setter(opt.value)}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border-2 font-bold text-xs transition-all flex-grow sm:flex-grow-0 ${
              value === opt.value 
                ? 'border-[#E67E22] bg-[#E67E22]/10 text-[#E67E22]' 
                : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
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
      <div className="w-full flex flex-col items-center p-4 pb-24 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-full max-w-2xl mb-4">
          <button
            onClick={() => setIsFormOpen(true)}
            className="w-full bg-[#E67E22] text-white py-4 rounded-2xl font-black text-xl hover:bg-[#D35400] transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            + Add Inspection
          </button>
        </div>

        <div className="w-full max-w-2xl">
          <HistoryFeed hiveId={selectedHiveId!} filter="inspections" />
        </div>

      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center p-3 sm:p-4 pb-24 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="w-full max-w-2xl card p-4 sm:p-5 space-y-5">
        <div>
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Date</h3>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full p-3 rounded-lg bg-gray-50 text-[var(--color-card-text)] font-bold text-base border border-gray-200 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-colors outline-none"
          />
        </div>

        {renderPills('Queen Status', QUEEN_STATUS_OPTIONS, queenStatus, setQueenStatus)}
        {renderPills('Brood Pattern', BROOD_PATTERN_OPTIONS, broodPattern, setBroodPattern)}
        {renderPills('Temperament', TEMPERAMENT_OPTIONS, temperament, setTemperament)}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderPills('Honey Stores', STORES_OPTIONS, honeyStores, setHoneyStores)}
          {renderPills('Pollen Stores', STORES_OPTIONS, pollenStores, setPollenStores)}
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Field Notes</h3>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Tap here to add notes..."
            className="w-full h-24 p-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-colors outline-none resize-none font-medium text-[var(--color-card-text)] placeholder-gray-400"
          />
        </div>

      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[var(--color-bg)] to-[var(--color-bg)]/80 backdrop-blur-sm z-50 flex justify-center gap-3">
        {selectedRecord && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-16 flex-shrink-0 bg-red-500 text-white py-4 rounded-2xl hover:bg-red-600 transition-colors shadow-lg flex items-center justify-center disabled:opacity-50"
          >
            <Trash2 size={24} />
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 max-w-2xl bg-[#E67E22] text-white py-4 rounded-2xl font-black text-xl hover:bg-[#D35400] transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <Save size={24} />
              {selectedRecord ? 'Update' : 'Save'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
