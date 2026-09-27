// App-wide state and navigation — SPEC A §2–§6. The app keeps its own view state and mirrors it
// into browser history so the browser/Android back gesture works.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, type Apiary, type Hive } from '../lib/supabase';
import { loadAnalytics } from '../lib/analytics';
import { STANDALONE, backTarget, type View } from './views';

/** A selected record (inspection, intervention, varroa test, task…) — only its id matters here. */
export interface SelectedRecord {
  id: string;
  [key: string]: unknown;
}

export interface AppState {
  booting: boolean;
  user: User | null;
  roles: string[];
  view: View;
  selectedApiaryId: string | null;
  apiaryName: string | null;
  selectedHiveId: string | null;
  selectedRecord: SelectedRecord | null;
  /** SELECT_HIVE shows every hive (true) or one apiary's hives (false). */
  isUnified: boolean;
  apiaries: Apiary[];
  hives: Hive[];
}

interface HistoryEntry {
  view: View;
  recordId?: string;
}

const EMPTY_USER_STATE = {
  user: null,
  roles: [] as string[],
  selectedApiaryId: null,
  apiaryName: null,
  selectedHiveId: null,
  selectedRecord: null,
  isUnified: false,
  apiaries: [] as Apiary[],
  hives: [] as Hive[],
};

/** Special paths checked once at startup, regardless of session (SPEC A §2 step 5). */
function specialView(): View | null {
  const p = window.location.pathname;
  if (p === '/auth/update-password') return 'UPDATE_PASSWORD';
  if (p === '/beta') return 'BETA_SIGNUP';
  return null;
}

function pushHistory(entry: HistoryEntry) {
  // Leaving a special path (/beta, /auth/update-password) returns the address bar to "/".
  const url = specialView() && !STANDALONE.includes(entry.view) ? '/' : undefined;
  window.history.pushState(entry.recordId ? entry : { view: entry.view }, '', url);
}

