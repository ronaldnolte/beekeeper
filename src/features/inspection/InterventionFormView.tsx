import React, { useState } from 'react';
import { createIntervention, updateIntervention, deleteIntervention } from '../../data/interventionRepository';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2, Droplet, Pill, Wrench, Scissors, Crown, Archive, Hash } from 'lucide-react';
import { HistoryFeed } from '../../shared/components/HistoryFeed';

const INTERVENTION_TYPES = [
  { value: 'feeding', label: 'Feeding', icon: <Droplet size={24} /> },
  { value: 'treatment', label: 'Treatment', icon: <Pill size={24} /> },
  { value: 'manipulation', label: 'Manipulation', icon: <Wrench size={24} /> },
  { value: 'cross_comb_fix', label: 'Cross Comb', icon: <Scissors size={24} /> },
  { value: 'requeen', label: 'Requeen', icon: <Crown size={24} /> },
  { value: 'honey_harvest', label: 'Harvest', icon: <Archive size={24} /> },
  { value: 'other', label: 'Other', icon: <Hash size={24} /> },
];

export const InterventionFormView: React.FC = () => {
  const { selectedHiveId, selectedRecord, goBack, selectInspection } = useAppStore();
  const [loading, setLoading] = useState(false);
  
  const isEditing = !!selectedRecord;
  
  const [date, setDate] = useState(() => {
    if (selectedRecord?.timestamp) {
      return new Date(selectedRecord.timestamp).toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  
  const [type, setType] = useState<string>(selectedRecord?.type || 'feeding');
  const [description, setDescription] = useState(selectedRecord?.description || '');
  const [isFormOpen, setIsFormOpen] = useState(isEditing);

  // Keep form in sync if the user taps a different history item while the form is already open
  React.useEffect(() => {
    if (selectedRecord) {
      setIsFormOpen(true);
      setDate(new Date(selectedRecord.timestamp).toISOString().split('T')[0]);
      setType(selectedRecord.type || 'feeding');
      setDescription(selectedRecord.description || '');
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setType('feeding');
      setDescription('');
    }
  }, [selectedRecord]);

  const handleSave = async () => {
    if (!selectedHiveId) return;
    setLoading(true);

    const payload = {
      hive_id: selectedHiveId,
      timestamp: new Date(date + 'T12:00:00').toISOString(),
      type: type,
      description: description
    };

    let error;
    try {
      if (isEditing) {
        await updateIntervention(selectedRecord.id, payload);
      } else {
        await createIntervention(payload);
      }
    } catch (e: any) {
      error = e;
    }

    setLoading(false);
    
    if (error) {
      alert('Failed to save intervention: ' + error.message);
    } else {
      selectInspection(null);
      goBack();
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    if (!confirm('Are you sure you want to delete this intervention?')) return;
    
    setLoading(true);
    try {
      await deleteIntervention(selectedRecord.id);
      setLoading(false);
      selectInspection(null);
      goBack();
    } catch (e: any) {
      setLoading(false);
      alert('Failed to delete intervention: ' + e.message);
    }
  };

  if (!isFormOpen) {
    return (
      <div className="w-full flex flex-col items-center p-4 pb-28 space-y-4">
        <div className="w-full max-w-2xl mb-4">
          <button
            onClick={() => setIsFormOpen(true)}
            className="w-full bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg transition-colors shadow-lg shadow-[var(--color-primary)]/20 flex items-center justify-center gap-2 active:scale-95"
          >
            + Add Intervention
          </button>
        </div>

        <div className="w-full max-w-2xl">
          <HistoryFeed hiveId={selectedHiveId!} filter="interventions" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center p-3 sm:p-4 pb-28 space-y-4">
      
      {/* Date card */}
      <div className="w-full max-w-2xl card p-4">
        <h3 className="text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
          <span>📅</span> Date
        </h3>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full p-3.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-primary)] font-bold text-base border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none"
        />
      </div>

      {/* Intervention Type card */}
      <div className="w-full max-w-2xl card p-4">
        <h3 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
          <span>🔧</span> Intervention Type
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INTERVENTION_TYPES.map((opt) => (
            <button 
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all min-h-[64px] ${
                type === opt.value 
                  ? opt.value === 'requeen' 
                    ? 'border-purple-500 bg-purple-500/15 text-purple-400'
                    : 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]' 
                  : 'border-[var(--color-card-border)] bg-[var(--color-input-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              <div className={`${type === opt.value ? 'scale-110' : ''} transition-transform`}>
                {opt.icon}
              </div>
              <span className="font-bold text-xs sm:text-sm">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Details card */}
      <div className="w-full max-w-2xl card p-4">
        <h3 className="text-sm font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
          <span>📝</span> Details
        </h3>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === 'requeen' ? 'Queen source, markings, reason for replacement...' : 'Tap here to add details...'}
          className="w-full h-24 p-3.5 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-card-border)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-colors outline-none resize-none font-medium text-[var(--color-text)] placeholder-[var(--color-text-muted)]"
        />
      </div>

      {/* Fixed Bottom Save Bar */}
      <div className="bottom-action-bar">
        {isEditing && (
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
          className="flex-1 max-w-md bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg transition-colors shadow-lg shadow-[var(--color-primary)]/30 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
        >
          {loading ? (
            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <Save size={22} />
              {isEditing ? 'Update' : 'Save'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
