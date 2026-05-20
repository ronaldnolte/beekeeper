import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchApiaryWithCoords } from '../../data/apiaryRepository';
import { SwarmService } from './SwarmService';
import type { SwarmAnalysisResult } from './SwarmService';
import { SwarmLineChart } from './SwarmLineChart';
import { AlertTriangle, ShieldCheck, Flame, Hexagon } from 'lucide-react';

export const SwarmPredictionView: React.FC = () => {
  const { selectedApiaryId, goBack } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SwarmAnalysisResult | null>(null);
  const [apiaryName, setApiaryName] = useState('');

  useEffect(() => {
    const fetchSwarmData = async () => {
      if (!selectedApiaryId) return;
      setLoading(true);
      try {
        const apiary = await fetchApiaryWithCoords(selectedApiaryId);
        setApiaryName(apiary.name);

        const lat = apiary.lat;
        const lng = apiary.lng;

        const analysis = await SwarmService.generateSwarmAnalysis(lat, lng);
        if (!analysis) throw new Error("Failed to generate swarm analysis data.");
        
        setResult(analysis);

      } catch (err: any) {
        setError(err.message || 'Failed to load swarm index');
      } finally {
        setLoading(false);
      }
    };

    fetchSwarmData();
  }, [selectedApiaryId]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-4 space-y-6 animate-in slide-in-from-right-4 duration-300 relative">
        
        {/* Header */}
        <div className="w-full max-w-[800px] flex justify-center items-center py-2 relative">
          <div className="text-center">
            <h2 className="text-2xl font-black text-[var(--color-primary)]">Swarm Prediction Index</h2>
            <p className="text-sm font-bold text-[var(--color-text-muted)]">{apiaryName}</p>
          </div>
        </div>

        <div className="w-full max-w-[800px]">
          {loading ? (
            <div className="bg-[var(--color-input-bg)] rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-sm border border-[var(--color-card-border)]">
              <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
              <p className="font-bold text-[var(--color-primary)] animate-pulse">Calculating GDD and Satellite NDVI...</p>
            </div>
          ) : error ? (
            <div className="bg-[var(--color-input-bg)] rounded-3xl p-8 text-center border-red-200 shadow-sm border">
               <p className="text-red-600 font-bold mb-2">Error</p>
               <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : result && (
            <div className="w-full flex flex-col space-y-6">
              
              {/* Compact Header */}
              <div className="bg-[var(--color-input-bg)] rounded-2xl p-4 shadow-sm border border-[var(--color-card-border)] flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div 
                    className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-white shadow-inner flex-shrink-0"
                    style={{ backgroundColor: result.currentColor }}
                  >
                    <span className="text-xl font-black">{result.currentProbability}%</span>
                    <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">SPI</span>
                  </div>
                  
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      {result.currentProbability >= 76 ? (
                        <Flame className="text-[#F44336]" size={20} />
                      ) : result.currentProbability >= 41 ? (
                        <AlertTriangle className="text-[#FFC107]" size={20} />
                      ) : (
                        <ShieldCheck className="text-[#4CAF50]" size={20} />
                      )}
                      <h3 className="text-lg font-bold text-[var(--color-text)]" style={{ color: result.currentColor }}>
                        {result.executiveSummary}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] font-medium max-w-sm line-clamp-2">
                      {result.primaryDriver}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 md:border-l border-[var(--color-card-border)] pt-3 md:pt-0 md:pl-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wide">Peak GDD</span>
                    <span className="text-sm font-black text-gray-700">{result.peakGDD}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-wide">NDVI (Now/Jan)</span>
                    <span className="text-sm font-black text-gray-700">{result.currentNDVI?.toFixed(2)} / {result.baselineNDVI?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-[var(--color-input-bg)] rounded-3xl p-6 shadow-sm border border-[var(--color-card-border)]">
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Swarm Probability Timeline</h3>
                <SwarmLineChart 
                  data={result.chartData} 
                  lastYearData={result.lastYearData}
                  averageData={result.averageData}
                />
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Segregated Bottom Action Bar — Return to Hives */}
      <div className="w-full flex-shrink-0 flex justify-center gap-3 p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 dark:bg-black/55 dark:border-white/10 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button 
          onClick={goBack}
          className="flex-1 max-w-md bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-3.5 rounded-full font-bold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform shadow-sm dark:bg-black/30 dark:border-white/10 dark:text-white"
        >
          <Hexagon size={20} />
          Return to Hives
        </button>
      </div>

    </div>
  );
};
