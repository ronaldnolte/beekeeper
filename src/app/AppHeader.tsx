import React from 'react';
import { supabase } from '../data/supabase';
import { useAppStore } from '../store/useAppStore';
import { LogOut, ArrowLeft, Mail, Sparkles } from 'lucide-react';

export const AppHeader: React.FC = () => {
  const { currentView, user, navigateTo } = useAppStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Determine if we should show a back button
  const showBackButton = currentView !== 'SELECT_APIARY' && currentView !== 'AUTH';

  // Expanded title map for all views
  const titleMap: Record<string, string> = {
    'SELECT_APIARY': 'Dashboard',
    'SELECT_HIVE': 'Hives',
    'HIVE_DETAIL': 'Hive Details',
    'INSPECTION_FORM': 'Inspection',
    'INTERVENTION_FORM': 'Intervention',
    'TASK_FORM': 'Task',
    'FORECAST': 'Forecast',
    'SWARM_PREDICTION': 'Swarm Index',
    'ASK_AI': 'Ask AI',
    'ROADMAP': 'Roadmap',
    'UPDATE_PASSWORD': 'Password',
  };
  const title = titleMap[currentView] || 'Beekeeper';

  if (!user) return null;

  return (
    <header className="glass-header sticky top-0 z-50 flex justify-center w-full" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="w-full max-w-4xl px-4 py-3 flex items-center justify-between">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <button 
              onClick={() => window.history.back()}
              className="p-2 -ml-2 rounded-xl text-[var(--color-primary)] hover:bg-[var(--color-bg-raised)] transition-colors active:scale-95"
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <img src="/logo.png" alt="Beektools" className="w-8 h-8 object-contain" />
          )}
          <h1 className="text-lg font-black text-[var(--color-text)]">{title}</h1>
        </div>

        {/* Right: Action Icons */}
        <div className="flex items-center gap-1">
          {/* Ask AI — only show after apiary is selected */}
          {currentView !== 'SELECT_APIARY' && (
            <button 
              onClick={() => navigateTo('ASK_AI')}
              className="w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95 text-[var(--color-primary)] hover:bg-[var(--color-bg-raised)]"
              title="Ask AI Beekeeper"
            >
              <Sparkles size={18} />
              <span className="text-[9px] font-bold leading-none">Ask AI</span>
            </button>
          )}
          
          {/* Feedback */}
          <button 
            onClick={() => useAppStore.getState().setFeedbackModalOpen(true)}
            className="w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-raised)]"
            title="Send Feedback"
          >
            <Mail size={16} />
            <span className="text-[9px] font-bold leading-none">Feedback</span>
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95 text-red-400 hover:bg-red-500/10"
            title="Log Out"
          >
            <LogOut size={16} />
            <span className="text-[9px] font-bold leading-none">Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
