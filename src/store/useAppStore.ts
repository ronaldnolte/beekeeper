import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../data/supabase';
import { fetchApiaries } from '../data/apiaryRepository';
import { fetchUserRoles } from '../data/roleRepository';

// The core views of our Single Page Application
export type AppView = 
  | 'AUTH'              // Login / Guest screen
  | 'DASHBOARD'         // Root Tab 1: Global overview, stats, tasks
  | 'SELECT_APIARY'     // Root Tab 2: Geographical Yard selection
  | 'SELECT_HIVE'       // Root Tab 3/Overlay: Choosing a hive (Dynamic Unified/Flat View)
  | 'HIVE_DETAIL'       // Detail View: Viewing hive history & charts
  | 'INSPECTION_FORM'   // Form: Inspection overlay
  | 'INSPECTION_PLUS'   // Inspection Plus: photos & voice attachments (screen 2)
  | 'INTERVENTION_FORM' // Form: Intervention overlay
  | 'VARROA_FORM'       // Form: Varroa testing overlay
  | 'TASK_FORM'         // Form: Task overlay
  | 'STATUS_UPDATE_FORM'// Form: Status update overlay
  | 'FORECAST'          // Root Tab 4: Dynamic weather forecast
  | 'NECTAR_FLOW'        // Root Tab 6: Localized Nectar Flow Index
  | 'ASK_AI'            // Root Tab 5: AI chat assistant
  | 'ROADMAP'           // Global: Feedback & Roadmap
  | 'UPDATE_PASSWORD'   // Global: Reset password flow
  | 'BETA_SIGNUP';      // Public: Closed Beta signup waitlist

// Discriminated union for selected records (replaces `selectedInspection: any`)
export type SelectedRecord =
  | { _model_type: 'inspection'; id: string; [key: string]: any }
  | { _model_type: 'intervention'; id: string; [key: string]: any }
  | { _model_type: 'task'; id: string; [key: string]: any }
  | { _model_type: 'varroa_test'; id: string; [key: string]: any }
  | null;

interface AppState {
  currentView: AppView;
  selectedApiaryId: string | null;
  selectedHiveId: string | null;
  selectedRecord: SelectedRecord;
  user: User | null;
  userRoles: string[];
  isAuthLoading: boolean;
  isFeedbackModalOpen: boolean;
  isApiaryFormOpen: boolean;
  editingApiary: any | null;
  isHiveFormOpen: boolean;
  editingHive: any | null;
  
  // Navigation Context Caches
  apiariesList: any[];
  hivesList: any[];
  isLoadingNavigation: boolean;
  selectedApiaryName: string | null;
  selectedHiveName: string | null;
  isUnifiedHiveView: boolean;
  
  // Actions
  navigateTo: (view: AppView) => void;
  setCurrentView: (view: AppView) => void;
  selectApiary: (id: string, name?: string) => void;
  selectHive: (id: string, name?: string) => void;
  selectRecord: (record: SelectedRecord) => void;
  // Legacy alias — kept so existing HistoryFeed code doesn't break during migration
  selectInspection: (record: any | null) => void;
  goBack: () => void;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setFeedbackModalOpen: (isOpen: boolean) => void;
  setApiaryFormOpen: (isOpen: boolean, apiaryToEdit?: any) => void;
  setHiveFormOpen: (isOpen: boolean, hiveToEdit?: any) => void;
  
  // New Dynamic Actions
  loadNavigationContext: (userId: string) => Promise<void>;
  loadUserRoles: (userId: string) => Promise<void>;
  hasRole: (role: string) => boolean;
  navigateToApiariesTab: () => void;
  navigateToHivesTab: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
      currentView: 'AUTH',
      selectedApiaryId: null,
      selectedHiveId: null,
      selectedRecord: null,
      user: null,
      userRoles: [],
      isAuthLoading: true,
      isFeedbackModalOpen: false,
      isApiaryFormOpen: false,
      editingApiary: null,
      isHiveFormOpen: false,
      editingHive: null,

