import React from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { InspectionWindow } from './WeatherService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    window: InspectionWindow | null;
}

export const ForecastDetailModal: React.FC<Props> = ({ isOpen, onClose, window }) => {
    if (!isOpen || !window) return null;

    const date = new Date(window.time);
    const dayDateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric' }).toLowerCase();

    // Determine bg color based on rating
    let bgClass = '';
    let textColor = 'text-white';
    
    if (window.rating === 'Excellent') bgClass = 'bg-[#1E824C]'; // Dark Green
    else if (window.rating === 'Good') bgClass = 'bg-[#2ECC71]'; // Light Green
    else if (window.rating === 'Fair') bgClass = 'bg-[#F1C40F]'; // Yellow
    else if (window.rating === 'Poor') bgClass = 'bg-[#E67E22]'; // Orange
    else bgClass = 'bg-[#E74C3C]'; // Red

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Row */}
                <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <div>
                        <h3 className="text-xl font-black text-[#8B4513]">Inspection Conditions</h3>
                        <p className="text-sm font-bold text-gray-500">{dayDateStr}</p>
                        <p className="text-sm font-bold text-gray-500">{timeStr}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors active:scale-95 self-start"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 pb-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">
                    
                    {/* Big Score Card */}
                    <div className={`w-full rounded-2xl p-6 flex flex-col items-center justify-center shadow-inner mt-2 ${bgClass}`}>
                        <span className={`text-6xl font-black ${textColor} ${window.isHardLimit ? '!text-black' : ''} drop-shadow-sm`}>
                            {window.score}
                        </span>
                        <span className={`text-sm font-bold ${textColor} ${window.isHardLimit ? '!text-black' : ''} opacity-90 mt-1`}>
                            Overall Score
                        </span>
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <MetricCard label="Temperature" value={`${Math.round(window.temperature)}°F`} score={window.breakdown.temp} max={40} isBad={window.temperature < 55 || window.temperature > 92} />
                        <MetricCard label="Cloud" value={`${Math.round(window.cloudCover)}%`} score={window.breakdown.cloud} max={20} />
                        <MetricCard label="Wind" value={`${Math.round(window.windSpeed)}mph`} score={window.breakdown.wind} max={20} isBad={window.windSpeed > 24} />
                        <MetricCard label="Precip" value={`${window.precipitationProbability}%`} score={window.breakdown.precip} max={15} isBad={window.precipitationProbability > 49} />
                        <MetricCard label="Humidity" value={`${window.humidity}%`} score={window.breakdown.humidity} max={5} />
                    </div>

                    {/* Conditions Lists */}
                    <div className="space-y-4 mt-2">
                        {window.goodConditions.length > 0 && (
                            <div>
                                <h4 className="font-black text-green-600 mb-2 flex items-center gap-1.5 text-sm">
                                    <CheckCircle2 size={16} /> Good Conditions:
                                </h4>
                                <ul className="text-sm font-medium text-gray-600 space-y-1 ml-1">
                                    {window.goodConditions.map((cond, i) => (
                                        <li key={i}>• {cond}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        {window.badConditions.length > 0 && (
                            <div>
                                <h4 className="font-black text-red-600 mb-2 flex items-center gap-1.5 text-sm">
                                    <AlertTriangle size={16} /> Concerns:
                                </h4>
                                <ul className="text-sm font-bold text-red-500 space-y-1 ml-1">
                                    {window.badConditions.map((cond, i) => (
                                        <li key={i}>• {cond}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

function MetricCard({ label, value, score, max, isBad }: { label: string, value: string, score: number, max: number, isBad?: boolean }) {
    return (
        <div className={`bg-gray-50 rounded-xl p-3 border-2 ${isBad ? 'border-red-500 bg-red-50' : 'border-transparent'}`}>
            <p className="text-xs font-bold text-gray-400 mb-0.5">{label}</p>
            <p className="text-xs font-medium text-gray-600 mb-2">{value}</p>
            <p className="text-lg font-black text-black">
                {score}<span className="text-sm text-gray-500">/{max}</span>
            </p>
        </div>
    );
}
