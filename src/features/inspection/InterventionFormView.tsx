import React, { useState } from 'react';
import { supabase } from '../../data/supabase';
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
  
  // Note: selectedRecord carries the record to edit via the typed discriminated union
  // for editing. It's technically an intervention if we're here.
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
    if (isEditing) {
      const { error: updateError } = await supabase
        .from('interventions')
        .update(payload)
        .eq('id', selectedRecord.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('interventions')
        .insert([payload]);
      error = insertError;
    }

    setLoading(false);
    
    if (error) {
      alert('Failed to save intervention: ' + error.message);
    } else {
      selectInspection(null); // Clear editing state
      goBack(); // Return to Hive Details
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    if (!confirm('Are you sure you want to delete this intervention?')) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('interventions')
      .delete()
      .eq('id', selectedRecord.id);
      
    setLoading(false);
    
    if (error) {
      alert('Failed to delete intervention: ' + error.message);
    } else {
      selectInspection(null);
      goBack();
    }
  };

  if (!isFormOpen) {
    return (
      <div className="w-full flex flex-col items-center p-4 pb-24 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-full max-w-2xl mb-4">
          <button
            onClick={() => setIsFormOpen(true)}
            className="w-full bg-[#E67E22] text-white py-4 rounded-2xl font-black text-xl hover:bg-[#D35400] transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95"
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

        <div>
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Intervention Type</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INTERVENTION_TYPES.map((opt) => (
              <button 
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                  type === opt.value 
                    ? opt.value === 'requeen' 
                      ? 'border-purple-500 bg-purple-500/10 text-purple-600'
                      : 'border-[#E67E22] bg-[#E67E22]/10 text-[#E67E22]' 
                    : 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-gray-100'
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

        <div>
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Details</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'requeen' ? 'Queen source, markings, reason for replacement...' : 'Tap here to add details...'}
            className="w-full h-24 p-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-colors outline-none resize-none font-medium text-[var(--color-card-text)] placeholder-gray-400"
          />
        </div>

      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[var(--color-bg)] to-[var(--color-bg)]/80 backdrop-blur-sm z-50 flex justify-center gap-3">
        {isEditing && (
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
              {isEditing ? 'Update' : 'Save'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
