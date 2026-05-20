import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { LayoutDashboard, Map, Hexagon, CloudSun, Sparkles } from 'lucide-react';

export const BottomNavBar: React.FC = () => {
  const { currentView, isUnifiedHiveView, navigateTo, navigateToApiariesTab, navigateToHivesTab } = useAppStore();

  // Only render the floating bottom bar on the 5 root-level tabs
  const showNavBar = [
    'DASHBOARD',
    'SELECT_APIARY',
    'SELECT_HIVE',
    'FORECAST',
    'ASK_AI'
  ].includes(currentView);

  if (!showNavBar) return null;

  // Determine active tab
  const isDashboardActive = currentView === 'DASHBOARD';
  const isApiaryActive = currentView === 'SELECT_APIARY' || (currentView === 'SELECT_HIVE' && !isUnifiedHiveView);
  const isHivesActive = (currentView === 'SELECT_HIVE' && isUnifiedHiveView) || currentView === 'HIVE_DETAIL';
  const isForecastActive = currentView === 'FORECAST';
  const isAskAIActive = currentView === 'ASK_AI';

  const tabs = [
    {
      id: 'DASHBOARD',
      label: 'Dashboard',
      icon: <LayoutDashboard size={20} />,
      isActive: isDashboardActive,
      onClick: () => navigateTo('DASHBOARD'),
    },
    {
      id: 'APIARIES',
      label: 'Apiaries',
      icon: <Map size={20} />,
      isActive: isApiaryActive,
      onClick: navigateToApiariesTab,
    },
    {
      id: 'HIVES',
      label: 'Hives',
      icon: <Hexagon size={20} />,
      isActive: isHivesActive,
      onClick: navigateToHivesTab,
    },
    {
      id: 'FORECAST',
      label: 'Forecast',
      icon: <CloudSun size={20} />,
      isActive: isForecastActive,
      onClick: () => navigateTo('FORECAST'),
    },
    {
      id: 'ASK_AI',
      label: 'Ask AI',
      icon: <Sparkles size={20} />,
      isActive: isAskAIActive,
      onClick: () => navigateTo('ASK_AI'),
    },
  ];

  return (
    <div className="w-full flex-shrink-0 flex justify-center pt-2 z-40" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 12px))' }}>
      <div className="w-[92%] max-w-md h-16 rounded-full px-4 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.15)] bg-[#1a1a2e] border border-[#2a2a4a]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={tab.onClick}
            className={`flex flex-col items-center justify-center flex-1 h-full rounded-2xl transition-all duration-300 relative select-none outline-none active:scale-95 ${
              tab.isActive 
                ? 'text-[#F5A623] font-black' 
                : 'text-white/50 hover:text-white/80 font-semibold'
            }`}
          >
            {/* Subtle top indicator bar */}
            {tab.isActive && (
              <span className="absolute top-1 w-5 h-1 rounded-full bg-[#F5A623] shadow-[0_0_8px_rgba(245,166,35,0.5)] animate-pulse" />
            )}
            
            <div className={`transition-transform duration-300 ${tab.isActive ? 'scale-110 translate-y-0.5' : 'scale-100'}`}>
              {tab.icon}
            </div>
            
            <span className="text-[10px] mt-1 tracking-tight select-none">
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
