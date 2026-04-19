import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { SelectionList, type SelectionItem } from '../components/SelectionList';
import { Hexagon, Plus, Edit2, Trash2 } from 'lucide-react';
import { HiveFormModal } from '../components/HiveFormModal';

export const HiveSelectionView: React.FC = () => {
  const { selectedApiaryId, selectHive } = useAppStore();
  const [hives, setHives] = useState<SelectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHives = async () => {
      if (!selectedApiaryId) return;
      
      const { data, error } = await supabase
        .from('hives')
        .select('*')
        .eq('apiary_id', selectedApiaryId)
        .order('name', { ascending: true });

      if (data) {
        const formatted: SelectionItem[] = data.map(h => ({
          id: h.id,
          title: h.name,
          subtitle: `Type: ${h.type || 'Standard'}`,
          icon: <Hexagon size={24} />,
          statusBadge: h.status ? {
            text: h.status,
            colorClass: h.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          } : undefined,
          raw: h
        }));
        setHives(formatted);
      }
      setLoading(false);
    };

    fetchHives();
  }, [selectedApiaryId]);

  return (
    <div className="w-full flex flex-col items-center pt-6">
      <div className="w-full max-w-2xl px-4 mb-2 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Select a Hive</h2>
          <p className="text-gray-500 font-medium">Choose a hive to inspect or manage.</p>
        </div>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({ view: 'FORECAST' }, '');
            }
            useAppStore.getState().setCurrentView('FORECAST');
          }}
          className="bg-blue-50 text-blue-600 px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm border border-blue-100 active:scale-95 transition-transform"
        >
          <span>⛅</span> Forecast
        </button>
      </div>
      <SelectionList 
        items={hives}
        isLoading={loading}
        onSelect={selectHive}
        onEdit={(id) => {
          const hive = hives.find(h => h.id === id);
          useAppStore.getState().setHiveFormOpen(true, hive);
        }}
        emptyMessage="No hives found in this apiary. Create your first hive!"
      />

      {/* Create Button */}
      <div className="w-full max-w-2xl px-4 mt-6 pb-20">
        <button
          onClick={() => useAppStore.getState().setHiveFormOpen(true, null)}
          className="w-full bg-[#E67E22] text-white py-4 rounded-xl font-black text-lg hover:bg-[#D35400] transition-colors active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#E67E22]/30"
        >
          <Plus size={24} /> Create New Hive
        </button>
      </div>

      <HiveFormModal onSuccess={() => {
        setLoading(true);
        // Reload page or re-fetch to see new/edited hives
        window.location.reload();
      }} />
    </div>
  );
};
