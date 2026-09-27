// Create / edit apiary sheet — SPEC B §5 (screenshot B19).

import { lazy, Suspense, useState, type FormEvent } from 'react';
import { MapPin, Save, Trash2 } from 'lucide-react';
import { Sheet } from '../../components/Sheet';
import { DangerButton, FormError, Label, PrimaryButton, SmallInput, TextArea, TextInput } from '../../components/Form';
import { coordinateWarning, deleteApiary, saveApiary, validateApiary, type ApiaryInput } from '../../lib/apiaryHiveData';
import type { Apiary } from '../../lib/supabase';

const MapPicker = lazy(() => import('./MapPicker'));

export function ApiaryForm({ apiary, userId, onClose, onSaved }: { apiary: Apiary | null; userId: string; onClose: () => void; onSaved: () => void }) {
  const editing = !!apiary;
  const [v, setV] = useState<ApiaryInput>(() => ({
    name: apiary?.name ?? '',
    // Coordinates mode only when the apiary has both coordinates and no zip.
    mode: apiary && apiary.latitude != null && apiary.longitude != null && !apiary.zip_code ? 'coordinates' : 'postal',
    zip: apiary?.zip_code ?? '',
    lat: apiary?.latitude != null ? String(apiary.latitude) : '',
    lng: apiary?.longitude != null ? String(apiary.longitude) : '',
    notes: apiary?.notes ?? '',
  }));
  const [busy, setBusy] = useState<'saving' | 'deleting' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const set = (patch: Partial<ApiaryInput>) => setV(s => ({ ...s, ...patch }));

  const warning = v.mode === 'coordinates' ? coordinateWarning(v.lat, v.lng) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return;
    const problem = validateApiary(v);
    if (problem) return setError(problem);
    setError(null);
    setBusy('saving');
    try {
      await saveApiary(v, userId, apiary?.id);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!apiary) return;
    if (!window.confirm(`Are you sure you want to delete "${apiary.name}"? This will delete all hives inside it!`)) return;
    setBusy('deleting');
    try {
      await deleteApiary(apiary.id, userId);
      onSaved();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete apiary');
      setBusy(null);
    }
  };

  const seg = (active: boolean) => `flex-1 h-12 rounded-xl font-bold transition-colors ${active ? 'bg-white shadow-md text-primary' : 'text-text-muted'}`;

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        maxHeight="93vh"
        title={
          <span className="flex items-center gap-3 text-xl">
            <MapPin size={24} /> {editing ? 'Edit Apiary' : 'Create New Apiary'}
          </span>
        }
      >
        <form onSubmit={submit} className="px-6 py-6 space-y-6">
          <div>
            <Label htmlFor="apiary-name">Apiary Name</Label>
            <TextInput id="apiary-name" value={v.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Home Yard, South Farm..." required />
          </div>

          <div>
            <Label hint="(for weather)">Location</Label>
            <div className="flex gap-1 rounded-2xl bg-white p-1" role="tablist">
              <button type="button" role="tab" aria-selected={v.mode === 'postal'} onClick={() => set({ mode: 'postal' })} className={seg(v.mode === 'postal')}>
                Postal Code
              </button>
              <button type="button" role="tab" aria-selected={v.mode === 'coordinates'} onClick={() => set({ mode: 'coordinates' })} className={seg(v.mode === 'coordinates')}>
                Coordinates
              </button>
            </div>

            <button type="button" onClick={() => setMapOpen(true)} className="mt-3 w-full h-[50px] rounded-2xl border-2 border-primary/50 text-primary font-black flex items-center justify-center gap-2">
              <MapPin size={20} /> Pick on map
            </button>

            {v.mode === 'postal' ? (
              <div className="mt-3">
                <SmallInput aria-label="Postal code" value={v.zip} onChange={e => set({ zip: e.target.value })} placeholder="e.g. 12345" />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="lat" className="block mb-1.5 ml-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Latitude
                  </label>
                  <SmallInput id="lat" type="number" step="any" inputMode="decimal" value={v.lat} onChange={e => set({ lat: e.target.value })} placeholder="35.0385" />
                </div>
                <div>
                  <label htmlFor="lng" className="block mb-1.5 ml-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Longitude
                  </label>
                  <SmallInput id="lng" type="number" step="any" inputMode="decimal" value={v.lng} onChange={e => set({ lng: e.target.value })} placeholder="-106.7065" />
                </div>
              </div>
            )}

            {warning && (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {warning.kind === 'flip' ? (
                  <>
                    ⚠️ This location is outside the United States. Did you mean{' '}
                    <button type="button" onClick={() => set({ lng: String(warning.suggested) })} className="font-black underline">
                      {warning.suggested}
                    </button>
                    ? A longitude missing its minus sign is the usual cause.
                  </>
                ) : (
                  '⚠️ This location is outside the continental United States. That is fine to save, but Nectar Flow forage data only covers the continental US, so it will not be available for this apiary.'
                )}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="apiary-notes" hint="(optional)">
              Notes
            </Label>
            <TextArea id="apiary-notes" rows={3} value={v.notes} onChange={e => set({ notes: e.target.value })} placeholder="e.g. South Valley, Albuquerque NM" />
          </div>

          {error && <FormError>{error}</FormError>}

          <div className="pt-2 space-y-3">
            <PrimaryButton type="submit" disabled={!!busy || !v.name.trim()}>
              <Save size={22} /> {editing ? 'Save Changes' : 'Create Apiary'}
            </PrimaryButton>
            {editing && (
              <DangerButton type="button" onClick={remove} disabled={!!busy}>
                <Trash2 size={22} /> Delete Apiary
              </DangerButton>
            )}
          </div>
        </form>
      </Sheet>

      {mapOpen && (
        <Suspense fallback={null}>
          <MapPicker
            initial={v.lat && v.lng && Number.isFinite(+v.lat) && Number.isFinite(+v.lng) ? { lat: +v.lat, lng: +v.lng } : null}
            onClose={() => setMapOpen(false)}
            onConfirm={(lat, lng) => {
              set({ mode: 'coordinates', lat: String(lat), lng: String(lng) });
              setMapOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
