import React from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { LogOut, ArrowLeft, Mail } from 'lucide-react';

export const AppHeader: React.FC = () => {
  const { currentView, goBack, user } = useAppStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Determine if we should show a back button
  const showBackButton = currentView !== 'SELECT_APIARY' && currentView !== 'AUTH';

  // Determine title based on view
  let title = 'Beekeeper';
  if (currentView === 'SELECT_APIARY') title = 'Select Apiary';
  if (currentView === 'SELECT_HIVE') title = 'Select Hive';
  if (currentView === 'HIVE_DETAIL') title = 'Hive Details';

  if (!user) return null; // Don't show header on login screen

  return (
    <header className="glass-header sticky top-0 z-50 flex justify-center w-full">
      <div className="w-full max-w-4xl px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {showBackButton && (
          <button 
            onClick={goBack}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-[#E67E22] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Beektools" className="w-8 h-8 object-contain" />
          <h1 className="text-lg font-black text-[var(--color-card-text)]">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-xs text-gray-500 font-medium hidden sm:block truncate max-w-[120px]">
          {user.email}
        </div>
        
        {/* Ask AI Button */}
        <button 
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({ view: 'ASK_AI' }, '');
            }
            useAppStore.getState().setCurrentView('ASK_AI');
          }}
          className="w-9 h-9 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition-transform active:scale-95 shadow-sm ml-1"
          title="Ask AI Beekeeper"
        >
          <span className="text-sm">✨</span>
        </button>
        
        {/* Feedback Button */}
        <button 
          onClick={() => useAppStore.getState().setFeedbackModalOpen(true)}
          className="w-9 h-9 rounded-full bg-[#F5A623] hover:bg-[#D97706] text-white flex items-center justify-center transition-transform active:scale-95 shadow-sm ml-1"
          title="Send Feedback"
        >
          <Mail size={18} />
        </button>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors flex items-center gap-1 ml-1"
          title="Log Out"
        >
          <LogOut size={18} />
        </button>
      </div>
      </div>
    </header>
  );
};