function useAppStore() {
  const [state, setState] = useState<AppState>({ booting: true, view: 'AUTH', ...EMPTY_USER_STATE });

  // Every change goes through update(): it computes from the latest state synchronously, so
  // history is written exactly once and back-to-back calls never see stale state.
  const stateRef = useRef(state);
  const update = useCallback((fn: (s: AppState) => AppState, push?: HistoryEntry) => {
    const next = fn(stateRef.current);
    stateRef.current = next;
    setState(next);
    if (push) pushHistory(push);
  }, []);

  // ---- navigation data (apiaries by name, then their hives by name) and roles ----

  const reloadNavData = useCallback(
    async (userId?: string) => {
      const uid = userId ?? stateRef.current.user?.id;
      if (!uid) return;
      const { data: apiaries } = await supabase.from('apiaries').select('*').eq('user_id', uid).order('name', { ascending: true });
      const ids = (apiaries ?? []).map(a => a.id);
      let hives: Hive[] = [];
      if (ids.length) {
        const { data } = await supabase.from('hives').select('*').in('apiary_id', ids).order('name', { ascending: true });
        hives = data ?? [];
      }
      update(s => (s.user?.id === uid ? { ...s, apiaries: apiaries ?? [], hives } : s));
    },
    [update],
  );

  const loadRoles = useCallback(
    async (uid: string) => {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', uid);
      const roles = error || !data ? [] : data.map(r => r.role); // fail safe: no roles
      update(s => (s.user?.id === uid ? { ...s, roles } : s));
    },
    [update],
  );

  // ---- view changes ----

  const navigate = useCallback(
    (view: View, opts: { keepRecord?: boolean } = {}) => {
      const selectedRecord = opts.keepRecord === false ? null : stateRef.current.selectedRecord;
      update(s => ({ ...s, view, selectedRecord }), { view, recordId: selectedRecord?.id });
    },
    [update],
  );

  /** In-app back buttons: fixed map; clears the selected record except from Photos & Voice. */
  const goBack = useCallback(() => {
    const s = stateRef.current;
    const view = backTarget(s.view, s.isUnified);
    const selectedRecord = s.view === 'INSPECTION_PLUS' ? s.selectedRecord : null;
    const apiaryName = s.view === 'SELECT_HIVE' && !s.isUnified ? null : s.apiaryName;
    update(cur => ({ ...cur, view, selectedRecord, apiaryName }), { view, recordId: selectedRecord?.id });
  }, [update]);

  const openApiariesTab = useCallback(() => {
    update(
      s => ({ ...s, view: 'SELECT_APIARY', selectedApiaryId: null, apiaryName: null, selectedHiveId: null, isUnified: false }),
      { view: 'SELECT_APIARY' },
    );
  }, [update]);

  /** Hives tab, decided from the navigation data (SPEC A §5). */
  const openHivesTab = useCallback(() => {
    update(
      s => {
        const base: AppState = { ...s, view: 'SELECT_HIVE', selectedHiveId: null };
        if (s.hives.length >= 1 && s.hives.length <= 5) {
          return { ...base, isUnified: true, selectedApiaryId: null, apiaryName: null };
        }
        if (s.hives.length === 0 && s.apiaries.length === 1) {
          return { ...base, isUnified: false, selectedApiaryId: s.apiaries[0].id, apiaryName: s.apiaries[0].name };
        }
        return { ...base, isUnified: true, selectedApiaryId: null, apiaryName: null };
      },
      { view: 'SELECT_HIVE' },
    );
  }, [update]);

  const selectApiary = useCallback(
    (apiary: Apiary | null) => update(s => ({ ...s, selectedApiaryId: apiary?.id ?? null, apiaryName: apiary?.name ?? null })),
    [update],
  );
  const selectHive = useCallback((hiveId: string | null) => update(s => ({ ...s, selectedHiveId: hiveId })), [update]);
  const selectRecord = useCallback((record: SelectedRecord | null) => update(s => ({ ...s, selectedRecord: record })), [update]);

  // ---- sign-out clears every piece of user state (SCAR S-AUTH-7) ----

  const clearUser = useCallback(() => {
    update(s => ({
      ...s,
      ...EMPTY_USER_STATE,
      // Set New Password and Join the Beta stay put (SCAR S-AUTH-2).
      view: s.view === 'UPDATE_PASSWORD' || s.view === 'BETA_SIGNUP' ? s.view : 'AUTH',
    }));
  }, [update]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearUser();
  }, [clearUser]);

  // ---- startup (SPEC A §2) ----

  useEffect(() => {
    loadAnalytics();
    const special = specialView();

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      const view: View = special ?? (user ? 'DASHBOARD' : 'AUTH');
      window.history.replaceState({ view } satisfies HistoryEntry, '');
      // A recovery event may already have switched to Set New Password; never undo that.
      update(s => ({ ...s, booting: false, user, view: s.view === 'UPDATE_PASSWORD' ? s.view : view }));
      if (user) {
        void reloadNavData(user.id);
        void loadRoles(user.id);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      if (event === 'SIGNED_OUT') {
        clearUser();
        return;
      }
      const cur = stateRef.current.view;
      const view: View =
        event === 'PASSWORD_RECOVERY' ? 'UPDATE_PASSWORD' : event === 'SIGNED_IN' && cur === 'AUTH' ? 'DASHBOARD' : cur;
      update(s => ({ ...s, user, view }), view === 'DASHBOARD' && cur !== 'DASHBOARD' ? { view } : undefined);
      // Never await database calls inside this callback (it can deadlock the auth client).
      if (event === 'SIGNED_IN' && user) {
        setTimeout(() => {
          void reloadNavData(user.id);
          void loadRoles(user.id);
        }, 0);
      }
    });

    // Browser back / Android back gesture (SPEC A §6).
    const onPop = (e: PopStateEvent) => {
      const entry = e.state as HistoryEntry | null;
      update(s => {
        if (!entry?.view) return s.user ? { ...s, view: 'DASHBOARD', selectedRecord: null } : s;
        const keep = entry.view !== s.view && !!entry.recordId && s.selectedRecord?.id === entry.recordId;
        return { ...s, view: entry.view, selectedRecord: keep ? s.selectedRecord : null };
      });
    };
    window.addEventListener('popstate', onPop);

    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('popstate', onPop);
    };
  }, [clearUser, loadRoles, reloadNavData, update]);

  return useMemo(
    () => ({
      state,
      navigate,
      goBack,
      openApiariesTab,
      openHivesTab,
      selectApiary,
      selectHive,
      selectRecord,
      reloadNavData,
      signOut,
    }),
    [state, navigate, goBack, openApiariesTab, openHivesTab, selectApiary, selectHive, selectRecord, reloadNavData, signOut],
  );
}

export type AppStore = ReturnType<typeof useAppStore>;

const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const store = useAppStore();
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}

export function useApp(): AppStore {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
