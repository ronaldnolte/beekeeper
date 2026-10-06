import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../data/supabase';
import { fetchApiaries } from '../data/apiaryRepository';
import { fetchUserRoles } from '../data/roleRepository';
import { fetchSignInProfile } from '../data/profileRepository';
import { setAnalyticsOptOut } from '../shared/analytics';

// The core views of our Single Page Application
export type AppView = 
  | 'AUTH'              // Login / Guest screen
  | 'DASHBOARD'         // Root Tab 1: Global overview, stats, tasks
  | 'SELECT_APIARY'     // Root Tab 2: Geographical Yard selection
  | 'SELECT_HIVE'       // Root Tab 3/Overlay: Choosing a hive (Dynamic Unified/Flat View)
  | 'HIVE_DETAIL'       // Detail View: Viewing hive history & charts
  | 'INSPECTION_FORM'      // Form: Inspection overlay
  | 'INSPECTION_PLUS'      // Inspection: photos & voice attachments
  | 'INTERVENTION_FORM' // Form: Intervention overlay
  | 'VARROA_FORM'       // Form: Varroa testing overlay
  | 'TASK_FORM'         // Form: Task overlay
  | 'STATUS_UPDATE_FORM'// Form: Status update overlay
  | 'FORECAST'          // Root Tab 4: Dynamic weather forecast
  | 'NECTAR_FLOW'        // Root Tab 6: Localized Nectar Flow Index
  | 'ASK_AI'            // Root Tab 5: AI chat assistant
  | 'ROADMAP'           // Global: Feedback & Roadmap
  | 'PROFILE'           // Global: the beekeeper's own preferences (who they are, how they keep bees)
  | 'SETTINGS'          // Global: privacy, account actions, app version
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
  /** The name saved on the profile, for the Dashboard greeting. Null = none saved. */
  displayName: string | null;
  setDisplayName: (name: string | null) => void;
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
  /** True once the first apiary/hive load for this user has finished (success or failure). */
  hasLoadedNavigation: boolean;
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

// Startup can ask for the same load several times within a few milliseconds
// (session check + auth events). Requests that arrive while one is running
// share it instead of firing another round of identical queries.
let navLoad: { userId: string; promise: Promise<void> } | null = null;
let rolesLoad: { userId: string; promise: Promise<void> } | null = null;

export const useAppStore = create<AppState>()((set, get) => ({
      currentView: 'AUTH',
      selectedApiaryId: null,
      selectedHiveId: null,
      selectedRecord: null,
      user: null,
      userRoles: [],
      displayName: null,
      setDisplayName: (name) => set({ displayName: name?.trim() || null }),
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
      hasLoadedNavigation: false,
      selectedApiaryName: null,
      selectedHiveName: null,
      isUnifiedHiveView: false,

      // Centralized navigation — pushes history state including current record ID
      navigateTo: (view) => {
        if (typeof window !== 'undefined') {
          const recordId = useAppStore.getState().selectedRecord?.id ?? null;
          window.history.pushState({ view, recordId }, '');
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

      loadNavigationContext: (userId) => {
        if (navLoad?.userId === userId) return navLoad.promise;
        const promise = (async () => {
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
            isLoadingNavigation: false,
            hasLoadedNavigation: true
          });
        } catch (e) {
          console.error("Failed to load navigation context", e);
          set({ isLoadingNavigation: false, hasLoadedNavigation: true });
        }
        })().finally(() => {
          if (navLoad?.promise === promise) navLoad = null;
        });
        navLoad = { userId, promise };
        return promise;
      },

      loadUserRoles: (userId) => {
        if (rolesLoad?.userId === userId) return rolesLoad.promise;
        const promise = fetchUserRoles(userId)
          .then((roles) => set({ userRoles: roles }))
          .finally(() => {
            if (rolesLoad?.promise === promise) rolesLoad = null;
          });
        rolesLoad = { userId, promise };
        return promise;
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
            return { user: null, userRoles: [], displayName: null, isAuthLoading: false };
          }
          // Clear all sensitive state on logout
          return {
            user: null,
            userRoles: [],
            displayName: null,
            currentView: 'AUTH',
            isAuthLoading: false,
            selectedApiaryId: null,
            selectedHiveId: null,
            selectedRecord: null,
            apiariesList: [],
            hivesList: [],
            hasLoadedNavigation: false,
            selectedApiaryName: null,
            selectedHiveName: null,
            isUnifiedHiveView: false,
          };
        }
        
        // Land on DASHBOARD on login
        const nextView = (state.currentView === 'AUTH' || !state.currentView) ? 'DASHBOARD' : state.currentView;
        
        // Fire loading context + roles in background — only when the signed-in
        // user actually changes. Auth events repeat setUser for the same user
        // (initial session, token refresh); App.tsx refreshes on SIGNED_IN.
        if (state.user?.id !== user.id) {
          setTimeout(() => {
            get().loadNavigationContext(user.id);
            get().loadUserRoles(user.id);
            // Profile values needed app-wide: the analytics choice (e.g. made
            // on another device; unknown -> leave this device alone) and the
            // name the Dashboard greets with.
            fetchSignInProfile(user.id).then((p) => {
              if (!p) return;
              setAnalyticsOptOut(p.analyticsOptOut);
              set({ displayName: p.displayName });
            });
          }, 50);
        }

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
          // Return to the inspection form with the record still selected so the form stays open
          return {
            currentView: 'INSPECTION_FORM',
            selectedApiaryName: apiaryName,
            selectedHiveName: hiveName,
          };
        } else if (
          ['INSPECTION_FORM', 'INTERVENTION_FORM', 'VARROA_FORM', 'TASK_FORM', 'STATUS_UPDATE_FORM'].includes(state.currentView)
        ) {
          prevView = 'HIVE_DETAIL';
        } else if (
          ['FORECAST', 'NECTAR_FLOW', 'ASK_AI', 'ROADMAP', 'PROFILE', 'SETTINGS', 'UPDATE_PASSWORD'].includes(state.currentView)
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
