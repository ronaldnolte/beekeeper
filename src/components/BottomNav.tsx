import { CloudSun, Flower, Hexagon, LayoutDashboard, Map, Sparkles, type LucideIcon } from 'lucide-react';
import { useApp } from '../app/store';

// SPEC A §5: six targets (Feedback and Log Out live on Profile — SCAR S-UI-3). Stays dark.
export function BottomNav() {
  const { state, navigate, openApiariesTab, openHivesTab } = useApp();
  const v = state.view;

  const tabs: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }[] = [
    { label: 'Dashboard', icon: LayoutDashboard, active: v === 'DASHBOARD', onClick: () => navigate('DASHBOARD', { keepRecord: false }) },
    { label: 'Apiaries', icon: Map, active: v === 'SELECT_APIARY' || (v === 'SELECT_HIVE' && !state.isUnified), onClick: openApiariesTab },
    { label: 'Hives', icon: Hexagon, active: (v === 'SELECT_HIVE' && state.isUnified) || v === 'HIVE_DETAIL', onClick: openHivesTab },
    { label: 'Forecast', icon: CloudSun, active: v === 'FORECAST', onClick: () => navigate('FORECAST', { keepRecord: false }) },
    { label: 'Nectar', icon: Flower, active: v === 'NECTAR_FLOW', onClick: () => navigate('NECTAR_FLOW', { keepRecord: false }) },
    { label: 'Ask AI', icon: Sparkles, active: v === 'ASK_AI', onClick: () => navigate('ASK_AI', { keepRecord: false }) },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto w-[96%] max-w-[500px] h-16 rounded-full bg-[#1a1a2e] border border-[#2a2a4a] shadow-2xl flex items-stretch px-2">
        {tabs.map(({ label, icon: Icon, active, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 ${active ? 'text-primary font-black' : 'text-white/50'}`}
          >
            {active && (
              <span
                className="absolute top-1 w-5 h-1 rounded-full bg-primary animate-fade-quick"
                style={{ boxShadow: '0 0 8px var(--color-primary-glow)' }}
              />
            )}
            <Icon size={22} className={`transition-transform duration-[var(--duration-base)] ${active ? 'scale-110' : ''}`} />
            <span className="text-[9px] leading-none">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
