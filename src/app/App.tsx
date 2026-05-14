import { useEffect } from 'react';
import { supabase } from '../data/supabase';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAppStore } from '../store/useAppStore';
import { Auth } from '../features/auth/Auth';
import { AppHeader } from './AppHeader';
import { ApiarySelectionView } from '../features/apiary/ApiarySelectionView';
import { HiveSelectionView } from '../features/hive/HiveSelectionView';
import { HiveDetailView } from '../features/hive/HiveDetailView';
import { InspectionFormView } from '../features/inspection/InspectionFormView';
import { InterventionFormView } from '../features/inspection/InterventionFormView';
import { StatusUpdateView } from '../features/inspection/StatusUpdateView';
import { RoadmapView } from '../features/feedback/RoadmapView';
import { ForecastView } from '../features/forecast/ForecastView';
import { SwarmPredictionView } from '../features/swarm/SwarmPredictionView';
import { AskAIView } from '../features/ai/AskAIView';
import { UpdatePasswordView } from '../features/auth/UpdatePasswordView';
import { FeedbackModal } from '../features/feedback/FeedbackModal';
import { TaskFormModal } from '../features/tasks/TaskFormModal';

function App() {
  const { currentView, setUser, isAuthLoading, selectedHiveId, selectedApiaryId, selectedRecord } = useAppStore();

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

    // 3. BROWSER BACK BUTTON — read the view from history state
    const handlePopState = (event: PopStateEvent) => {
      const view = event.state?.view;
      if (view) {
        // Sync the store to whatever history entry the browser navigated to
        useAppStore.getState().setCurrentView(view);
        useAppStore.getState().selectRecord(null);
      } else {
        // No state means we've gone back before any pushState — go to dashboard
        const user = useAppStore.getState().user;
        if (user) {
          useAppStore.getState().setCurrentView('SELECT_APIARY');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Capacitor Hardware Back Button Support (Android)
    let backButtonListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', () => {
        // Use browser history.back() so it triggers the same popstate handler
        if (useAppStore.getState().currentView === 'SELECT_APIARY') {
          // At the top level — exit the app
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
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

        {/* TASK_FORM now uses the consolidated modal */}
        {currentView === 'TASK_FORM' && (
          <TaskFormModal
            isOpen={true}
            onClose={() => useAppStore.getState().goBack()}
            onSuccess={() => useAppStore.getState().goBack()}
            initialData={selectedRecord?._model_type === 'task' ? selectedRecord : undefined}
            defaultHiveId={selectedHiveId || undefined}
            defaultApiaryId={selectedApiaryId || undefined}
          />
        )}

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
