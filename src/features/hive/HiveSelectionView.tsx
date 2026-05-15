import React, { useEffect, useState } from 'react';
import { fetchHives as loadHives } from '../../data/hiveRepository';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import { SelectionList } from '../../shared/components/SelectionList';
import type { SelectionItem } from '../../shared/components/SelectionCard';
import { Hexagon, Plus, Activity } from 'lucide-react';
import { HiveFormModal } from './HiveFormModal';
import { SwarmService } from '../swarm/SwarmService';

export const HiveSelectionView: React.FC = () => {
  const { selectedApiaryId, selectHive } = useAppStore();
  const [hives, setHives] = useState<SelectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [swarmScore, setSwarmScore] = useState<number | null>(null);
  const [swarmColor, setSwarmColor] = useState<string>('#95a5a6');

  useEffect(() => {
    const fetchHives = async () => {
      if (!selectedApiaryId) return;
      
      const data = await loadHives(selectedApiaryId);

      const formatted: SelectionItem[] = data.map((h: any) => ({
        id: h.id,
        title: h.name,
        subtitle: `Type: ${h.type || 'Standard'}`,
        icon: <Hexagon size={22} />,
        statusBadge: {
          text: h.status || 'Active',
          colorClass: (h.status || 'Active') === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        },
        raw: h
      }));
      setHives(formatted);
      setLoading(false);
    };

    const fetchSwarmScore = async () => {
      if (!selectedApiaryId) return;
      try {
        const apiary = await fetchApiaryWithCoords(selectedApiaryId);

        if (apiary.lat && apiary.lng) {
          const analysis = await SwarmService.generateSwarmAnalysis(apiary.lat, apiary.lng, true);
          if (analysis) {
            setSwarmScore(analysis.currentProbability);
            setSwarmColor(analysis.currentColor);
          }
        }
      } catch (e) {
        console.error("Failed to fetch lightweight swarm score", e);
      }
    };

    fetchHives();
    fetchSwarmScore();
  }, [selectedApiaryId]);

  return (
    <div className="w-full flex flex-col items-center pt-4 pb-28">
      {/* Quick nav buttons */}
      <div className="w-full max-w-2xl px-4 mb-2 flex gap-2">
        <button
          onClick={() => useAppStore.getState().navigateTo('SWARM_PREDICTION')}
          className="flex-1 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform text-white border border-white/10"
          style={{ backgroundColor: swarmScore !== null ? swarmColor : '#95a5a6' }}
        >
          <Activity size={16} />
          {swarmScore !== null ? `SPI: ${swarmScore}%` : 'SPI'}
        </button>
        <button
          onClick={() => useAppStore.getState().navigateTo('FORECAST')}
          className="flex-1 px-3 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 justify-center active:scale-95 transition-transform bg-[var(--color-card-bg)] text-[var(--color-text)] border border-[var(--color-card-border)]"
        >
          <span>⛅</span> Forecast
        </button>
      </div>

      <div className="w-full max-w-2xl px-4 mb-1">
        <h2 className="text-lg font-black text-[var(--color-text)]">Select a Hive</h2>
        <p className="text-[var(--color-text-muted)] font-medium text-sm">Choose a hive to inspect or manage.</p>
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

      {/* Fixed Bottom Action Bar */}
      <div className="bottom-action-bar">
        <button
          onClick={() => useAppStore.getState().setHiveFormOpen(true, null)}
          className="flex-1 max-w-md bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-[var(--color-primary)]/30 transition-transform"
        >
          <Plus size={22} /> Create New Hive
        </button>
      </div>

      <HiveFormModal onSuccess={() => {
        setLoading(true);
        window.location.reload();
      }} />
    </div>
  );
};
