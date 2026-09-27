// Hives list, single-apiary or unified — SPEC B §8 (screenshots B21, B22).

import { useEffect, useState } from 'react';
import { Hexagon } from 'lucide-react';
import { useApp } from '../../app/store';
import { SelectionList } from '../../components/SelectionList';
import { supabase, type Hive } from '../../lib/supabase';
import { CreateButton } from '../apiaries/ApiariesScreen';
import { HiveForm } from './HiveForm';

/** There is no hives.status column, so the badge always reads ACTIVE in green (kept; QUESTIONS #7). */
export function StatusBadge({ status }: { status?: string | null }) {
  const s = status || 'Active';
  const active = s === 'Active';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wider ${active ? 'bg-green-100 text-green-700' : 'bg-primary-wash text-primary-ink'}`}>
      {s}
    </span>
  );
}

export default function HivesScreen() {
  const { state, openHive, reloadNavData } = useApp();
  const unified = state.isUnified;
  const [single, setSingle] = useState<Hive[] | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [form, setForm] = useState<{ hive: Hive | null } | null>(null);

  // Single-apiary mode loads that apiary's hives, by name.
  useEffect(() => {
    if (unified || !state.selectedApiaryId) return;
    setSingle(null);
    void supabase
      .from('hives')
      .select('*')
      .eq('apiary_id', state.selectedApiaryId)
      .order('name', { ascending: true })
      .then(({ data }) => setSingle(data ?? []));
  }, [unified, state.selectedApiaryId]);

  const apiaryName = (id: string) => state.apiaries.find(a => a.id === id)?.name;
  const all = unified ? state.hives : single ?? [];
  const shown = unified && filter ? all.filter(h => h.apiary_id === filter) : all;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-20">
      <h2 className="text-xl font-black text-text">{unified ? 'My Hives' : 'Select a Hive'}</h2>
      <p className="mt-1 text-sm text-text-muted">{unified ? 'Quickly access any of your hives.' : 'Choose a hive to inspect or manage.'}</p>

      {unified && state.hives.length > 5 && (
        <div className="mt-5 -mx-4 px-4 flex gap-2 overflow-x-auto pb-1">
          {[{ id: null as string | null, label: `All Hives (${state.hives.length})` }, ...state.apiaries.map(a => ({ id: a.id as string | null, label: `${a.name} (${state.hives.filter(h => h.apiary_id === a.id).length})` }))].map(p => (
            <button
              key={p.id ?? 'all'}
              type="button"
              onClick={() => setFilter(p.id)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-bold whitespace-nowrap ${filter === p.id ? 'bg-primary text-white' : 'bg-white/70 text-text-muted'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        <SelectionList
          loading={!unified && single === null}
          items={shown.map(h => ({
            id: h.id,
            title: h.name,
            subtitle: `Type: ${h.type || 'Standard'}${unified ? ` | Site: ${apiaryName(h.apiary_id) || 'Unknown Yard'}` : ''}`,
            badge: <StatusBadge />,
          }))}
          icon={Hexagon}
          emptyMessage={unified ? 'No hives found. Click Create New Hive to get started!' : 'No hives found in this apiary. Create your first hive!'}
          onSelect={item => openHive(item.id)}
          onEdit={item => setForm({ hive: all.find(h => h.id === item.id)! })}
        />
      </div>

      <CreateButton label="Create New Hive" onClick={() => setForm({ hive: null })} />

      {form && (
        <HiveForm
          hive={form.hive}
          defaultApiaryId={state.selectedApiaryId}
          userId={state.user!.id}
          onClose={() => setForm(null)}
          onSaved={() => {
            // Reload navigation data, then the whole page (existing behaviour).
            void reloadNavData().then(() => window.location.reload());
          }}
        />
      )}
    </div>
  );
}
