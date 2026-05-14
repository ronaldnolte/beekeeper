import React, { useState, useEffect } from 'react';
import { supabase } from '../../data/supabase';
import { Camera } from 'lucide-react';

interface BarState {
  position: number;
  status: 'inactive' | 'active' | 'empty' | 'brood' | 'resource' | 'follower_board';
}

const BAR_COLORS: Record<string, string> = {
  inactive: '#F3F4F6',      // Very light gray
  active: '#93C5FD',        // Light blue
  empty: '#FFFFFF',         // White
  brood: '#8B4513',         // Saddle Brown
  resource: '#F59E0B',      // Amber/Gold
  follower_board: '#1F2937', // Dark gray
};

const STATUS_CYCLE: BarState['status'][] = [
  'inactive', 'active', 'empty', 'brood', 'resource', 'follower_board'
];

interface TopBarVisualizerProps {
  hiveId: string;
  initialBars: BarState[] | null;
  onSnapshotSaved?: () => void;
}

export const TopBarVisualizer: React.FC<TopBarVisualizerProps> = ({ hiveId, initialBars, onSnapshotSaved }) => {
  const [bars, setBars] = useState<BarState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize bars
  useEffect(() => {
    if (initialBars && initialBars.length > 0) {
      setBars(initialBars);
    } else {
      // Create 30 default bars if none exist
      const defaultBars = Array.from({ length: 30 }, (_, i) => ({
        position: i + 1,
        status: 'inactive' as const
      }));
      setBars(defaultBars);
    }
  }, [initialBars]);

  const handleBarTap = (position: number) => {
    setBars(current => {
      const newBars = [...current];
      const index = newBars.findIndex(b => b.position === position);
      if (index === -1) return current;

      const currentStatus = newBars[index].status;
      const nextIndex = (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
      newBars[index] = { ...newBars[index], status: STATUS_CYCLE[nextIndex] };
      
      return newBars;
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveSnapshot = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. Update the hive's current state
      const { error: hiveError } = await supabase
        .from('hives')
        .update({ bars: bars })
        .eq('id', hiveId);

      if (hiveError) throw hiveError;

      // 2. Compute stats for the snapshot
      const inactiveCount = bars.filter(b => b.status === 'inactive').length;
      const activeCount = bars.filter(b => b.status === 'active').length;
      const emptyCount = bars.filter(b => b.status === 'empty').length;
      const broodCount = bars.filter(b => b.status === 'brood').length;
      const resourceCount = bars.filter(b => b.status === 'resource').length;
      const followerBoardPosition = bars.find(b => b.status === 'follower_board')?.position || null;

      // 3. Create the historical snapshot
      const { error: snapError } = await supabase
        .from('hive_snapshots')
        .insert([{
          hive_id: hiveId,
          timestamp: new Date().toISOString(),
          bars: bars,
          inactive_bar_count: inactiveCount,
          active_bar_count: activeCount,
          empty_bar_count: emptyCount,
          brood_bar_count: broodCount,
          resource_bar_count: resourceCount,
          follower_board_position: followerBoardPosition
        }]);

      if (snapError) throw snapError;

      setHasUnsavedChanges(false);
      if (onSnapshotSaved) onSnapshotSaved();

    } catch (error: any) {
      alert('Failed to save snapshot: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (bars.length === 0) return null;

  return (
    <div className="w-full card overflow-hidden flex flex-col relative border-2 border-transparent focus-within:border-[#E67E22] transition-colors">
      <div className="flex justify-between items-center p-3 bg-gray-50 border-b border-gray-100">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Top Bar Config</h3>
        <button
          onClick={handleSaveSnapshot}
          disabled={!hasUnsavedChanges || isSaving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            hasUnsavedChanges
              ? 'bg-[#E67E22] text-white shadow-md active:scale-95'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {isSaving ? (
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Camera size={14} />
          )}
          {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save Snapshot' : 'Saved'}
        </button>
      </div>

      {/* The Scrollable Bar Array */}
      <div className="w-full overflow-x-auto p-4 custom-scrollbar">
        <div className="flex gap-0 w-max mx-auto px-2">
          {bars.map((bar) => (
            <button
              key={bar.position}
              onClick={() => handleBarTap(bar.position)}
              className="w-8 sm:w-10 h-28 sm:h-32 relative border border-gray-400 rounded-sm shadow-sm transition-transform active:scale-95 flex flex-col justify-end overflow-hidden group -ml-[1px] first:ml-0"
              style={{ backgroundColor: BAR_COLORS[bar.status], zIndex: 1 }}
            >
              <div className="w-full bg-black/20 py-1 text-center backdrop-blur-sm">
                <span className={`text-[10px] font-black ${
                  ['empty', 'inactive'].includes(bar.status) ? 'text-gray-700' : 'text-white'
                }`}>
                  {bar.position}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-3 bg-white grid grid-cols-3 gap-2 border-t border-gray-100">
        {Object.entries(BAR_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-[2px] border border-gray-300 shadow-inner" style={{ backgroundColor: color }}></div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              {status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
