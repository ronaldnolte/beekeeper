// My Apiaries — SPEC B §4 (screenshots B17, B18).

import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { useApp } from '../../app/store';
import { SelectionList } from '../../components/SelectionList';
import { apiarySubtitle } from '../../lib/location';
import { deleteApiary } from '../../lib/apiaryHiveData';
import type { Apiary } from '../../lib/supabase';
import { ApiaryForm } from './ApiaryForm';

/** The original reloads the whole page after an apiary is created, edited or deleted (kept; QUESTIONS #7). */
const fullReload = () => window.location.reload();

export function CreateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none" style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      <button type="button" onClick={onClick} className="pointer-events-auto btn-honey w-full max-w-[240px] h-12 text-sm flex items-center justify-center gap-2">
        <Plus size={20} /> {label}
      </button>
    </div>
  );
}

export default function ApiariesScreen() {
  const { state, openApiaryHives, reloadNavData } = useApp();
  const [form, setForm] = useState<{ apiary: Apiary | null } | null>(null);
  const userId = state.user!.id;

  const remove = async (a: Apiary) => {
    if (!window.confirm(`Are you sure you want to delete "${a.name}"? This will delete all hives inside it!`)) return;
    try {
      await deleteApiary(a.id, userId);
      await reloadNavData();
      fullReload();
    } catch (err) {
      window.alert((err as Error).message || 'Failed to delete apiary');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-20">
      <h2 className="text-xl font-black text-text">My Apiaries</h2>
      <p className="mt-1 text-[13px] text-text-muted">Select a yard location to manage your hives.</p>
      <div className="mt-6">
        <SelectionList
          items={state.apiaries.map(a => ({ id: a.id, title: a.name, subtitle: apiarySubtitle(a) }))}
          icon={MapPin}
          emptyMessage="No apiaries found. Create your first apiary to get started."
          onSelect={item => {
            openApiaryHives(state.apiaries.find(x => x.id === item.id)!);
          }}
          onEdit={item => setForm({ apiary: state.apiaries.find(x => x.id === item.id)! })}
          onDelete={item => void remove(state.apiaries.find(x => x.id === item.id)!)}
        />
      </div>

      <CreateButton label="Create Apiary" onClick={() => setForm({ apiary: null })} />

      {form && (
        <ApiaryForm
          apiary={form.apiary}
          userId={userId}
          onClose={() => setForm(null)}
          onSaved={() => {
            void reloadNavData().then(fullReload);
          }}
        />
      )}
    </div>
  );
}
