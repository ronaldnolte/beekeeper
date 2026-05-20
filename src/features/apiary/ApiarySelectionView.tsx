import React, { useEffect, useState } from 'react';
import { fetchApiaries as loadApiaries, deleteApiaryWithCascade } from '../../data/apiaryRepository';
import { useAppStore } from '../../store/useAppStore';
import { SelectionList } from '../../shared/components/SelectionList';
import type { SelectionItem } from '../../shared/components/SelectionCard';
import { MapPin, Plus } from 'lucide-react';
import { ApiaryFormModal } from './ApiaryFormModal';

export const ApiarySelectionView: React.FC = () => {
  const { user, selectApiary, setApiaryFormOpen } = useAppStore();
  const [apiaries, setApiaries] = useState<SelectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadApiariesList = async () => {
    if (!user) return;
    setLoading(true);
    const data = await loadApiaries(user.id);

    const formatted: SelectionItem[] = data.map((a: any) => ({
      id: a.id,
      title: a.name,
      subtitle: a.zip_code ? `ZIP: ${a.zip_code}` : (a.latitude ? 'Location: Coordinates' : 'No location set'),
      icon: <MapPin size={22} />,
      raw: a
    }));
    setApiaries(formatted);
    setLoading(false);
  };

  useEffect(() => {
    reloadApiariesList();
  }, [user]);

  const handleDeleteApiary = async (id: string) => {
    const apiary = apiaries.find(a => a.id === id);
    if (!apiary || !user) return;
    
    if (!window.confirm(`Are you sure you want to delete "${apiary.title}"? This will delete all hives inside it!`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteApiaryWithCascade(id, user.id);
      // Reload navigation cached store state
      await useAppStore.getState().loadNavigationContext(user.id);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to delete apiary');
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto flex flex-col items-center pt-4 animate-in fade-in duration-300">
      
      {/* Apiary Selection */}
      <div className="w-full max-w-2xl px-4 mb-2">
        <h3 className="text-xl font-black text-[var(--color-text)]">My Apiaries</h3>
        <p className="text-[var(--color-text-muted)] font-medium text-sm mt-0.5">Select a yard location to manage your hives.</p>
      </div>

      <SelectionList 
        items={apiaries.map(a => ({ ...a, onDelete: handleDeleteApiary }))}
        isLoading={loading}
        onSelect={(id) => {
          const apiary = apiaries.find(a => a.id === id);
          selectApiary(id, apiary?.title);
        }}
        onEdit={(id) => {
          const apiary = apiaries.find(a => a.id === id);
          setApiaryFormOpen(true, apiary);
        }}
        emptyMessage="No apiaries found. Create your first apiary to get started."
      />

      {/* Inline Create Apiary Button (scrolls with list, does not overlay floating nav bar) */}
      <div className="w-full max-w-2xl px-4 mt-6 flex justify-center">
        <button
          onClick={() => setApiaryFormOpen(true, null)}
          className="w-full max-w-[240px] btn-honey py-3.5 text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus size={18} /> Create Apiary
        </button>
      </div>

      <ApiaryFormModal onSuccess={async () => {
        if (user) {
          await useAppStore.getState().loadNavigationContext(user.id);
        }
        window.location.reload();
      }} />

    </div>
  );
};
