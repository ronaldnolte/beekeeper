// The app's screens ("views") — SPEC A §3.

export type View =
  | 'AUTH'
  | 'BETA_SIGNUP'
  | 'UPDATE_PASSWORD'
  | 'DASHBOARD'
  | 'SELECT_APIARY'
  | 'SELECT_HIVE'
  | 'HIVE_DETAIL'
  | 'INSPECTION_FORM'
  | 'INSPECTION_PLUS'
  | 'INTERVENTION_FORM'
  | 'VARROA_FORM'
  | 'TASK_FORM'
  | 'STATUS_UPDATE_FORM'
  | 'FORECAST'
  | 'NECTAR_FLOW'
  | 'ASK_AI'
  | 'ROADMAP'
  | 'PROFILE';

/** Screens that stand alone (no header, no nav) and never need a signed-in user. */
export const STANDALONE: readonly View[] = ['AUTH', 'BETA_SIGNUP', 'UPDATE_PASSWORD'];

export const BOTTOM_NAV_VIEWS: readonly View[] = ['DASHBOARD', 'SELECT_APIARY', 'SELECT_HIVE', 'FORECAST', 'NECTAR_FLOW', 'ASK_AI'];

/** Header title; views without an entry show "Beekeeper". */
export function headerTitle(view: View, unified: boolean): string {
  switch (view) {
    case 'DASHBOARD':
      return 'Beekeeper';
    case 'SELECT_APIARY':
      return 'My Apiaries';
    case 'SELECT_HIVE':
      return unified ? 'My Hives' : 'Hives';
    case 'HIVE_DETAIL':
      return 'Hive Detail';
    case 'INSPECTION_FORM':
      return 'Inspection';
    case 'INTERVENTION_FORM':
      return 'Intervention';
    case 'TASK_FORM':
      return 'Task';
    case 'STATUS_UPDATE_FORM':
      return 'Status';
    case 'FORECAST':
      return 'Forecast';
    case 'NECTAR_FLOW':
      return 'Nectar Flow';
    case 'ASK_AI':
      return 'Ask AI';
    case 'ROADMAP':
      return 'Roadmap';
    case 'PROFILE':
      return 'Your Profile';
    default:
      return 'Beekeeper';
  }
}

/** In-app back buttons use this fixed map, not history (SPEC A §6). */
export function backTarget(view: View, unified: boolean): View {
  switch (view) {
    case 'SELECT_HIVE':
      return unified ? 'DASHBOARD' : 'SELECT_APIARY';
    case 'HIVE_DETAIL':
      return 'SELECT_HIVE';
    case 'INSPECTION_PLUS':
      return 'INSPECTION_FORM';
    case 'INSPECTION_FORM':
    case 'INTERVENTION_FORM':
    case 'VARROA_FORM':
    case 'TASK_FORM':
    case 'STATUS_UPDATE_FORM':
      return 'HIVE_DETAIL';
    default:
      return 'DASHBOARD';
  }
}
