import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { CheckCircle, AlertTriangle, Skull, Wind, Archive } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active', icon: <CheckCircle size={32} />, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-500', desc: 'Hive is healthy and active' },
  { value: 'Needs Attention', label: 'Needs Attention', icon: <AlertTriangle size={32} />, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-500', desc: 'Requires immediate inspection' },
  { value: 'Swarmed', label: 'Swarmed', icon: <Wind size={32} />, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-500', desc: 'Colony has recently swarmed' },
  { value: 'Deadout', label: 'Deadout', icon: <Skull size={32} />, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-500', desc: 'Colony did not survive' },
  { value: 'Inactive', label: 'Inactive / Stored', icon: <Archive size={32} />, color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-500', desc: 'Equipment currently in storage' },
];

export const StatusUpdateView: React.FC = () => {
  const { selectedHiveId, setCurrentView } = useAppStore();
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedHiveId) return;
    setLoading(true);

    try {
      // 1. Update the hive status
      const { error: hiveError } = await supabase
        .from('hives')
        .update({ status: newStatus })
        .eq('id', selectedHiveId);
        
      if (hiveError) throw hiveError;

      // 2. Automatically log an intervention note about the status change
      const { error: interventionError } = await supabase
        .from('interventions')
        .insert([{
          hive_id: selectedHiveId,
          type: 'Status Change',
          description: `Hive status updated to: ${newStatus}`,
          timestamp: new Date().toISOString()
        }]);

      if (interventionError) throw interventionError;

      if (typeof window !== 'undefined') {
        window.history.pushState({ view: 'HIVE_DETAIL' }, '');
      }
      setCurrentView('HIVE_DETAIL');

    } catch (error: any) {
      alert('Error updating status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center p-4 pb-20 space-y-6 animate-in slide-in-from-bottom-8">
      
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-2">
        <div>
          <h2 className="text-2xl font-black text-[var(--color-card-text)]">Update Status</h2>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Select new hive state</p>
        </div>
        <button 
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({ view: 'HIVE_DETAIL' }, '');
            }
            setCurrentView('HIVE_DETAIL');
          }}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 active:scale-95"
        >
          ✕
        </button>
      </div>

      <div className="w-full max-w-2xl space-y-3">
        {loading && (
          <div className="p-8 flex justify-center">
             <div className="w-10 h-10 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && STATUS_OPTIONS.map((status) => (
          <button
            key={status.value}
            onClick={() => handleUpdateStatus(status.value)}
            className={`w-full p-5 rounded-2xl flex items-center gap-4 border-2 transition-transform active:scale-95 hover:bg-white bg-gray-50 border-gray-200 text-left`}
          >
            <div className={`p-4 rounded-xl ${status.bg} ${status.color}`}>
              {status.icon}
            </div>
            <div>
              <h3 className={`text-lg font-black ${status.color}`}>{status.label}</h3>
              <p className="text-sm font-bold text-gray-500">{status.desc}</p>
            </div>
          </button>
        ))}
      </div>

    </div>
  );
};
