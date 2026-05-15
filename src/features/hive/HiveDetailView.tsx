import React, { useEffect, useState } from 'react';
import { fetchHiveDetail } from '../../data/hiveRepository';
import { useAppStore } from '../../store/useAppStore';
import { ClipboardList, PlusCircle, AlertTriangle } from 'lucide-react';
import { HistoryFeed } from '../../shared/components/HistoryFeed';
import { HiveConfigWrapper } from './HiveConfigWrapper';

export const HiveDetailView: React.FC = () => {
  const { selectedHiveId, navigateTo } = useAppStore();
  const [hive, setHive] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchHiveDetails = async () => {
      if (!selectedHiveId) return;
      
      const data = await fetchHiveDetail(selectedHiveId);

      if (data) setHive(data);
      setLoading(false);
    };

    fetchHiveDetails();
  }, [selectedHiveId, refreshKey]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
        <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-[var(--color-text-muted)]">Loading hive data...</p>
      </div>
    );
  }

  if (!hive) return <div className="p-4 text-center text-[var(--color-text-muted)]">Hive not found.</div>;

  return (
    <div className="w-full flex flex-col items-center p-3 sm:p-4 pb-28 space-y-4">
      
      {/* 1. Hive Status Summary Card */}
      <div className="w-full max-w-2xl card p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--color-primary)] rounded-l-2xl"></div>
        <div className="flex justify-between items-start pl-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text)]">{hive.name}</h2>
            <p className="text-xs sm:text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
              Type: {hive.type || 'Standard TBH'}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase ${
            (hive.status || 'Active') === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {hive.status || 'Active'}
          </span>
        </div>
      </div>

      {/* 2. Interactive Hive Config */}
      <div className="w-full max-w-2xl">
        <HiveConfigWrapper 
          hive={hive} 
          onSnapshotSaved={() => setRefreshKey(prev => prev + 1)} 
        />
      </div>

      {/* 3. Complete Hive History */}
      <div className="w-full max-w-2xl">
        <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 px-1">Hive Configuration History</h3>
        <HistoryFeed hiveId={hive.id} filter="snapshots" refreshTrigger={refreshKey} />
      </div>

      {/* Fixed Bottom Action Bar — 3 primary actions */}
      <div className="bottom-action-bar">
        <button 
          onClick={() => {
            useAppStore.getState().selectInspection(null);
            navigateTo('INSPECTION_FORM');
          }}
          className="flex-1 max-w-[140px] btn-honey py-3.5 text-xs flex-col gap-1"
        >
          <ClipboardList size={20} />
          Inspection
        </button>
        
        <button 
          onClick={() => {
            useAppStore.getState().selectInspection(null);
            navigateTo('INTERVENTION_FORM');
          }}
          className="flex-1 max-w-[140px] bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-3.5 rounded-full font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm"
        >
          <PlusCircle size={20} />
          Intervention
        </button>

        <button 
          onClick={() => {
            useAppStore.getState().selectInspection(null);
            navigateTo('TASK_FORM');
          }}
          className="flex-1 max-w-[140px] bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-3.5 rounded-full font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm"
        >
          <AlertTriangle size={20} />
          Task
        </button>
      </div>

    </div>
  );
};
