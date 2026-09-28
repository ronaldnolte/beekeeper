// TEMPORARY: stands in for screens built in later milestones. Delete each entry as its real
// screen lands; delete this file when the table is empty.

import { useApp } from '../app/store';
import type { View } from '../app/views';

const COMING: Partial<Record<View, { name: string; milestone: number }>> = {
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
