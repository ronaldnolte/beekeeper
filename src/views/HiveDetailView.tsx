import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { ClipboardList, PlusCircle, AlertTriangle } from 'lucide-react';
import { HistoryFeed } from '../components/HistoryFeed';
import { HiveConfigWrapper } from '../components/HiveConfigWrapper';

export const HiveDetailView: React.FC = () => {
  const { selectedHiveId, setCurrentView } = useAppStore();
  const [hive, setHive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchHiveDetails = async () => {
      if (!selectedHiveId) return;
      
      const { data } = await supabase
        .from('hives')
        .select('*')
        .eq('id', selectedHiveId)
        .single();

      if (data) setHive(data);
      setLoading(false);
    };

    fetchHiveDetails();
  }, [selectedHiveId, refreshKey]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
        <div className="w-10 h-10 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-[var(--color-text)]">Loading hive data...</p>
      </div>
    );
  }

  if (!hive) return <div className="p-4 text-center">Hive not found.</div>;

  return (
    <div className="w-full flex flex-col items-center p-3 sm:p-4 pb-20 space-y-4">
      
      {/* 1. Hive Status Summary Card */}
      <div className="w-full max-w-2xl card p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#E67E22]"></div>
        <div className="flex justify-between items-start pl-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-card-text)]">{hive.name}</h2>
            <p className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mt-0.5">
              Type: {hive.type || 'Standard TBH'}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase ${
            hive.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {hive.status || 'Unknown'}
          </span>
        </div>
      </div>

      {/* 2. Interactive Hive Config */}
      <HiveConfigWrapper 
        hive={hive} 
        onSnapshotSaved={() => setRefreshKey(prev => prev + 1)} 
      />

      {/* 3. Primary Action Grid (Compact 3-column row) */}
      <div className="w-full max-w-2xl">
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={() => {
              useAppStore.getState().selectInspection(null);
              if (typeof window !== 'undefined') {
                window.history.pushState({ view: 'INSPECTION_FORM' }, '');
              }
              setCurrentView('INSPECTION_FORM');
            }}
            className="card p-2 sm:p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-[#FFFBF0] transition-colors border-2 border-transparent hover:border-[#E67E22] group"
          >
            <div className="text-[#E67E22] group-hover:scale-110 transition-transform">
              <ClipboardList size={24} />
            </div>
            <span className="font-bold text-[10px] sm:text-xs text-[var(--color-card-text)] whitespace-nowrap">Inspect</span>
          </button>
          
          <button 
            onClick={() => {
              useAppStore.getState().selectInspection(null);
              if (typeof window !== 'undefined') {
                window.history.pushState({ view: 'INTERVENTION_FORM' }, '');
              }
              setCurrentView('INTERVENTION_FORM');
            }}
            className="card p-2 sm:p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-[#FFFBF0] transition-colors border-2 border-transparent hover:border-[#E67E22] group"
          >
            <div className="text-[#E67E22] group-hover:scale-110 transition-transform">
              <PlusCircle size={24} />
            </div>
            <span className="font-bold text-[10px] sm:text-xs text-[var(--color-card-text)] whitespace-nowrap">Intervene</span>
          </button>

          <button 
            onClick={() => {
              useAppStore.getState().selectInspection(null);
              if (typeof window !== 'undefined') {
                window.history.pushState({ view: 'TASK_FORM' }, '');
              }
              setCurrentView('TASK_FORM');
            }}
            className="card p-2 sm:p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-[#FFFBF0] transition-colors border-2 border-transparent hover:border-[#E67E22] group"
          >
            <div className="text-[#E67E22] group-hover:scale-110 transition-transform">
              <AlertTriangle size={24} />
            </div>
            <span className="font-bold text-[10px] sm:text-xs text-[var(--color-card-text)] whitespace-nowrap">Task</span>
          </button>
        </div>
      </div>

      {/* 4. Complete Hive History */}
      <div className="w-full max-w-2xl">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Hive Configuration History</h3>
        <HistoryFeed hiveId={hive.id} filter="snapshots" refreshTrigger={refreshKey} />
      </div>

    </div>
  );
};
