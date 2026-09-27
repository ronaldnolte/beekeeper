// TEMPORARY: stands in for screens built in later milestones. Delete each entry as its real
// screen lands; delete this file when the table is empty.

import { useApp } from '../app/store';
import type { View } from '../app/views';

const COMING: Partial<Record<View, { name: string; milestone: number }>> = {
  DASHBOARD: { name: 'Dashboard', milestone: 7 },
  SELECT_APIARY: { name: 'My Apiaries', milestone: 6 },
  SELECT_HIVE: { name: 'Hives', milestone: 6 },
  HIVE_DETAIL: { name: 'Hive Detail', milestone: 6 },
  INSPECTION_FORM: { name: 'Inspection', milestone: 7 },
  INSPECTION_PLUS: { name: 'Photos & Voice', milestone: 7 },
  INTERVENTION_FORM: { name: 'Intervention', milestone: 7 },
  VARROA_FORM: { name: 'Varroa', milestone: 7 },
  TASK_FORM: { name: 'Task', milestone: 7 },
  FORECAST: { name: 'Forecast', milestone: 5 },
  NECTAR_FLOW: { name: 'Nectar Flow', milestone: 4 },
  ASK_AI: { name: 'Ask AI', milestone: 5 },
  ROADMAP: { name: 'Roadmap', milestone: 8 },
  PROFILE: { name: 'Your Profile', milestone: 8 },
};

export function Placeholder({ view }: { view: View }) {
  const { state, signOut } = useApp();
  const info = COMING[view] ?? { name: view, milestone: 0 };
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="card p-6 text-center">
        <p className="text-xs font-black uppercase tracking-wider text-text-muted">Rebuild in progress</p>
        <h2 className="mt-2 text-2xl font-black">{info.name}</h2>
        <p className="mt-2 text-text-muted">This screen arrives in Milestone {info.milestone}.</p>
        <p className="mt-4 text-sm text-text-muted">
          {state.apiaries.length} apiaries · {state.hives.length} hives loaded
          {state.roles.length ? ` · roles: ${state.roles.join(', ')}` : ''}
        </p>
        {view === 'PROFILE' && (
          <button type="button" onClick={() => void signOut().then(() => window.location.reload())} className="mt-6 px-6 h-11 rounded-full bg-bad text-white font-black">
            Log out (temporary button)
          </button>
        )}
      </div>
    </div>
  );
}
