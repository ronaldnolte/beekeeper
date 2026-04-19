import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

// The core views of our Single Page Application
export type AppView = 
  | 'AUTH'              // Login / Guest screen
  | 'SELECT_APIARY'     // Level 1: Choosing an apiary (Unified Selection UI)
  | 'SELECT_HIVE'       // Level 2: Choosing a hive (Unified Selection UI)
  | 'HIVE_DETAIL'       // Level 3: Viewing hive history & charts
  | 'INSPECTION_FORM'   // Level 4: Inspection overlay
  | 'INTERVENTION_FORM' // Level 4: Intervention overlay
  | 'TASK_FORM'         // Level 4: Task overlay
  | 'STATUS_UPDATE_FORM'// Level 4: Status update overlay
  | 'FORECAST'          // Global: Apiary Forecast
  | 'ASK_AI'            // Global: Ask AI Gemini Assistant
  | 'ROADMAP';          // Global: Feedback & Roadmap

interface AppState {
  currentView: AppView;
  selectedApiaryId: string | null;
  selectedHiveId: string | null;
  selectedInspection: any | null;
  user: User | null;
  isAuthLoading: boolean;
  isFeedbackModalOpen: boolean;
  isApiaryFormOpen: boolean;
  editingApiary: any | null;
  isHiveFormOpen: boolean;
  editingHive: any | null;
  
  // Actions
  setCurrentView: (view: AppView) => void;
  selectApiary: (id: string) => void;
  selectHive: (id: string) => void;
  selectInspection: (inspection: any | null) => void;
  goBack: () => void;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setFeedbackModalOpen: (isOpen: boolean) => void;
  setApiaryFormOpen: (isOpen: boolean, apiaryToEdit?: any) => void;
  setHiveFormOpen: (isOpen: boolean, hiveToEdit?: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'AUTH',
  selectedApiaryId: null,
  selectedHiveId: null,
  selectedInspection: null,
  user: null,
  isAuthLoading: true,
  isFeedbackModalOpen: false,
  isApiaryFormOpen: false,
  editingApiary: null,
  isHiveFormOpen: false,
  editingHive: null,

  setCurrentView: (view) => set({ currentView: view }),
  selectInspection: (inspection) => set({ selectedInspection: inspection }),
  setFeedbackModalOpen: (isOpen) => set({ isFeedbackModalOpen: isOpen }),
  setApiaryFormOpen: (isOpen, apiaryToEdit = null) => set({ isApiaryFormOpen: isOpen, editingApiary: apiaryToEdit }),
  setHiveFormOpen: (isOpen, hiveToEdit = null) => set({ isHiveFormOpen: isOpen, editingHive: hiveToEdit }),

  selectApiary: (id) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'SELECT_HIVE' }, '');
    }
    set({ selectedApiaryId: id, currentView: 'SELECT_HIVE' });
  },

  selectHive: (id) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'HIVE_DETAIL' }, '');
    }
    set({ selectedHiveId: id, currentView: 'HIVE_DETAIL' });
  },

  setUser: (user) => set({ 
    user, 
    currentView: user ? 'SELECT_APIARY' : 'AUTH',
    isAuthLoading: false
  }),
  
  setAuthLoading: (isLoading) => set({ isAuthLoading: isLoading }),

  goBack: () => {
    if (typeof window !== 'undefined') {
      window.history.back(); // Let the browser handle the back action, which fires popstate
    } else {
      // Fallback
      set((state) => {
        if (state.currentView === 'INSPECTION_FORM' || 
            state.currentView === 'INTERVENTION_FORM' ||
            state.currentView === 'TASK_FORM' ||
            state.currentView === 'STATUS_UPDATE_FORM' ||
            state.currentView === 'ROADMAP') {
          return { currentView: state.selectedHiveId ? 'HIVE_DETAIL' : 'SELECT_APIARY' };
        }
        if (state.currentView === 'HIVE_DETAIL') return { currentView: 'SELECT_HIVE' };
        if (state.currentView === 'SELECT_HIVE') return { currentView: 'SELECT_APIARY' };
        return state;
      });
    }
  }
}));
