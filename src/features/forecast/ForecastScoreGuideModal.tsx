import React from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const ForecastScoreGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 border border-[var(--color-card-border)]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 bg-[var(--color-input-bg)] border-b border-[var(--color-card-border)]">
                    <div>
                        <h3 className="text-xl font-black text-[#8B4513] dark:text-amber-500">How Scores are Calculated</h3>
                        <p className="text-xs text-[#8B4513]/70 dark:text-amber-400/80 font-bold uppercase tracking-wider mt-0.5">Optimal conditions for hive inspections</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)] transition-colors active:scale-95"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 text-sm custom-scrollbar">
                    {/* Intro */}
                    <p className="text-[var(--color-text-muted)] font-medium leading-relaxed">
                        The V2 suitability score (0-9) is calculated using a weighted points scoring matrix. High scores indicate ideal conditions for opening the hive with minimal stress to the colony.
                    </p>

                    {/* Point Breakdown */}
                    <div className="space-y-4">
                        <h4 className="font-black text-[#8B4513] dark:text-amber-500 uppercase tracking-wider text-xs">Weighted Points Matrix</h4>

                        <div className="grid gap-3">
                            <ScoreRule
                                label="Temperature"
                                max="3"
                                description="Warm weather is safer. Brood chilling is a primary concern."
                                detail="Optimal: 68°F - 85°F (3 pts). Sub-optimal: 58°F - 67°F or 86°F - 91°F (1 pt). Else (0 pts)."
                            />
                            <ScoreRule
                                label="Time of Day"
                                max="2"
                                description="Inspect after the colony wakes up and before foragers return."
                                detail="Optimal: >= 1 hour since temperature hit 55°F AND starts >= 1 hour before sunset (2 pts). Else (0 pts)."
                            />
                            <ScoreRule
                                label="Sky Condition"
                                max="2"
                                description="Sunny, clear weather encourages flight and lowers defensive tempers."
                                detail="Clear / Sunny (< 30% clouds) (2 pts). Partly Cloudy (30% - 70% clouds) (1 pt). Overcast (> 70% clouds) (0 pts)."
                            />
                            <ScoreRule
                                label="Wind Speed"
                                max="2"
                                description="Calm winds preserve hive warmth and prevent flight disruptions."
                                detail="Optimal: < 10mph (2 pts). Sub-optimal: 10 - 15mph (1 pt). Else (0 pts)."
                            />
                        </div>
                    </div>

                    {/* V2 Fail-Safes */}
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-5 border border-red-100 dark:border-red-900/30">
                        <h4 className="font-black text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                            <AlertTriangle size={18} />
                            Safety Fail-Safes (Forces Red Cell Abort)
                        </h4>
                        <p className="text-xs font-medium text-red-600 dark:text-red-400/80 mb-3">
                            If any of these conditions evaluate to TRUE, execution is immediately aborted (classification: <strong>Inadvisable / Red Cell</strong>) and points default to 0:
                        </p>
                        <ul className="grid grid-cols-1 gap-y-2 text-xs font-bold text-red-700 dark:text-red-400 list-disc ml-4">
                            <li><strong>Brood Chill Threshold:</strong> Temperature &lt; 57°F (14°C) (extreme cold risk)</li>
                            <li><strong>Comb Heat/Heat Stroke:</strong> Temperature &gt; 92°F (33°C) (slumping wax risk)</li>
                            <li><strong>Flight Disruption Wind:</strong> Wind speed &gt; 18mph (colony aggression risk)</li>
                            <li><strong>Active Precipitation:</strong> Raining, stormy, or precipitation chance &ge; 50%</li>
                            <li><strong>Severe Storm Plunge:</strong> 3-hour barometric pressure drop &ge; 4.0 hPa (severe front approaching)</li>
                            <li><strong>Wake-up Temperature:</strong> Must be at least 1 hour since temperature crossed &ge; 55°F (colony activity wake-up buffer)</li>
                            <li><strong>Sunset Safety Buffer:</strong> Inspection must start at least 1 hour before daily sunset (allows foragers to safely return to hive)</li>
                        </ul>
                    </div>

                    {/* Barometric storm tracking */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-5 border border-blue-100 dark:border-blue-900/30">
                        <h4 className="font-black text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-2">
                            <Info size={18} />
                            Storm Front Tracking
                        </h4>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400/80 mb-3">
                            A moderate 3-hour pressure drop (between 1.5 and 4.0 hPa) does not completely abort the inspection, but it applies a **-2 point penalty** to reflect the approaching weather disturbance.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-[var(--color-input-bg)] border-t border-[var(--color-card-border)] flex justify-end">
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
        <div className="group border border-[var(--color-card-border)] bg-[var(--color-bg-raised)] rounded-xl p-4 shadow-sm hover:border-amber-200 hover:shadow-md transition-all">
            <div className="flex justify-between items-center mb-2">
                <span className="font-black text-[#8B4513] dark:text-amber-500 text-base">{label}</span>
                <span className="text-xs font-black bg-amber-100 dark:bg-amber-950/50 text-[#8B4513] dark:text-amber-400 px-3 py-1 rounded-full">{max} pts</span>
            </div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-3">{description}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono bg-[var(--color-input-bg)] p-2 rounded-lg leading-relaxed">{detail}</p>
        </div>
    );
}
