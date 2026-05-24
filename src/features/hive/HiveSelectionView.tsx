import React, { useEffect, useState } from 'react';
import { fetchHives as loadHives } from '../../data/hiveRepository';
import { useAppStore } from '../../store/useAppStore';
import { SelectionList } from '../../shared/components/SelectionList';
import type { SelectionItem } from '../../shared/components/SelectionCard';
import { Hexagon, Plus } from 'lucide-react';
import { HiveFormModal } from './HiveFormModal';

export const HiveSelectionView: React.FC = () => {
  const { 
    selectedApiaryId, 
    selectHive, 
    hivesList, 
    apiariesList, 
    isUnifiedHiveView, 
    user 
  } = useAppStore();

  const [hives, setHives] = useState<SelectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering states for multi-hive unified list
  const [selectedFilterApiaryId, setSelectedFilterApiaryId] = useState<string | null>(null);

  useEffect(() => {
    const formatHiveItem = (h: any): SelectionItem => {
      const apiaryName = apiariesList.find(a => a.id === h.apiary_id)?.name || 'Unknown Yard';
      return {
        id: h.id,
        title: h.name,
        subtitle: isUnifiedHiveView 
          ? `Type: ${h.type || 'Standard'} | Site: ${apiaryName}`
          : `Type: ${h.type || 'Standard'}`,
        icon: <Hexagon size={22} />,
        statusBadge: {
          text: h.status || 'Active',
          colorClass: (h.status || 'Active') === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        },
        raw: h
      };
    };

    const fetchHives = async () => {
      if (isUnifiedHiveView) {
        // Flat list from cached hives
        let filtered = hivesList;
        if (selectedFilterApiaryId) {
          filtered = hivesList.filter(h => h.apiary_id === selectedFilterApiaryId);
        }
        const formatted = filtered.map(formatHiveItem);
        setHives(formatted);
        setLoading(false);
      } else {
        // Site specific drilldown
        if (!selectedApiaryId) return;
        const data = await loadHives(selectedApiaryId);
        const formatted = data.map(formatHiveItem);
        setHives(formatted);
        setLoading(false);
      }
    };

    fetchHives();
  }, [selectedApiaryId, isUnifiedHiveView, hivesList, apiariesList, selectedFilterApiaryId]);

  return (
    <div className="w-full flex-1 overflow-y-auto flex flex-col items-center pt-4 animate-in fade-in duration-300">
      
      {/* 1. Quick nav buttons (Only for specific apiary drilldown mode) */}
      {!isUnifiedHiveView && selectedApiaryId && (
        <div className="w-full max-w-2xl px-4 mb-2">
          <button
            onClick={() => useAppStore.getState().navigateTo('FORECAST')}
            className="w-full px-3 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 justify-center active:scale-95 transition-transform bg-[var(--color-card-bg)] text-[var(--color-text)] border border-[var(--color-card-border)]"
          >
            <span>⛅</span> Forecast
          </button>
        </div>
      )}

      {/* 2. Sleek yard filter pills (For Hives flat list view if hivesList.length > 5) */}
      {isUnifiedHiveView && hivesList.length > 5 && (
        <div className="w-full max-w-2xl px-4 mb-4 flex gap-1.5 overflow-x-auto py-1 custom-scrollbar">
          <button
            onClick={() => setSelectedFilterApiaryId(null)}
            className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all border active:scale-95 ${
              selectedFilterApiaryId === null
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                : 'bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border-[var(--color-card-border)] hover:text-[var(--color-text)]'
            }`}
          >
            All Hives ({hivesList.length})
          </button>
          {apiariesList.map(apiary => {
            const apiaryHiveCount = hivesList.filter(h => h.apiary_id === apiary.id).length;
            return (
              <button
                key={apiary.id}
                onClick={() => setSelectedFilterApiaryId(apiary.id)}
                className={`px-4 py-2 rounded-full font-bold text-xs whitespace-nowrap transition-all border active:scale-95 ${
                  selectedFilterApiaryId === apiary.id
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                    : 'bg-[var(--color-card-bg)] text-[var(--color-text-muted)] border-[var(--color-card-border)] hover:text-[var(--color-text)]'
                }`}
              >
                {apiary.name} ({apiaryHiveCount})
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Section Title */}
      <div className="w-full max-w-2xl px-4 mb-1">
        <h2 className="text-lg font-black text-[var(--color-text)]">
          {isUnifiedHiveView ? 'My Hives' : 'Select a Hive'}
        </h2>
        <p className="text-[var(--color-text-muted)] font-medium text-sm">
          {isUnifiedHiveView ? 'Quickly access any of your hives.' : 'Choose a hive to inspect or manage.'}
        </p>
      </div>

      {/* 4. Hives List */}
      <SelectionList 
        items={hives}
        isLoading={loading}
        onSelect={(id) => {
          const hive = hives.find(h => h.id === id);
          selectHive(id, hive?.title);
        }}
        onEdit={(id) => {
          const hive = hives.find(h => h.id === id);
          useAppStore.getState().setHiveFormOpen(true, hive);
        }}
        emptyMessage={
          isUnifiedHiveView 
            ? "No hives found. Click Create New Hive to get started!"
            : "No hives found in this apiary. Create your first hive!"
        }
      />

      {/* Inline Create Hive Button (scrolls with list, does not overlay floating nav bar) */}
      <div className="w-full max-w-2xl px-4 mt-6 flex justify-center">
        <button
          onClick={() => useAppStore.getState().setHiveFormOpen(true, null)}
          className="w-full max-w-[240px] btn-honey py-3.5 text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus size={22} /> Create New Hive
        </button>
      </div>

      <HiveFormModal onSuccess={async () => {
        setLoading(true);
        if (user) {
          await useAppStore.getState().loadNavigationContext(user.id);
        }
        window.location.reload();
      }} />
    </div>
  );
};