      // Navigation caches
      apiariesList: [],
      hivesList: [],
      isLoadingNavigation: false,
      selectedApiaryName: null,
      selectedHiveName: null,
      isUnifiedHiveView: false,

      // Centralized navigation — always pushes history state
      navigateTo: (view) => {
        if (typeof window !== 'undefined') {
          window.history.pushState({ view }, '');
        }
        set({ currentView: view });
      },

      // Simple setter (used internally by goBack, setUser — no pushState needed)
      setCurrentView: (view) => set({ currentView: view }),

      selectRecord: (record) => set({ selectedRecord: record }),
      // Legacy alias — maps to selectRecord
      selectInspection: (record) => set({ selectedRecord: record }),

      setFeedbackModalOpen: (isOpen) => set({ isFeedbackModalOpen: isOpen }),
      setApiaryFormOpen: (isOpen, apiaryToEdit = null) => set({ isApiaryFormOpen: isOpen, editingApiary: apiaryToEdit }),
      setHiveFormOpen: (isOpen, hiveToEdit = null) => set({ isHiveFormOpen: isOpen, editingHive: hiveToEdit }),

      selectApiary: (id, name) => {
        if (typeof window !== 'undefined') {
          window.history.pushState({ view: 'SELECT_HIVE' }, '');
        }
        set({ 
          selectedApiaryId: id, 
          selectedApiaryName: name || null, 
          isUnifiedHiveView: false,
          currentView: 'SELECT_HIVE' 
        });
      },

      selectHive: (id, name) => {
        if (typeof window !== 'undefined') {
          window.history.pushState({ view: 'HIVE_DETAIL' }, '');
        }
        set({ selectedHiveId: id, selectedHiveName: name || null, currentView: 'HIVE_DETAIL' });
      },

      loadNavigationContext: async (userId) => {
        set({ isLoadingNavigation: true });
        try {
          const apiaries = await fetchApiaries(userId);
          let hives: any[] = [];
          
          if (apiaries.length > 0) {
            const apiaryIds = apiaries.map((a: any) => a.id);
            const { data, error } = await supabase
              .from('hives')
              .select('*')
              .in('apiary_id', apiaryIds)
              .order('name', { ascending: true });
              
            if (!error && data) {
              hives = data;
            }
          }
          
          set({ 
            apiariesList: apiaries, 
            hivesList: hives, 
            isLoadingNavigation: false 
          });
        } catch (e) {
          console.error("Failed to load navigation context", e);
          set({ isLoadingNavigation: false });
        }
      },

      loadUserRoles: async (userId) => {
        const roles = await fetchUserRoles(userId);
        set({ userRoles: roles });
      },

      hasRole: (role) => get().userRoles.includes(role),

      navigateToApiariesTab: () => {
        // Reset sub-selections
        set({ 
          selectedApiaryId: null, 
          selectedApiaryName: null, 
          selectedHiveId: null, 
          selectedHiveName: null,
          isUnifiedHiveView: false 
        });
        
        if (typeof window !== 'undefined') {
          window.history.pushState({ view: 'SELECT_APIARY' }, '');
        }
        
        set({ currentView: 'SELECT_APIARY' });
      },

