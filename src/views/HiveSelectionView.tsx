import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { SelectionList } from '../components/SelectionList';
import type { SelectionItem } from '../components/SelectionCard';
import { Hexagon, Plus, Activity } from 'lucide-react';
import { HiveFormModal } from '../components/HiveFormModal';
import { SwarmService } from '../services/SwarmService';

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

          if (!lat || !lng && apiary.zip_code) {
             const cleanZip = apiary.zip_code.includes(':') ? apiary.zip_code.split(':')[1] : apiary.zip_code;
             const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${cleanZip}&count=1&language=en&format=json`);
             const geoData = await geoRes.json();
             if (geoData.results && geoData.results.length > 0) {
                 lat = geoData.results[0].latitude;
                 lng = geoData.results[0].longitude;
             }
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
                if (typeof window !== 'undefined') {
                  window.history.pushState({ view: 'SWARM_PREDICTION' }, '');
                }
                useAppStore.getState().setCurrentView('SWARM_PREDICTION');
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
              if (typeof window !== 'undefined') {
                window.history.pushState({ view: 'FORECAST' }, '');
              }
              useAppStore.getState().setCurrentView('FORECAST');
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
