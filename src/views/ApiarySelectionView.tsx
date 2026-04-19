import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { SelectionList } from '../components/SelectionList';
import type { SelectionItem } from '../components/SelectionCard';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';
import { ApiaryFormModal } from '../components/ApiaryFormModal';

export const ApiarySelectionView: React.FC = () => {
  const { user, selectApiary, setApiaryFormOpen } = useAppStore();
  const [apiaries, setApiaries] = useState<SelectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApiaries = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('apiaries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        const formatted: SelectionItem[] = data.map(a => ({
          id: a.id,
          title: a.name,
          subtitle: a.zip_code !== '00000' ? `ZIP: ${a.zip_code}` : 'No Location',
          icon: <MapPin size={24} />,
          raw: a
        }));
        setApiaries(formatted);
      }
      setLoading(false);
    };

    fetchApiaries();
  }, [user]);

  return (
    <div className="w-full flex flex-col items-center pt-6">
      <div className="w-full max-w-2xl px-4 mb-2">
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Select an Apiary</h2>
        <p className="text-gray-500 font-medium">Choose a location to view your hives.</p>
      </div>
      <SelectionList 
        items={apiaries}
        isLoading={loading}
        onSelect={selectApiary}
        onEdit={(id) => {
          const apiary = apiaries.find(a => a.id === id);
          setApiaryFormOpen(true, apiary);
        }}
        emptyMessage="No apiaries found. Create your first apiary to get started."
      />

      {/* Create Button */}
      <div className="w-full max-w-2xl px-4 mt-6 pb-20">
        <button
          onClick={() => setApiaryFormOpen(true, null)}
          className="w-full bg-[#E67E22] text-white py-4 rounded-xl font-black text-lg hover:bg-[#D35400] transition-colors active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#E67E22]/30"
        >
          <Plus size={24} /> Create New Apiary
        </button>
      </div>

      <ApiaryFormModal onSuccess={() => {
        // Refresh the list when a save/delete happens
        setLoading(true);
        // Quick trick to re-trigger useEffect by toggling a piece of state or just reloading
        // Better way: extract fetchApiaries to a function, but for now we can just force a state update if we had a trigger.
        // Let's reload the page to ensure fresh state across the app since it's SPA
        window.location.reload();
      }} />
    </div>
  );
};
