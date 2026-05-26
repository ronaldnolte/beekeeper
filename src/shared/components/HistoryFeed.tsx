import React, { useEffect, useState } from 'react';
import { fetchHistoryFeed, deleteSnapshot } from '../../data/feedbackRepository';
import { useAppStore } from '../../store/useAppStore';
import { ChevronRight } from 'lucide-react';

interface HistoryFeedProps {
  hiveId: string;
  filter?: 'inspections' | 'interventions' | 'snapshots' | 'tasks' | 'varroa_tests' | 'all';
  refreshTrigger?: number;
  title?: string;
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({ hiveId, filter = 'all', refreshTrigger = 0, title }) => {
  const { navigateTo, selectInspection } = useAppStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      const merged = await fetchHistoryFeed(hiveId, filter);
      console.log(`[HistoryFeed] Loaded ${merged.length} items for hive ${hiveId} (filter: ${filter}):`, merged);
      setHistory(merged);
      setLoading(false);
    };

    load();
  }, [hiveId, filter, refreshTrigger]);

  if (loading) {
    return (
      <div className="card p-8 text-center border-dashed border-2 border-[var(--color-card-border)]">
        <p className="text-[var(--color-text-muted)] font-medium">Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="card p-8 text-center border-dashed border-2 border-[var(--color-card-border)]">
        <p className="text-[var(--color-text-muted)] font-medium">No recent history found.</p>
      </div>
    );
  }

  // Helper to render mini top bars
  const renderMiniBars = (bars: any) => {
    let parsed = [];
    try {
      parsed = typeof bars === 'string' ? JSON.parse(bars) : bars;
    } catch(e) {}
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    
    const colors: any = { 
      inactive: '#E5E7EB',      // Light gray
      active: '#93C5FD',        // Light blue
      empty: '#FFFFFF',         // White
      brood: '#8B4513',         // Saddle Brown
      resource: '#F59E0B',      // Amber/Gold
      follower_board: '#1F2937' // Dark gray
    };
    
    return (
      <div className="flex gap-[1px] mt-1.5 bg-[var(--color-input-bg)] p-1.5 rounded-lg border border-[var(--color-card-border)] overflow-x-hidden w-full max-w-full">
        {parsed.map((b: any) => (
          <div key={b.position} className="w-1.5 h-5 rounded-[1px] border border-black/10 shadow-sm" style={{ backgroundColor: colors[b.status] || colors.inactive }} />
        ))}
      </div>
    );
  };

  // Helper to render mini langstroth boxes
  const renderMiniBoxes = (boxes: any) => {
    let parsed = [];
    try {
      parsed = typeof boxes === 'string' ? JSON.parse(boxes) : boxes;
    } catch(e) {}
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    
    const colors: any = { 
      deep: '#C47F0A',          // var(--color-primary-dark)
      medium: '#E99B1A',        // var(--color-primary)
      shallow: '#F39C12',       // Shallow Gold
      feeder: '#DBEAFE',        // Top Feeder Blue
      inner_cover: '#FEF3C7',   // Inner Cover Yellow
      slatted_rack: '#F5E1DA',  // Slatted Rack Peach
      excluder: '#F3F4F6'       // Excluder Gray
    };
    const heights: any = { deep: 'h-4', medium: 'h-3', shallow: 'h-2', feeder: 'h-2', inner_cover: 'h-1', slatted_rack: 'h-1.5', excluder: 'h-0.5' };
    
    return (
      <div className="flex flex-col items-center gap-[1px] mt-3 bg-[var(--color-input-bg)] p-2 rounded-lg border border-[var(--color-card-border)] w-full max-w-full">
        {parsed.map((b: any) => (
          <div key={b.id} className={`w-12 border border-black/20 ${heights[b.type] || 'h-2'}`} style={{ backgroundColor: colors[b.type] || '#3D3226' }} />
        ))}
      </div>
    );
  };

  const defaultTitles: Record<string, string> = {
    inspections: 'Inspection History',
    interventions: 'Intervention History',
    tasks: 'Task History',
    snapshots: 'Configuration History',
    varroa_tests: 'Mite Test History',
    all: 'Recent History'
  };
  const activeTitle = title || defaultTitles[filter] || 'Recent History';

  const displayedHistory = !showAll 
    ? history.slice(0, 3) 
    : history;

  console.log(`[HistoryFeed] Rendering ${displayedHistory.length} of ${history.length} items (filter: ${filter}, showAll: ${showAll})`);

  return (
    <div className="space-y-3">
      {activeTitle && (
        <div className="flex justify-between items-center mb-3.5 px-1">
          <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{activeTitle}</h3>
          {history.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-white border border-[var(--color-primary)]/30 hover:border-[var(--color-primary)] text-[var(--color-primary-dark)] hover:text-[var(--color-primary-dark)] font-bold text-xs active:scale-95 transition-all shadow-sm outline-none cursor-pointer flex items-center justify-center gap-1.5"
            >
              {showAll ? 'Show Less' : `Show All (${history.length})`}
            </button>
          )}
        </div>
      )}
      {displayedHistory.map((item) => (
        <div 
          key={`${item._model_type}-${item.id}`} 
          onClick={async () => {
            if (item._model_type === 'snapshot') {
              if (window.confirm('Delete this configuration snapshot?')) {
                try {
                  await deleteSnapshot(item.id);
                  setHistory(prev => prev.filter(h => h.id !== item.id));
                } catch (e: any) {
                  alert('Failed to delete snapshot: ' + e.message);
                }
              }
              return;
            }
            selectInspection(item);
            let targetView = 'INSPECTION_FORM';
            if (item._model_type === 'intervention') targetView = 'INTERVENTION_FORM';
            if (item._model_type === 'task') targetView = 'TASK_FORM';
            if (item._model_type === 'varroa_test') targetView = 'VARROA_FORM';
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            navigateTo(targetView as any);
          }}
          className={`card p-3 border-l-4 transition-colors ${
            item._model_type === 'snapshot' ? 'border-blue-500/60 cursor-default' : 
            item._model_type === 'intervention' ? 'border-purple-500/60 cursor-pointer hover:border-purple-400' : 
            item._model_type === 'task' ? 'border-cyan-500/60 cursor-pointer hover:border-cyan-400' :
            item._model_type === 'varroa_test' ? 
              (Number(item.mite_pct) >= Number(item.threshold) * 1.5 ? 'border-red-500/60 cursor-pointer hover:border-red-400' : 
               Number(item.mite_pct) >= Number(item.threshold) ? 'border-amber-500/60 cursor-pointer hover:border-amber-400' : 
               'border-green-500/60 cursor-pointer hover:border-green-400') :
            'border-[var(--color-primary)] cursor-pointer hover:border-[var(--color-primary)]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              {item._model_type !== 'snapshot' && (
                <h4 className={`font-bold text-sm ${
                  item._model_type === 'intervention' ? 'text-purple-400' : 
                  item._model_type === 'task' ? 'text-cyan-400' :
                  item._model_type === 'varroa_test' ? 
                    (Number(item.mite_pct) >= Number(item.threshold) * 1.5 ? 'text-red-400' : 
                     Number(item.mite_pct) >= Number(item.threshold) ? 'text-amber-400' : 
                     'text-green-400') :
                  'text-[var(--color-text)]'
                }`}>
                  {item._model_type === 'intervention' ? `Intervention: ${item.type || 'Other'}` : 
                   item._model_type === 'task' ? `Task: ${item.title}` :
                   item._model_type === 'varroa_test' ? `Mite Test: ${Number(item.mite_pct).toFixed(1)}% Load` :
                   'Inspection'}
                </h4>
              )}
              <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wide">
                {new Date(item.tested_at || item.timestamp).toLocaleDateString()} {new Date(item.tested_at || item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
            {item._model_type !== 'snapshot' && (
              <ChevronRight size={18} className="text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
            )}
          </div>
          
          {item._model_type === 'snapshot' && item.bars && (
            (() => {
              let parsed = [];
              try { parsed = typeof item.bars === 'string' ? JSON.parse(item.bars) : item.bars; } catch(e) {}
              if (!Array.isArray(parsed) || parsed.length === 0) return null;
              
              if (parsed[0].type !== undefined) {
                return renderMiniBoxes(parsed);
              } else {
                return renderMiniBars(parsed);
              }
            })()
          )}

          {(item.observations || item.description || item.notes || (item._model_type === 'task' && item.description)) && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)] line-clamp-2">
              {item.observations || item.description || item.notes}
            </p>
          )}
          {item._model_type === 'varroa_test' && (
            <div className="mt-2 flex gap-x-3 text-[10px] bg-[var(--color-input-bg)] px-2 py-1.5 rounded-lg border border-[var(--color-card-border)] w-fit font-bold uppercase text-[var(--color-text-muted)]">
              <span>Bees: <strong className="text-[var(--color-text)]">{item.bee_count}</strong></span>
              <span>Mites: <strong className="text-[var(--color-text)]">{item.mite_count}</strong></span>
              <span>Threshold: <strong className="text-[var(--color-text)]">{item.threshold}%</strong></span>
            </div>
          )}
          {item._model_type === 'task' && (
            <div className="mt-2 flex gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                item.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-amber-900/30 text-amber-400'
              }`}>{item.status || 'pending'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                item.priority === 'high' ? 'bg-red-900/30 text-red-400' : 'bg-[var(--color-input-bg)] text-[var(--color-text-muted)]'
              }`}>{item.priority || 'medium'} Priority</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
