import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../data/supabase';
import { SwarmService } from './SwarmService';
import type { SwarmAnalysisResult } from './SwarmService';
import { SwarmLineChart } from './SwarmLineChart';
import { ArrowLeft, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';

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
        const { data: apiary, error: apiaryError } = await supabase
          .from('apiaries')
          .select('name, latitude, longitude, zip_code')
          .eq('id', selectedApiaryId)
          .single();

        if (apiaryError) throw apiaryError;
        setApiaryName(apiary.name);

        let lat = apiary.latitude;
        let lng = apiary.longitude;

        if (!lat || !lng) {
          if (apiary.zip_code) {
             const cleanZip = apiary.zip_code.includes(':') ? apiary.zip_code.split(':')[1] : apiary.zip_code;
             const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${cleanZip}&count=1&language=en&format=json`;
             const geoRes = await fetch(geoUrl);
             const geoData = await geoRes.json();
             if (geoData.results && geoData.results.length > 0) {
                 lat = geoData.results[0].latitude;
                 lng = geoData.results[0].longitude;
             } else {
                 throw new Error("Could not find coordinates for Zip Code: " + apiary.zip_code);
             }
          } else {
              throw new Error("Apiary has no location data (no lat/lng or zip code).");
          }
        }

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
    <div className="w-full flex flex-col items-center p-4 pb-24 space-y-6 animate-in slide-in-from-right-4 duration-300 relative min-h-screen">
      
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-center items-center py-2 relative">
        <button 
          onClick={goBack}
          className="absolute left-0 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 border border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-black text-[#E67E22]">Swarm Prediction Index</h2>
          <p className="text-sm font-bold text-gray-500">{apiaryName}</p>
        </div>
      </div>

      <div className="w-full max-w-[800px]">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 flex flex-col items-center justify-center gap-4 shadow-sm border border-gray-100">
            <div className="w-8 h-8 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-[#E67E22] animate-pulse">Calculating GDD and Satellite NDVI...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl p-8 text-center border-red-200 shadow-sm border">
             <p className="text-red-600 font-bold mb-2">Error</p>
             <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : result && (
          <div className="w-full flex flex-col space-y-6">
            
            {/* Compact Header */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
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
                    <h3 className="text-lg font-bold text-gray-800" style={{ color: result.currentColor }}>
                      {result.executiveSummary}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 font-medium max-w-sm line-clamp-2">
                    {result.primaryDriver}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 md:border-l border-gray-100 pt-3 md:pt-0 md:pl-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Peak GDD</span>
                  <span className="text-sm font-black text-gray-700">{result.peakGDD}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">NDVI (Now/Jan)</span>
                  <span className="text-sm font-black text-gray-700">{result.currentNDVI?.toFixed(2)} / {result.baselineNDVI?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Swarm Probability Timeline</h3>
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
  );
};
