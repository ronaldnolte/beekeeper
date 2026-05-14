import React from 'react';
import { X, AlertTriangle, Flame } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const ForecastScoreGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-[#FFFBF0] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 border-2 border-amber-100"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 bg-white border-b border-amber-100">
                    <div>
                        <h3 className="text-xl font-black text-[#8B4513]">How Scores are Calculated</h3>
                        <p className="text-xs text-[#8B4513]/70 font-bold uppercase tracking-wider mt-0.5">Optimal conditions for hive inspections</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors active:scale-95"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 text-sm custom-scrollbar">
                    {/* Intro */}
                    <p className="text-gray-600 font-medium leading-relaxed">
                        The inspection suitability score (0-100) is a weighted calculation based on 5 key weather factors. High scores indicate ideal conditions for opening the hive with minimal stress to the colony.
                    </p>

                    {/* Point Breakdown */}
                    <div className="space-y-4">
                        <h4 className="font-black text-[#4A3C28] uppercase tracking-wider text-xs">Point System</h4>

                        <div className="grid gap-3">
                            <ScoreRule
                                label="Temperature"
                                max="40"
                                description="Best above 75°F (24°C). Bees are more active and brood is less likely to chill."
                                detail="75°F+/24°C+ (40 pts), 70°F/21°C (37 pts), 65°F/18°C (33 pts), 60°F/16°C (27 pts), 57°F/14°C (18 pts), 55°F/13°C (8 pts)."
                            />
                            <ScoreRule
                                label="Cloud Cover"
                                max="20"
                                description="Bees prefer sun. Foragers are out working, making the hive less crowded."
                                detail="Sunny (20 pts), Partly Cloudy (17 pts), Mostly Cloudy (12 pts), Overcast (6 pts)."
                            />
                            <ScoreRule
                                label="Wind Speed"
                                max="20"
                                description="High winds make bees defensive and can chill the brood."
                                detail="<5mph/8km/h (20 pts), 10mph/16km/h (18 pts), 15mph/24km/h (12 pts), 20mph/32km/h (6 pts), 24mph/39km/h (2 pts)."
                            />
                            <ScoreRule
                                label="Precipitation"
                                max="15"
                                description="Rain is a hard limit. Never open a hive in the rain."
                                detail="0% Prob (15 pts), 10% (12 pts), 20% (8 pts), 35% (4 pts), 49% (1 pt)."
                            />
                            <ScoreRule
                                label="Humidity"
                                max="5"
                                description="Bees regulate humidity easily if the air is moderate (30-70%)."
                                detail="30-70% (5 pts). Outside this range (0 pts)."
                            />
                        </div>
                    </div>

                    {/* Critical Limits */}
                    <div className="bg-red-50 rounded-xl p-5 border-2 border-red-100">
                        <h4 className="font-black text-red-700 mb-3 flex items-center gap-2">
                            <AlertTriangle size={18} />
                            Hard Limits
                        </h4>
                        <p className="text-xs font-medium text-red-600 mb-3">
                            A score will appear in <span className="font-bold text-black border-b border-black">black text</span> if any of these conditions are met, suggesting you should **not** inspect:
                        </p>
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-bold text-red-700 list-disc ml-4">
                            <li>Score below 40</li>
                            <li>Temperature &lt; 55°F</li>
                            <li>Wind &gt; 24mph</li>
                            <li>Rain Chance &gt; 49%</li>
                            <li>Active Storms</li>
                            <li>Raining Now</li>
                        </ul>
                    </div>

                    {/* TBH Heat Penalty */}
                    <div className="bg-orange-50 rounded-xl p-5 border-2 border-orange-100">
                        <h4 className="font-black text-orange-700 mb-3 flex items-center gap-2">
                            <Flame size={18} />
                            Top Bar Hive Heat Penalty
                        </h4>
                        <p className="text-xs font-medium text-orange-600 mb-3">
                            Top Bar Hives are sensitive to heat — high temperatures can cause wax comb to slump or collapse. This penalty is always active.
                        </p>
                        <ul className="text-xs font-bold text-orange-700 space-y-2 list-disc ml-4">
                            <li><strong>Heat Penalty:</strong> -10 pts for every 5°F above 80°F</li>
                            <li><strong>Example:</strong> 85°F = -10 pts, 90°F = -20 pts</li>
                            <li><strong>Hard Fail:</strong> Temperature &gt; 92°F triggers a fail</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-amber-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-[#8B4513] text-white rounded-xl font-black hover:bg-[#6D360F] transition-colors active:scale-95 shadow-md shadow-[#8B4513]/20"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    );
};

function ScoreRule({ label, max, description, detail }: { label: string, max: string, description: string, detail: string }) {
    return (
        <div className="group border-2 border-white bg-white rounded-xl p-4 shadow-sm hover:border-amber-200 hover:shadow-md transition-all">
            <div className="flex justify-between items-center mb-2">
                <span className="font-black text-[#4A3C28] text-base">{label}</span>
                <span className="text-xs font-black bg-amber-100 text-[#8B4513] px-3 py-1 rounded-full">{max} pts</span>
            </div>
            <p className="text-xs font-medium text-gray-500 mb-3">{description}</p>
            <p className="text-[10px] text-gray-400 font-mono bg-gray-50 p-2 rounded-lg leading-relaxed">{detail}</p>
        </div>
    );
}
