import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AppView } from '../../store/useAppStore';

interface SubTabBarProps {
  activeView: AppView;
}

export const SubTabBar: React.FC<SubTabBarProps> = ({ activeView }) => {
  const { navigateTo, selectInspection } = useAppStore();

  const tabs = [
    { view: 'INSPECTION_FORM' as AppView, label: 'Inspections' },
    { view: 'INTERVENTION_FORM' as AppView, label: 'Interventions' },
    { view: 'VARROA_FORM' as AppView, label: 'Varroa' },
    { view: 'TASK_FORM' as AppView, label: 'Tasks' },
  ];

  return (
    <div className="w-full max-w-2xl flex justify-around border-b border-[var(--color-divider)] mb-4 px-2">
      {tabs.map((t) => {
        const isActive = activeView === t.view;
        return (
          <button
            key={t.view}
            onClick={() => {
              selectInspection(null);
              navigateTo(t.view);
            }}
            className={`pb-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all relative outline-none cursor-pointer active:scale-95 ${
              isActive 
                ? 'text-[var(--color-primary-dark)] font-black' 
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {t.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--color-primary)] rounded-full shadow-[0_0_8px_rgba(233,155,26,0.5)]" />
            )}
          </button>
        );
      })}
    </div>
  );
};
