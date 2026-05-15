import React, { useEffect, useState } from 'react';
import { fetchHistoryFeed, deleteSnapshot } from '../../data/feedbackRepository';
import { useAppStore } from '../../store/useAppStore';
import { ChevronRight } from 'lucide-react';

interface HistoryFeedProps {
  hiveId: string;
  filter?: 'inspections' | 'interventions' | 'snapshots' | 'tasks' | 'all';
  refreshTrigger?: number;
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({ hiveId, filter = 'all', refreshTrigger = 0 }) => {
  const { navigateTo, selectInspection } = useAppStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const merged = await fetchHistoryFeed(hiveId, filter);
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
    
    const colors: any = { inactive: '#334155', active: '#93C5FD', empty: '#1E293B', brood: '#92400E', resource: '#F59E0B', follower_board: '#1E293B' };
    
    return (
      <div className="flex gap-[1px] mt-1.5 bg-[var(--color-input-bg)] p-1.5 rounded-lg border border-[var(--color-card-border)] overflow-x-hidden w-full max-w-full">
        {parsed.map((b: any) => (
          <div key={b.position} className="w-1.5 h-5 rounded-[1px] border border-[var(--color-card-border)]" style={{ backgroundColor: colors[b.status] || colors.inactive }} />
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
    
    const colors: any = { deep: '#D97706', medium: '#F59E0B', shallow: '#FBBF24', feeder: '#DBEAFE', inner_cover: '#FEF3C7', slatted_rack: '#F5E1DA', excluder: '#334155' };
    const heights: any = { deep: 'h-4', medium: 'h-3', shallow: 'h-2', feeder: 'h-2', inner_cover: 'h-1', slatted_rack: 'h-1.5', excluder: 'h-0.5' };
    
    return (
      <div className="flex flex-col items-center gap-[1px] mt-3 bg-[var(--color-input-bg)] p-2 rounded-lg border border-[var(--color-card-border)] w-full max-w-full">
        {parsed.map((b: any) => (
          <div key={b.id} className={`w-12 border border-black/30 ${heights[b.type] || 'h-2'}`} style={{ backgroundColor: colors[b.type] || '#3D3226' }} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {history.map((item) => (
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
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
            navigateTo(targetView as any);
          }}
          className={`card p-3 border-l-4 transition-colors ${
            item._model_type === 'snapshot' ? 'border-blue-500/60 cursor-default' : 
            item._model_type === 'intervention' ? 'border-purple-500/60 cursor-pointer hover:border-purple-400' : 
            item._model_type === 'task' ? 'border-cyan-500/60 cursor-pointer hover:border-cyan-400' :
            'border-[var(--color-primary)] cursor-pointer hover:border-[var(--color-primary)]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              {item._model_type !== 'snapshot' && (
                <h4 className={`font-bold text-sm ${
                  item._model_type === 'intervention' ? 'text-purple-400' : 
                  item._model_type === 'task' ? 'text-cyan-400' :
                  'text-[var(--color-text)]'
                }`}>
                  {item._model_type === 'intervention' ? `Intervention: ${item.type || 'Other'}` : 
                   item._model_type === 'task' ? `Task: ${item.title}` :
                   'Inspection'}
                </h4>
              )}
              <p className="text-[11px] sm:text-xs text-[var(--color-text-muted)] font-bold uppercase tracking-wide">
                {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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

          {(item.observations || item.description || (item._model_type === 'task' && item.description)) && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)] line-clamp-2">
              {item.observations || item.description}
            </p>
          )}
          {item._model_type === 'task' && (
            <div className="mt-2 flex gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                item.status === 'completed' ? 'bg-green-900/30 text-green-400' : 'bg-amber-900/30 text-amber-400'
              }`}>{item.status || 'pending'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                item.priority === 'high' ? 'bg-red-900/30 text-red-400' : 'bg-[var(--color-input-bg)] text-[var(--color-text-muted)]'
              }`}>Priority: {item.priority || 'medium'}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
