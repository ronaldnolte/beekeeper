import React, { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import { Auth } from './components/Auth';
import { AppHeader } from './components/AppHeader';
import { ApiarySelectionView } from './views/ApiarySelectionView';
import { HiveSelectionView } from './views/HiveSelectionView';
import { HiveDetailView } from './views/HiveDetailView';
import { InspectionFormView } from './views/InspectionFormView';
import { InterventionFormView } from './views/InterventionFormView';
import { TaskFormView } from './views/TaskFormView';
import { StatusUpdateView } from './views/StatusUpdateView';
import { RoadmapView } from './views/RoadmapView';
import { ForecastView } from './views/ForecastView';
import { FeedbackModal } from './components/FeedbackModal';

function App() {
  const { currentView, setUser, setAuthLoading, isAuthLoading } = useAppStore();

  useEffect(() => {
    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      // Initialize base history state
      if (typeof window !== 'undefined' && session?.user) {
        window.history.replaceState({ view: 'SELECT_APIARY' }, '');
      }
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // 3. HARDWARE BACK BUTTON HIJACK (popstate listener)
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.view) {
        useAppStore.getState().setCurrentView(state.view);
      } else {
        // If we backed all the way out of our history stack but user is logged in
        if (useAppStore.getState().user) {
          useAppStore.getState().setCurrentView('SELECT_APIARY');
        } else {
          useAppStore.getState().setCurrentView('AUTH');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, [setUser]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-[var(--color-text)] font-bold">Waking up the bees...</p>
        </div>
      </div>
    );
  }

  // --- THE SPA VIEW SWITCHER ---
  return (
    <div className="w-full min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col">
      <AppHeader />
      
      <main className="flex-1 overflow-y-auto">
        {currentView === 'AUTH' && <Auth />}
        
        {currentView === 'SELECT_APIARY' && <ApiarySelectionView />}

        {currentView === 'SELECT_HIVE' && <HiveSelectionView />}

        {currentView === 'HIVE_DETAIL' && <HiveDetailView />}

        {currentView === 'INSPECTION_FORM' && <InspectionFormView />}

        {currentView === 'INTERVENTION_FORM' && <InterventionFormView />}

        {currentView === 'TASK_FORM' && <TaskFormView />}

        {currentView === 'STATUS_UPDATE_FORM' && <StatusUpdateView />}

        {currentView === 'FORECAST' && <ForecastView />}

        {currentView === 'ROADMAP' && <RoadmapView />}
      </main>

      {/* Global Modals */}
      <FeedbackModal />
    </div>
  );
}

export default App;
