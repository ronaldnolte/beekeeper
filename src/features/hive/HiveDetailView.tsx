import React, { useEffect, useState } from 'react';
import { fetchHiveDetail } from '../../data/hiveRepository';
import { useAppStore } from '../../store/useAppStore';
import { ClipboardList, PlusCircle, AlertTriangle, Hexagon, Microscope } from 'lucide-react';
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
    <div className="w-full h-full flex flex-col overflow-hidden">
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-3 sm:p-4 space-y-4">
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

        {/* 2. Notes */}
        {hive.notes ? (
          <div className="w-full max-w-2xl card p-4">
            <p className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm font-medium text-[var(--color-text)] whitespace-pre-wrap">{hive.notes}</p>
          </div>
        ) : null}

        {/* 3. Interactive Hive Config */}
        <div className="w-full max-w-2xl">
          <HiveConfigWrapper 
            hive={hive} 
            onSnapshotSaved={() => setRefreshKey(prev => prev + 1)} 
          />
        </div>

        {/* Tasks for this hive */}
        <div className="w-full max-w-2xl">
          <HistoryFeed
            hiveId={hive.id}
            filter="tasks"
            refreshTrigger={refreshKey}
            title="Tasks"
          />
        </div>

        {/* 3. Complete Hive History */}
        <div className="w-full max-w-2xl">
          <HistoryFeed
            hiveId={hive.id}
            filter="snapshots"
            refreshTrigger={refreshKey}
            title="Hive Configuration History"
          />
        </div>
      </div>

      {/* Bottom Action Bar — matches BottomNavBar styling */}
      <div className="w-full flex-shrink-0 flex justify-center pt-2 z-40" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 12px))' }}>
        <div className="w-[96%] max-w-lg h-16 rounded-full px-3 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.15)] bg-[#1a1a2e] border border-[#2a2a4a]">
          <button 
            onClick={() => useAppStore.getState().goBack()}
            className="flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-300 select-none outline-none active:scale-95 text-white/50 hover:text-white/80 font-semibold"
          >
            <Hexagon size={20} />
            <span className="text-[10px] mt-1 tracking-tight">Hives</span>
          </button>

          <button 
            onClick={() => {
              useAppStore.getState().selectInspection(null);
              navigateTo('INSPECTION_FORM');
            }}
            className="flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-300 select-none outline-none active:scale-95 text-white/50 hover:text-white/80 font-semibold"
          >
            <ClipboardList size={20} />
            <span className="text-[10px] mt-1 tracking-tight">Inspection</span>
          </button>
          
          <button 
            onClick={() => {
              useAppStore.getState().selectInspection(null);
              navigateTo('INTERVENTION_FORM');
            }}
            className="flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-300 select-none outline-none active:scale-95 text-white/50 hover:text-white/80 font-semibold"
          >
            <PlusCircle size={20} />
            <span className="text-[10px] mt-1 tracking-tight">Intervention</span>
          </button>

          <button 
            onClick={() => {
              useAppStore.getState().selectInspection(null);
              navigateTo('VARROA_FORM');
            }}
            className="flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-300 select-none outline-none active:scale-95 text-white/50 hover:text-white/80 font-semibold"
          >
            <Microscope size={20} />
            <span className="text-[10px] mt-1 tracking-tight">Varroa</span>
          </button>

          <button 
            onClick={() => {
              useAppStore.getState().selectInspection(null);
              navigateTo('TASK_FORM');
            }}
            className="flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-300 select-none outline-none active:scale-95 text-white/50 hover:text-white/80 font-semibold"
          >
            <AlertTriangle size={20} />
            <span className="text-[10px] mt-1 tracking-tight">Task</span>
          </button>
        </div>
      </div>

    </div>
  );
};