      navigateToHivesTab: () => {
        const { apiariesList, hivesList } = get();
        
        if (hivesList.length > 0 && hivesList.length <= 5) {
          // Unified Hive View (1-5 Hives) -> bypasses apiaries, acts as root tab
          set({ 
            selectedApiaryId: null, 
            selectedApiaryName: null, 
            selectedHiveId: null, 
            selectedHiveName: null,
            isUnifiedHiveView: true 
          });
          
          if (typeof window !== 'undefined') {
            window.history.pushState({ view: 'SELECT_HIVE' }, '');
          }
          set({ currentView: 'SELECT_HIVE' });
        } else if (hivesList.length === 0 && apiariesList.length === 1) {
          // Exactly 1 empty apiary -> route directly to SELECT_HIVE
          const apiary = apiariesList[0];
          set({ 
            selectedApiaryId: apiary.id, 
            selectedApiaryName: apiary.name, 
            selectedHiveId: null, 
            selectedHiveName: null,
            isUnifiedHiveView: false 
          });
          
          if (typeof window !== 'undefined') {
            window.history.pushState({ view: 'SELECT_HIVE' }, '');
          }
          set({ currentView: 'SELECT_HIVE' });
        } else {
          // Normal Flat Hives Tab Mode (Either >5 hives or 0 hives with 0/multiple apiaries)
          set({ 
            selectedApiaryId: null, 
            selectedApiaryName: null, 
            selectedHiveId: null, 
            selectedHiveName: null,
            isUnifiedHiveView: true // Treated as a flat list but with filter options
          });
          
          if (typeof window !== 'undefined') {
            window.history.pushState({ view: 'SELECT_HIVE' }, '');
          }
          set({ currentView: 'SELECT_HIVE' });
        }
      },

      setUser: (user) => set((state) => {
        if (!user) {
          if (state.currentView === 'UPDATE_PASSWORD' || state.currentView === 'BETA_SIGNUP') {
            return { user: null, userRoles: [], isAuthLoading: false };
          }
          // Clear all sensitive state on logout
          return {
            user: null,
            userRoles: [],
            currentView: 'AUTH',
            isAuthLoading: false,
            selectedApiaryId: null,
            selectedHiveId: null,
            selectedRecord: null,
            apiariesList: [],
            hivesList: [],
            selectedApiaryName: null,
            selectedHiveName: null,
            isUnifiedHiveView: false,
          };
        }
        
        // Land on DASHBOARD on login
        const nextView = (state.currentView === 'AUTH' || !state.currentView) ? 'DASHBOARD' : state.currentView;
        
        // Fire loading context + roles in background
        setTimeout(() => {
          get().loadNavigationContext(user.id);
          get().loadUserRoles(user.id);
        }, 50);

        return { 
          user, 
          currentView: nextView,
          isAuthLoading: false
        };
      }),
      
      setAuthLoading: (isLoading) => set({ isAuthLoading: isLoading }),

      goBack: () => set((state) => {
        let prevView: AppView = 'DASHBOARD';
        let apiaryName = state.selectedApiaryName;
        let hiveName = state.selectedHiveName;
        let isUnified = state.isUnifiedHiveView;
        
        if (state.currentView === 'SELECT_HIVE') {
          // If SELECT_HIVE was unified, going back is not expected (no button shown), fallback is Dashboard
          prevView = isUnified ? 'DASHBOARD' : 'SELECT_APIARY';
          if (!isUnified) {
            apiaryName = null;
          }
        } else if (state.currentView === 'HIVE_DETAIL') {
          prevView = 'SELECT_HIVE';
          hiveName = null;
        } else if (state.currentView === 'INSPECTION_PLUS') {
          // Plus attachments screen returns to the inspection form it opened from
          prevView = 'INSPECTION_FORM';
        } else if (
          ['INSPECTION_FORM', 'INTERVENTION_FORM', 'VARROA_FORM', 'TASK_FORM', 'STATUS_UPDATE_FORM'].includes(state.currentView)
        ) {
          prevView = 'HIVE_DETAIL';
        } else if (
          ['FORECAST', 'NECTAR_FLOW', 'ASK_AI', 'ROADMAP', 'UPDATE_PASSWORD'].includes(state.currentView)
        ) {
          prevView = 'DASHBOARD';
        }
        
        return { 
          currentView: prevView, 
          selectedRecord: null,
          selectedApiaryName: apiaryName,
          selectedHiveName: hiveName
        };
      })
}));
