import { useEffect, Suspense, lazy } from 'react';
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
import { VarroaFormView } from '../features/varroa/VarroaFormView';
import { StatusUpdateView } from '../features/inspection/StatusUpdateView';
import { UpdatePasswordView } from '../features/auth/UpdatePasswordView';
import { FeedbackModal } from '../features/feedback/FeedbackModal';
import { TaskFormModal } from '../features/tasks/TaskFormModal';
import { DashboardView } from '../features/dashboard/DashboardView';
import { BottomNavBar } from './BottomNavBar';
import { BetaSignupView } from '../features/auth/BetaSignupView';

// Lazy-loaded leaf features — only fetched when navigated to
const ForecastView = lazy(() => import('../features/forecast/ForecastView').then(m => ({ default: m.ForecastView })));
const AskAIView = lazy(() => import('../features/ai/AskAIView').then(m => ({ default: m.AskAIView })));
const RoadmapView = lazy(() => import('../features/feedback/RoadmapView').then(m => ({ default: m.RoadmapView })));

// Shared Suspense fallback for lazy-loaded views
const ViewLoader = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 opacity-50">
    <div className="w-10 h-10 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="font-bold text-[var(--color-text)]">Loading...</p>
  </div>
);

function App() {
  const { currentView, setUser, user, isAuthLoading, selectedHiveId, selectedApiaryId, selectedRecord } = useAppStore();

  useEffect(() => {
    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        useAppStore.getState().loadNavigationContext(session.user.id);
        const persistedView = useAppStore.getState().currentView;
        const targetView = (persistedView === 'AUTH' || !persistedView) ? 'DASHBOARD' : persistedView;
        window.history.replaceState({ view: targetView }, '');
      }
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        useAppStore.getState().loadNavigationContext(session.user.id);
      }
      
      // If the user clicked a "Reset Password" link in their email, route them to the update screen
      if (event === 'PASSWORD_RECOVERY') {
        useAppStore.getState().setCurrentView('UPDATE_PASSWORD');
      }
    });

    // FOOLPROOF ROUTING BYPASS: If the URL physically contains /auth/update-password, lock the screen!
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/update-password') {
      useAppStore.getState().setCurrentView('UPDATE_PASSWORD');
    }

    if (typeof window !== 'undefined' && window.location.pathname === '/beta') {
      useAppStore.getState().setCurrentView('BETA_SIGNUP');
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
          useAppStore.getState().setCurrentView('DASHBOARD');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Capacitor Hardware Back Button Support (Android)
    let backButtonListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', () => {
        // Use browser history.back() so it triggers the same popstate handler
        if (useAppStore.getState().currentView === 'DASHBOARD') {
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
          <div className="w-16 h-16 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-[var(--color-text)] font-bold">Waking up the bees...</p>
        </div>
        {/* Dark background bar under the system navigation buttons */}
        <div 
          className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] z-[9999] pointer-events-none" 
          style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
        />
      </div>
    );
  }

  // Auth guard — prevent protected views from rendering without a session
  if (!user) {
    if (currentView === 'BETA_SIGNUP') {
      return <BetaSignupView />;
    }
    if (currentView !== 'AUTH' && currentView !== 'UPDATE_PASSWORD') {
      return <Auth />;
    }
  }

  // --- THE SPA VIEW SWITCHER ---
  return (
    <div className="w-full h-[100dvh] bg-[var(--color-bg)] text-[var(--color-text)] flex flex-col font-sans overflow-hidden">
      <AppHeader />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {currentView === 'AUTH' && <Auth />}
        
        {currentView === 'DASHBOARD' && <DashboardView />}
        
        {currentView === 'SELECT_APIARY' && <ApiarySelectionView />}

        {currentView === 'SELECT_HIVE' && <HiveSelectionView />}

        {currentView === 'HIVE_DETAIL' && <HiveDetailView />}

        {currentView === 'INSPECTION_FORM' && <InspectionFormView />}

        {currentView === 'INTERVENTION_FORM' && <InterventionFormView />}

        {currentView === 'VARROA_FORM' && <VarroaFormView />}

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

        {currentView === 'FORECAST' && (
          <Suspense fallback={<ViewLoader />}>
            <ForecastView />
          </Suspense>
        )}

        {currentView === 'ASK_AI' && (
          <Suspense fallback={<ViewLoader />}>
            <AskAIView />
          </Suspense>
        )}


        {currentView === 'ROADMAP' && (
          <Suspense fallback={<ViewLoader />}>
            <RoadmapView />
          </Suspense>
        )}

        {currentView === 'UPDATE_PASSWORD' && <UpdatePasswordView />}
        
        {currentView === 'BETA_SIGNUP' && <BetaSignupView />}
      </main>

      <BottomNavBar />

      {/* Global Modals */}
      <FeedbackModal />

      {/* Dark background bar under the system navigation buttons */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] z-[9999] pointer-events-none" 
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />
    </div>
  );
}

export default App;
