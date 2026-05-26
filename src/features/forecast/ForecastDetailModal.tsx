import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { InspectionWindow } from './WeatherService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    window: InspectionWindow | null;
}

export const ForecastDetailModal: React.FC<Props> = ({ isOpen, onClose, window }) => {
    if (!isOpen || !window) return null;

    const date = window.startTime;
    const dayDateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    
    const formatTimeSlot = (hour: number) => {
        if (hour === 0 || hour === 24) return '12am';
        if (hour === 12) return '12pm';
        if (hour < 12) return `${hour}am`;
        return `${hour - 12}pm`;
    };

    const timeStr = formatTimeSlot(date.getHours());

    const getScoreColorV2 = (classification: 'Optimal' | 'Viable' | 'Inadvisable') => {
        if (classification === 'Optimal') return 'bg-green-600';
        if (classification === 'Viable') return 'bg-amber-400';
        return 'bg-red-500';
    };

    const formatTemp = (tempF: number) => {
        return `${Math.round(tempF)}°F`;
    };

    const formatSpeed = (mph: number) => {
        return `${Math.round(mph)}mph`;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="bg-[var(--color-input-bg)] text-[var(--color-text)] rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 border border-[var(--color-card-border)]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Row */}
                <div className="flex items-center justify-between px-5 pt-5 pb-2">
                    <div>
                        <h3 className="text-xl font-black text-[#8B4513] dark:text-amber-500">Inspection Window Details</h3>
                        <p className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide">
                            {dayDateStr}
                            <span className="text-amber-600 dark:text-amber-400 ml-2 font-black">
                                {timeStr}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)] transition-colors active:scale-95 self-start"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 pb-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                    
                    {/* V2 Scoring Tier Card */}
                    <div className={`${getScoreColorV2(window.classificationV2)} rounded-2xl p-5 text-center shadow-md relative overflow-hidden mt-1`}>
                        <div className="absolute top-0 right-0 p-2 text-white/10 font-bold text-4xl select-none">V2</div>
                        <span className={`text-5xl font-black ${window.classificationV2 === 'Inadvisable' ? 'text-black' : 'text-white'} drop-shadow-sm`}>
                            {window.scoreV2} / 9
                        </span>
                        <span className={`text-sm font-black block uppercase mt-1 ${window.classificationV2 === 'Inadvisable' ? 'text-black/80' : 'text-white/90'}`}>
                            {window.classificationV2}
                        </span>
                    </div>

                    {/* Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <StatCard label="Temperature" value={formatTemp(window.tempF)} score={window.scoreBreakdownV2['Temperature']} maxScore={3} isBad={window.tempF < 57 || window.tempF > 92} />
                        <StatCard label="Time of Day" value={timeStr} score={window.scoreBreakdownV2['Time of Day']} maxScore={2} />
                        <StatCard label="Sky Condition" value={window.cloudCover <= 30 ? 'Sunny' : 'Cloudy'} score={window.scoreBreakdownV2['Sky Condition']} maxScore={2} />
                        <StatCard label="Wind Speed" value={formatSpeed(window.windMph)} score={window.scoreBreakdownV2['Wind Speed']} maxScore={2} isBad={window.windMph > 18} />
                    </div>

                    {/* Barometric Delta Card */}
                    <div className="bg-[var(--color-bg-raised)] border border-[var(--color-card-border)] rounded-xl p-3 text-xs flex justify-between">
                        <div>
                            <span className="text-[var(--color-text-muted)] font-bold block">Barometric Pressure</span>
                            <span className="font-bold text-[var(--color-text)]">{window.pressureHpa.toFixed(1)} hPa</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[var(--color-text-muted)] font-bold block">3-Hour Delta</span>
                            <span className={`font-bold ${
                                window.pressureDelta3hr >= 4.0 ? 'text-red-600' :
                                window.pressureDelta3hr >= 1.5 ? 'text-orange-500' : 'text-blue-600'
                            }`}>
                                {window.pressureDelta3hr > 0 ? '↓' : '↑'} {Math.abs(window.pressureDelta3hr).toFixed(1)} hPa/3h
                            </span>
                            {window.pressureDelta3hr >= 1.5 && window.pressureDelta3hr < 4.0 && (
                                <span className="text-[10px] text-orange-600 font-extrabold block mt-0.5">(-2 Penalty)</span>
                            )}
                        </div>
                    </div>

                    {/* Concerns & Fail-Safes */}
                    {window.issuesV2.length > 0 ? (
                        <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 text-xs">
                            <h5 className="font-bold text-red-700 dark:text-red-400 mb-1.5 flex items-center gap-1">
                                <AlertTriangle size={14} /> Tripped Fail-Safes:
                            </h5>
                            <ul className="text-red-600 dark:text-red-400/90 space-y-1 list-disc pl-4 font-bold">
                                {window.issuesV2.map((issue, idx) => <li key={idx}>{issue}</li>)}
                            </ul>
                        </div>
                    ) : window.pressureDelta3hr >= 1.5 && window.pressureDelta3hr < 4.0 ? (
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-400 font-bold flex items-start gap-1">
                            <Info size={14} className="shrink-0 mt-0.5" />
                            <span>Warning: Moderate pressure drop detected (possible storm front approaching). Keep inspection brief!</span>
                        </div>
                    ) : (
                        <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-xl border border-green-100 dark:border-green-900/30 text-xs text-green-700 dark:text-green-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={14} />
                            <span>Fail-safes cleared! Inspection is safe to conduct.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

function StatCard({ label, value, score, maxScore, isBad }: { label: string; value: string; score?: number; maxScore?: number; isBad?: boolean }) {
    return (
        <div className={`bg-[var(--color-bg-raised)] rounded-lg p-3 border ${isBad ? 'border-red-500' : 'border-[var(--color-card-border)]'}`}>
            <div className="text-[10px] text-[var(--color-text-muted)] font-medium mb-0.5 uppercase tracking-wider">{label}</div>
            <div className="flex justify-between items-end">
                <div className="text-sm font-semibold text-[var(--color-text)]">{value}</div>
                {(score !== undefined && maxScore !== undefined) && (
                    <div className="text-xs font-bold text-[var(--color-text-muted)]">
                        {score}/{maxScore}
                    </div>
                )}
            </div>
        </div>
    );
}
