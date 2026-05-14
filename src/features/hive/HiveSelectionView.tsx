import React, { useEffect, useState } from 'react';
import { supabase } from '../../data/supabase';
import { useAppStore } from '../../store/useAppStore';
import { resolveApiaryCoords } from '../../data/geocoding';
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
      
      const { data } = await supabase
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
          statusBadge: {
            text: h.status || 'Active',
            colorClass: (h.status || 'Active') === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          },
          raw: h
        }));
        setHives(formatted);
      }
      setLoading(false);
    };

    const fetchSwarmScore = async () => {
      if (!selectedApiaryId) return;
      try {
        const { data: apiary } = await supabase
          .from('apiaries')
          .select('latitude, longitude, zip_code')
          .eq('id', selectedApiaryId)
          .single();

        if (apiary) {
          let lat = apiary.latitude;
          let lng = apiary.longitude;

          if (!lat || !lng) {
            try {
              const coords = await resolveApiaryCoords(apiary);
              lat = coords.lat;
              lng = coords.lng;
            } catch { /* no location available */ }
          }

          if (lat && lng) {
            const analysis = await SwarmService.generateSwarmAnalysis(lat, lng, true);
            if (analysis) {
              setSwarmScore(analysis.currentProbability);
              setSwarmColor(analysis.currentColor);
            }
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
    <div className="w-full flex flex-col items-center pt-6">
      <div className="w-full max-w-2xl px-4 mb-2 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Select a Hive</h2>
          <p className="text-gray-500 font-medium">Choose a hive to inspect or manage.</p>
        </div>
        <div className="flex gap-2 items-start">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => {
                useAppStore.getState().navigateTo('SWARM_PREDICTION');
              }}
              className="px-3 py-2 w-full rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm border border-gray-100 active:scale-95 transition-transform text-white"
              style={{ backgroundColor: swarmScore !== null ? swarmColor : '#95a5a6' }}
            >
              <Activity size={16} />
              {swarmScore !== null ? `SPI: ${swarmScore}%` : 'SPI'}
            </button>
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider text-center whitespace-nowrap">Swarm Prediction Index</span>
          </div>
          
          <button
            onClick={() => {
              useAppStore.getState().navigateTo('FORECAST');
            }}
            className="bg-blue-50 text-blue-600 px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm border border-blue-100 active:scale-95 transition-transform h-[38px]"
          >
            <span>⛅</span> Forecast
          </button>
        </div>
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
