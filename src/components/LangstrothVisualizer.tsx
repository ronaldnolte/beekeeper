import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import type { HiveBox, BoxType } from '@tbh-beekeeper/shared';

const BOX_STYLES: Record<BoxType, { label: string, bg: string, height: string, border: string }> = {
  deep: { label: 'Deep', bg: '#D35400', height: 'h-24', border: '#A04000' },
  medium: { label: 'Medium', bg: '#E67E22', height: 'h-16', border: '#BA4A00' },
  shallow: { label: 'Shallow', bg: '#F39C12', height: 'h-12', border: '#D68910' },
  feeder: { label: 'Top Feeder', bg: '#DBEAFE', height: 'h-14', border: '#93C5FD' },
  inner_cover: { label: 'Inner Cover', bg: '#FEF3C7', height: 'h-6', border: '#FDE68A' },
  slatted_rack: { label: 'Slatted Rack', bg: '#F5E1DA', height: 'h-10', border: '#E6B8A2' },
  excluder: { label: 'Excluder', bg: '#F3F4F6', height: 'h-4', border: '#D1D5DB' },
};

interface LangstrothVisualizerProps {
  hiveId: string;
  initialBoxes: HiveBox[] | null;
  onSnapshotSaved?: () => void;
}

export const LangstrothVisualizer: React.FC<LangstrothVisualizerProps> = ({ hiveId, initialBoxes, onSnapshotSaved }) => {
  const [boxes, setBoxes] = useState<HiveBox[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);

  useEffect(() => {
    if (initialBoxes) {
      setBoxes(initialBoxes);
    }
  }, [initialBoxes]);

  const updateStack = (newBoxes: HiveBox[]) => {
    setBoxes(newBoxes);
    setHasUnsavedChanges(true);
  };

  const addBox = (type: BoxType) => {
    const newBox: HiveBox = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      frames: 10 // default
    };
    // Add to top of stack (index 0)
    updateStack([newBox, ...boxes]);
  };

  const moveBox = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === boxes.length - 1) return;

    const newBoxes = [...boxes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newBoxes[index];
    newBoxes[index] = newBoxes[targetIndex];
    newBoxes[targetIndex] = temp;

    updateStack(newBoxes);
  };

  const removeBox = (id: string) => {
    updateStack(boxes.filter(b => b.id !== id));
    setExpandedBoxId(null);
  };

  const handleSaveSnapshot = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const { error: hiveError } = await supabase
        .from('hives')
        .update({ boxes: boxes })
        .eq('id', hiveId);

      if (hiveError) throw hiveError;

      const { error: snapError } = await supabase
        .from('hive_snapshots')
        .insert([{
          hive_id: hiveId,
          timestamp: new Date().toISOString(),
          boxes: boxes
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

  return (
    <div className="w-full flex flex-col items-center gap-6">
      
      {/* Visualizer Card */}
      <div className="w-full card overflow-hidden flex flex-col relative border-2 border-transparent">
        <div className="flex justify-between items-center p-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Vertical Stack</h3>
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

        <div className="w-full p-6 flex flex-col items-center bg-[#fdfaf5]">
          {/* Outer Cover (Static Top) */}
          <div className="w-64 h-8 bg-[#E6DCC3] border-b-2 border-[#C0B293] shadow-sm rounded-t flex items-center justify-center mb-1">
             <span className="text-[10px] font-bold text-[#4A3C28] uppercase tracking-widest">Outer Cover</span>
          </div>

          {/* The Stack */}
          <div className="w-full flex flex-col items-center gap-1">
            {boxes.map((box, idx) => {
              const isExpanded = expandedBoxId === box.id;
              const style = BOX_STYLES[box.type];
              
              return (
                <div key={box.id} className="w-full flex flex-col items-center gap-1">
                  <button 
                    onClick={() => setExpandedBoxId(isExpanded ? null : box.id)}
                    className={`w-64 ${style.height} border-y-4 border-x-2 relative shadow-md active:scale-95 transition-transform flex items-center justify-center group`}
                    style={{ backgroundColor: style.bg, borderColor: style.border }}
                  >
                    <span className={`font-black tracking-wider ${box.type === 'deep' || box.type === 'medium' || box.type === 'shallow' ? 'text-white' : 'text-gray-800'}`}>
                      {style.label}
                    </span>
                    {(box.type === 'deep' || box.type === 'medium') && (
                      <span className="absolute bottom-1 right-2 text-[10px] font-bold text-white/50">{box.frames} Fr</span>
                    )}
                  </button>

                  {/* Expansion Actions Panel */}
                  {isExpanded && (
                    <div className="w-64 flex bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm animate-in slide-in-from-top-2">
                      <button 
                        onClick={() => moveBox(idx, 'up')}
                        disabled={idx === 0}
                        className="flex-1 p-2 flex justify-center hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white text-gray-500"
                      >
                        <ChevronUp size={20} />
                      </button>
                      <div className="w-[2px] bg-gray-100" />
                      <button 
                        onClick={() => moveBox(idx, 'down')}
                        disabled={idx === boxes.length - 1}
                        className="flex-1 p-2 flex justify-center hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white text-gray-500"
                      >
                        <ChevronDown size={20} />
                      </button>
                      <div className="w-[2px] bg-gray-100" />
                      <button 
                        onClick={() => removeBox(box.id)}
                        className="flex-1 p-2 flex justify-center hover:bg-red-50 text-red-500"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            
            {boxes.length === 0 && (
              <div className="w-64 h-32 border-4 border-dashed border-gray-300 rounded flex items-center justify-center">
                <span className="text-gray-400 font-bold text-sm">Empty Stack</span>
              </div>
            )}
          </div>

          {/* Bottom Board (Static Bottom) */}
          <div className="w-64 h-10 bg-[#4A3C28] border-t-2 border-[#3E3221] shadow-lg rounded-b flex items-end justify-center pb-1 mt-1 relative">
             <div className="absolute top-0 left-4 right-4 h-1.5 bg-black/60 rounded-b"></div>
             <span className="text-[10px] font-bold text-[#E6DCC3] uppercase tracking-widest">Bottom Board</span>
          </div>
        </div>
      </div>

      {/* Parts Palette */}
      <div className="w-full card p-4">
         <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Parts Palette (Tap to Add)</h3>
         <div className="grid grid-cols-4 gap-2">
           <button onClick={() => addBox('deep')} className="col-span-4 bg-[#D35400] text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><Plus size={18}/> Deep Box (9⅝")</button>
           <button onClick={() => addBox('medium')} className="col-span-4 bg-[#E67E22] text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><Plus size={18}/> Medium Box (6⅝")</button>
           <button onClick={() => addBox('shallow')} className="col-span-4 bg-[#F39C12] text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"><Plus size={18}/> Shallow Box (5¾")</button>
           
           <button onClick={() => addBox('excluder')} className="bg-gray-100 text-gray-700 py-2 rounded font-bold text-[10px] shadow-sm active:scale-95 transition-transform truncate px-1 border border-gray-200">Excluder</button>
           <button onClick={() => addBox('slatted_rack')} className="bg-[#F5E1DA] text-[#A04000] py-2 rounded font-bold text-[10px] shadow-sm active:scale-95 transition-transform truncate px-1 border border-[#E6B8A2]">Slatted Rack</button>
           <button onClick={() => addBox('feeder')} className="bg-blue-50 text-blue-800 py-2 rounded font-bold text-[10px] shadow-sm active:scale-95 transition-transform truncate px-1 border border-blue-200">Feeder</button>
           <button onClick={() => addBox('inner_cover')} className="bg-[#FEF3C7] text-[#92400E] py-2 rounded font-bold text-[10px] shadow-sm active:scale-95 transition-transform truncate px-1 border border-[#FDE68A]">Inner Cover</button>
         </div>
      </div>

    </div>
  );
};
