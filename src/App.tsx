import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
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
import { SwarmPredictionView } from './views/SwarmPredictionView';
import { AskAIView } from './views/AskAIView';
import { UpdatePasswordView } from './views/UpdatePasswordView';
import { FeedbackModal } from './components/FeedbackModal';

function App() {
  const { currentView, setUser, isAuthLoading } = useAppStore();

  useEffect(() => {
    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      // Initialize base history state with whatever was persisted
      if (typeof window !== 'undefined' && session?.user) {
        const persistedView = useAppStore.getState().currentView;
        const targetView = (persistedView === 'AUTH' || !persistedView) ? 'SELECT_APIARY' : persistedView;
        window.history.replaceState({ view: targetView }, '');
      }
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      // If the user clicked a "Reset Password" link in their email, route them to the update screen
      if (event === 'PASSWORD_RECOVERY') {
        useAppStore.getState().setCurrentView('UPDATE_PASSWORD');
      }
    });

    // FOOLPROOF ROUTING BYPASS: If the URL physically contains /auth/update-password, lock the screen!
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/update-password') {
      useAppStore.getState().setCurrentView('UPDATE_PASSWORD');
    }

    // 3. HARDWARE BACK BUTTON HIJACK (popstate listener & Capacitor)
    const handlePopState = () => {
      // The popstate is handled correctly by our new hierarchical routing
    };

    window.addEventListener('popstate', handlePopState);

    // Capacitor Hardware Back Button Support (Android)
    let backButtonListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', () => {
        // If we can go back in the SPA history, we'll let our store handle it hierarchically
        useAppStore.getState().goBack();
      }).then((listener: any) => {
        backButtonListener = listener;
      });
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
      if (backButtonListener) backButtonListener.remove();
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

        {currentView === 'ASK_AI' && <AskAIView />}

        {currentView === 'SWARM_PREDICTION' && <SwarmPredictionView />}

        {currentView === 'ROADMAP' && <RoadmapView />}

        {currentView === 'UPDATE_PASSWORD' && <UpdatePasswordView />}
      </main>

      {/* Global Modals */}
      <FeedbackModal />
    </div>
  );
}

export default App;
