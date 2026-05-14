import React, { useEffect, useState } from 'react';
import { supabase } from '../../data/supabase';
import { useAppStore } from '../../store/useAppStore';

interface HistoryFeedProps {
  hiveId: string;
  filter?: 'inspections' | 'interventions' | 'snapshots' | 'tasks' | 'all';
  refreshTrigger?: number;
}

export const HistoryFeed: React.FC<HistoryFeedProps> = ({ hiveId, filter = 'all', refreshTrigger = 0 }) => {
  const { setCurrentView, selectInspection } = useAppStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const promises = [];
      
      if (filter === 'all' || filter === 'inspections') {
        promises.push(supabase.from('inspections').select('*').eq('hive_id', hiveId).order('timestamp', { ascending: false }).limit(10).then(res => ({ type: 'inspection', data: res.data })));
      }
      if (filter === 'all' || filter === 'interventions') {
        promises.push(supabase.from('interventions').select('*').eq('hive_id', hiveId).order('timestamp', { ascending: false }).limit(10).then(res => ({ type: 'intervention', data: res.data })));
      }
      if (filter === 'all' || filter === 'snapshots') {
        promises.push(supabase.from('hive_snapshots').select('*').eq('hive_id', hiveId).order('timestamp', { ascending: false }).limit(10).then(res => ({ type: 'snapshot', data: res.data })));
      }
      if (filter === 'all' || filter === 'tasks') {
        // use created_at for tasks, or due_date depending on schema. Let's use created_at.
        promises.push(supabase.from('tasks').select('*').eq('hive_id', hiveId).order('created_at', { ascending: false }).limit(10).then(res => ({ type: 'task', data: res.data })));
      }

      const results = await Promise.all(promises);
      
      let merged: any[] = [];
      results.forEach(res => {
        const items = (res.data || []).map(i => ({ ...i, _model_type: res.type, timestamp: i.timestamp || i.created_at || new Date().toISOString() }));
        merged = [...merged, ...items];
      });
      
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setHistory(merged.slice(0, 10));
      setLoading(false);
    };

    fetchHistory();
  }, [hiveId, filter, refreshTrigger]);

  if (loading) {
    return (
      <div className="card p-8 text-center border-dashed border-2">
        <p className="text-gray-500 font-medium">Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="card p-8 text-center border-dashed border-2">
        <p className="text-gray-500 font-medium">No recent history found.</p>
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
    
    const colors: any = { inactive: '#F3F4F6', active: '#93C5FD', empty: '#FFFFFF', brood: '#8B4513', resource: '#F59E0B', follower_board: '#1F2937' };
    
    return (
      <div className="flex gap-[1px] mt-1.5 bg-white p-1.5 rounded border border-gray-100 overflow-x-hidden w-full max-w-full">
        {parsed.map((b: any) => (
          <div key={b.position} className="w-1.5 h-5 rounded-[1px] border border-gray-300" style={{ backgroundColor: colors[b.status] || colors.inactive }} />
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
    
    const colors: any = { deep: '#D35400', medium: '#E67E22', shallow: '#F39C12', feeder: '#DBEAFE', inner_cover: '#FEF3C7', slatted_rack: '#F5E1DA', excluder: '#F3F4F6' };
    const heights: any = { deep: 'h-4', medium: 'h-3', shallow: 'h-2', feeder: 'h-2', inner_cover: 'h-1', slatted_rack: 'h-1.5', excluder: 'h-0.5' };
    
    return (
      <div className="flex flex-col items-center gap-[1px] mt-3 bg-white p-2 rounded border border-gray-100 w-full max-w-full">
        {parsed.map((b: any) => (
          <div key={b.id} className={`w-12 border border-black/20 ${heights[b.type] || 'h-2'}`} style={{ backgroundColor: colors[b.type] || '#ccc' }} />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {history.map((item) => (
        <div 
          key={`${item._model_type}-${item.id}`} 
          onClick={async () => {
            if (item._model_type === 'snapshot') {
              if (window.confirm('Delete this configuration snapshot?')) {
                const { error } = await supabase.from('hive_snapshots').delete().eq('id', item.id);
                if (error) {
                  alert('Failed to delete snapshot: ' + error.message);
                } else {
                  setHistory(prev => prev.filter(h => h.id !== item.id));
                }
              }
              return;
            }
            selectInspection(item);
            let targetView = 'INSPECTION_FORM';
            if (item._model_type === 'intervention') targetView = 'INTERVENTION_FORM';
            if (item._model_type === 'task') targetView = 'TASK_FORM';
            
            if (typeof window !== 'undefined') {
              window.history.pushState({ view: targetView }, '');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            setCurrentView(targetView as any);
          }}
          className={`card p-2.5 sm:p-3 border-l-4 transition-colors ${
            item._model_type === 'snapshot' ? 'border-blue-400 bg-blue-50/10 cursor-default' : 
            item._model_type === 'intervention' ? 'border-purple-500 bg-purple-50/20 cursor-pointer hover:bg-[#FFFBF0]' : 
            item._model_type === 'task' ? 'border-cyan-500 bg-cyan-50/10 cursor-pointer hover:bg-[#FFFBF0]' :
            'border-[#E67E22] cursor-pointer hover:bg-[#FFFBF0]'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              {item._model_type !== 'snapshot' && (
                <h4 className={`font-bold text-sm ${
                  item._model_type === 'intervention' ? 'text-purple-700' : 
                  item._model_type === 'task' ? 'text-cyan-700' :
                  'text-[var(--color-card-text)]'
                }`}>
                  {item._model_type === 'intervention' ? `Intervention: ${item.type || 'Other'}` : 
                   item._model_type === 'task' ? `Task: ${item.title}` :
                   'Inspection'}
                </h4>
              )}
              <p className="text-[11px] sm:text-xs text-gray-500 font-bold uppercase tracking-wide">
                {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
            </div>
            {item._model_type !== 'snapshot' && (
              <span className={`text-xs font-bold ${
                item._model_type === 'intervention' ? 'text-purple-500' : 
                item._model_type === 'task' ? 'text-cyan-500' :
                'text-[#E67E22]'
              }`}>Edit</span>
            )}
          </div>
          
          {item._model_type === 'snapshot' && item.bars && (
            (() => {
              let parsed = [];
              try { parsed = typeof item.bars === 'string' ? JSON.parse(item.bars) : item.bars; } catch(e) {}
              if (!Array.isArray(parsed) || parsed.length === 0) return null;
              
              // Langstroth boxes use 'type' (deep, medium, shallow)
              // TBH bars use 'status' (empty, brood, resource)
              if (parsed[0].type !== undefined) {
                return renderMiniBoxes(parsed);
              } else {
                return renderMiniBars(parsed);
              }
            })()
          )}

          {(item.observations || item.description || (item._model_type === 'task' && item.description)) && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              {item.observations || item.description}
            </p>
          )}
          {item._model_type === 'task' && (
            <div className="mt-2 flex gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>{item.status || 'pending'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                item.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>Priority: {item.priority || 'medium'}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
