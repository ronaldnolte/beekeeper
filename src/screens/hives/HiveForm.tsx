// Create / edit hive sheet — SPEC B §9 (screenshot B23).

import { useEffect, useState, type FormEvent } from 'react';
import { Box, Minus, Plus, Save, Trash2 } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { DangerButton, FormError, Label, PrimaryButton, Select, TextArea, TextInput, ToggleButton } from '../../components/Form';
import { deleteHive, parseBars, saveHive } from '../../lib/apiaryHiveData';
import { supabase, type Hive } from '../../lib/supabase';

type HiveType = 'Top Bar' | 'Langstroth';

export function HiveForm({
  hive,
  defaultApiaryId,
  userId,
  onClose,
  onSaved,
}: {
  hive: Hive | null;
  defaultApiaryId: string | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!hive;
  const [name, setName] = useState(hive?.name ?? '');
  const [apiaryId, setApiaryId] = useState(hive?.apiary_id ?? defaultApiaryId ?? '');
  // Shown type: Langstroth if the stored text mentions it, else Top Bar.
  const [shownType, setShownType] = useState<HiveType>(hive && (hive.type ?? '').toLowerCase().includes('langstroth') ? 'Langstroth' : 'Top Bar');
  const [typeTapped, setTypeTapped] = useState(false);
  const [bars, setBars] = useState(() => (hive ? parseBars(hive.bars)?.length || 30 : 30));
  const [notes, setNotes] = useState(hive?.notes ?? '');
  // Shown and required, but never saved — there is no such column (kept; QUESTIONS #7).
  const [installed, setInstalled] = useState(() => new Date().toISOString().slice(0, 10));
  const [apiaries, setApiaries] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    // The original lists the apiaries unsorted, as the database returns them.
    void supabase
      .from('apiaries')
      .select('id, name')
      .eq('user_id', userId)
      .then(({ data }) => setApiaries(data ?? []));
  }, [userId]);

  const pickType = (t: HiveType) => {
    setShownType(t);
    setTypeTapped(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !apiaryId) return;
    setBusy(true);
    setError(null);
    try {
      await saveHive({ name, apiaryId, notes, barCount: bars, type: !editing || typeTapped ? shownType : undefined }, hive?.id);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!hive) return;
    setBusy(true);
    try {
      await deleteHive(hive.id);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      maxHeight="90vh"
      title={
        <span className="flex items-center gap-3 text-xl">
          <Box size={24} /> {editing ? 'Edit Hive' : 'Create New Hive'}
        </span>
      }
    >
      <form onSubmit={submit} className="px-6 py-6 space-y-6">
        <div>
          <Label htmlFor="hive-name">Hive Name</Label>
          <TextInput id="hive-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Hive 1, Queen Beatrice..." required />
        </div>

        <div>
          <Label htmlFor="hive-apiary">Location (Apiary)</Label>
          <Select id="hive-apiary" value={apiaryId} onChange={e => setApiaryId(e.target.value)} required>
            <option value="">Select an Apiary...</option>
            {apiaries.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Hive Type</Label>
          <div className="flex gap-3">
            <ToggleButton selected={shownType === 'Top Bar'} onClick={() => pickType('Top Bar')}>
              Top Bar
            </ToggleButton>
            <ToggleButton selected={shownType === 'Langstroth'} onClick={() => pickType('Langstroth')}>
              Langstroth
            </ToggleButton>
          </div>
        </div>

        {shownType === 'Top Bar' && (
          <div>
            <Label>Number of Bars</Label>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Fewer bars" onClick={() => setBars(b => Math.max(1, b - 1))} className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center">
                <Minus size={20} />
              </button>
              <span className="w-12 text-center text-2xl font-black tabular-nums">{bars}</span>
              <button type="button" aria-label="More bars" onClick={() => setBars(b => Math.min(60, b + 1))} className="w-12 h-12 rounded-2xl bg-white/70 flex items-center justify-center">
                <Plus size={20} />
              </button>
              <span className="font-bold text-text-muted">bars</span>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="hive-notes">Notes</Label>
          <TextArea id="hive-notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes about this hive..." />
        </div>

        <div>
          <Label htmlFor="hive-installed">Installation Date</Label>
          <TextInput id="hive-installed" type="date" value={installed} onChange={e => setInstalled(e.target.value)} required />
        </div>

        {error && <FormError>{error}</FormError>}

        <div className="pt-2 space-y-3">
          <PrimaryButton type="submit" disabled={busy || !name.trim() || !apiaryId}>
            <Save size={22} /> {editing ? 'Save Changes' : 'Create Hive'}
          </PrimaryButton>
          {editing &&
            (confirmDelete ? (
              // Inline, not a browser dialog: those were once silently blocked inside the Android WebView.
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">⚠️ Delete "{hive.name}"? This will remove all inspections, tasks, and history. This cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 h-11 rounded-xl bg-white font-bold text-text">
                    Cancel
                  </button>
                  <button type="button" onClick={remove} disabled={busy} className="flex-1 h-11 rounded-xl bg-bad font-bold text-white disabled:opacity-50">
                    Yes, Delete
                  </button>
                </div>
              </div>
            ) : (
              <DangerButton type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>
                <Trash2 size={22} /> Delete Hive
              </DangerButton>
            ))}
        </div>
      </form>
    </Sheet>
  );
}
