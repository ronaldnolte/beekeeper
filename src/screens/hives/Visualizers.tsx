// Hive configuration editors — SPEC B §10a (top bar) and §10b (Langstroth stack), screenshot B24.

import { useState } from 'react';
import { Camera, ChevronDown, ChevronUp, Minus, Plus, Trash2 } from 'lucide-react';
import { saveSnapshot, type StackPart, type TopBar } from '../../lib/apiaryHiveData';
import { BAR_COLOUR, BAR_LABEL_DARK, BAR_STATUSES, PART_DARK_TEXT, PART_STYLE } from '../../components/hiveConfig';

function SnapshotButton({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  if (saving) {
    return (
      <span className="h-11 px-4 rounded-2xl bg-primary text-white font-bold flex items-center gap-2 whitespace-nowrap">
        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Saving...
      </span>
    );
  }
  return dirty ? (
    <button type="button" onClick={onSave} className="h-11 px-4 rounded-2xl bg-primary text-white font-bold flex items-center gap-2 shadow-md whitespace-nowrap">
      <Camera size={18} /> Save Snapshot
    </button>
  ) : (
    <span className="h-11 px-4 rounded-2xl bg-gray-200 text-gray-600 font-bold flex items-center gap-2 whitespace-nowrap">
      <Camera size={18} /> Saved
    </span>
  );
}

function useSnapshot(hiveId: string, onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const save = async (bars: TopBar[] | StackPart[], kind: 'topbar' | 'stack', after: () => void) => {
    setSaving(true);
    try {
      await saveSnapshot(hiveId, bars, kind);
      after();
      onSaved();
    } catch (err) {
      window.alert(`Failed to save snapshot: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };
  return { saving, save };
}

// ---------- Top bar ----------

export function TopBarVisualizer({ hiveId, initial, onSaved }: { hiveId: string; initial: TopBar[]; onSaved: () => void }) {
  const [bars, setBars] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const { saving, save } = useSnapshot(hiveId, onSaved);
  const dirty = JSON.stringify(bars) !== baseline;

  const cycle = (i: number) =>
    setBars(bs => bs.map((b, k) => (k === i ? { ...b, status: BAR_STATUSES[(BAR_STATUSES.indexOf(b.status as never) + 1) % BAR_STATUSES.length] } : b)));

  return (
    <div className="card">
      <div className="px-6 py-5 bg-white/70">
        <h3 className="text-sm font-black uppercase tracking-wider text-text-muted">Top Bar Config</h3>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" aria-label="Remove last bar" disabled={bars.length <= 1} onClick={() => setBars(bs => bs.slice(0, -1))} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center disabled:opacity-40">
            <Minus size={16} />
          </button>
          <span className="w-8 text-center font-black tabular-nums">{bars.length}</span>
          <button type="button" aria-label="Add a bar" onClick={() => setBars(bs => [...bs, { position: bs.length + 1, status: 'inactive' }])} className="w-9 h-9 rounded-xl bg-white flex items-center justify-center">
            <Plus size={16} />
          </button>
          <span className="flex-1" />
          <SnapshotButton dirty={dirty} saving={saving} onSave={() => void save(bars, 'topbar', () => setBaseline(JSON.stringify(bars)))} />
        </div>
      </div>
      <div className="px-4 py-5 overflow-x-auto">
        <div className="flex gap-1 w-max mx-auto">
          {bars.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={() => cycle(i)}
              aria-label={`Bar ${b.position}: ${b.status.replace('_', ' ')}`}
              className="w-8 sm:w-10 h-28 sm:h-32 rounded-md border border-black/10 flex items-end justify-center pb-1 text-[10px] font-black"
              style={{ background: BAR_COLOUR[b.status] ?? BAR_COLOUR.inactive, color: BAR_LABEL_DARK[b.status] ? '#2D2A26' : '#FFFFFF' }}
            >
              {b.position}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-6 pb-5">
        {BAR_STATUSES.map(s => (
          <span key={s} className="flex items-center gap-2 text-[11px] font-bold uppercase text-text-muted">
            <span className="w-3 h-3 rounded-sm border border-black/15" style={{ background: BAR_COLOUR[s] }} />
            {s.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Langstroth stack ----------

const randomId = () => Math.random().toString(36).slice(2, 11);

export function LangstrothVisualizer({ hiveId, initial, onSaved }: { hiveId: string; initial: StackPart[]; onSaved: () => void }) {
  const [stack, setStack] = useState(initial);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));
  const [open, setOpen] = useState<string | null>(null);
  const { saving, save } = useSnapshot(hiveId, onSaved);
  const dirty = JSON.stringify(stack) !== baseline;

  const add = (type: string) => setStack(s => [{ id: randomId(), type, frames: 10 }, ...s]); // new parts go on top
  const move = (i: number, d: -1 | 1) =>
    setStack(s => {
      const n = [...s];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between gap-3 px-6 py-5 bg-white/70">
          <h3 className="text-sm font-black uppercase tracking-wider text-text-muted">Vertical Stack</h3>
          <SnapshotButton dirty={dirty} saving={saving} onSave={() => void save(stack, 'stack', () => setBaseline(JSON.stringify(stack)))} />
        </div>
        <div className="bg-[#fdfaf5] px-6 py-6">
          <div className="mx-auto max-w-64 flex flex-col gap-2">
            <div className="h-8 rounded-t-md bg-[#E6DCC5] border-b-[3px] border-[#C4B79E] flex items-center justify-center text-xs font-black tracking-widest text-text shadow-sm">OUTER COVER</div>
            {stack.length === 0 && <div className="h-24 rounded-md border-2 border-dashed border-divider flex items-center justify-center text-text-muted font-bold">Empty Stack</div>}
            {stack.map((p, i) => {
              const s = PART_STYLE[p.type] ?? { label: p.type, fill: '#3D3226', border: '#3D3226', height: 48 };
              return (
                <div key={p.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(o => (o === p.id ? null : p.id))}
                    className={`relative w-full flex items-center justify-center font-black tracking-wide ${PART_DARK_TEXT.has(p.type) ? 'text-text' : 'text-white'}`}
                    style={{ height: s.height, background: s.fill, border: `3px solid ${s.border}`, fontSize: s.height < 30 ? 14 : 16 }}
                  >
                    {s.label}
                    {s.frames && <span className="absolute right-2 bottom-1 text-[10px] font-black text-white/60">{p.frames ?? 10} Fr</span>}
                  </button>
                  {open === p.id && (
                    <div className="mt-1 flex gap-2 animate-fade-quick">
                      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="flex-1 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center disabled:opacity-40">
                        <ChevronUp size={18} />
                      </button>
                      <button type="button" aria-label="Move down" disabled={i === stack.length - 1} onClick={() => move(i, 1)} className="flex-1 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center disabled:opacity-40">
                        <ChevronDown size={18} />
                      </button>
                      <button type="button" aria-label="Remove" onClick={() => (setStack(st => st.filter(x => x.id !== p.id)), setOpen(null))} className="flex-1 h-9 rounded-lg bg-red-50 text-red-600 shadow-sm flex items-center justify-center">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="relative h-10 rounded-b-md bg-[#4A3B2A] flex items-end justify-center pb-1.5 text-xs font-black tracking-widest text-[#EDE7DA] shadow-sm">
              <span className="absolute top-0 inset-x-4 h-2 rounded-b bg-[#1a1612]" />
              BOTTOM BOARD
            </div>
          </div>
        </div>
      </div>

      <div className="card px-5 py-5">
        <h3 className="text-sm font-black uppercase tracking-wider text-text-muted">Parts Palette (Tap to Add)</h3>
        <div className="mt-4 space-y-2">
          {(
            [
              ['deep', '+ Deep Box (9⅝")', '#C47F0A'],
              ['medium', '+ Medium Box (6⅝")', '#E99B1A'],
              ['shallow', '+ Shallow Box (5¾")', '#F39C12'],
            ] as const
          ).map(([type, label, bg]) => (
            <button key={type} type="button" onClick={() => add(type)} className="w-full h-14 rounded-2xl text-white text-lg font-black shadow-sm" style={{ background: bg }}>
              {label}
            </button>
          ))}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {(
              [
                ['excluder', 'Excluder', '#FFFFFF', '#E5E7EB', '#374151'],
                ['slatted_rack', 'Slatted Rack', '#F5E1DA', '#E6B8A2', '#9A3412'],
                ['feeder', 'Feeder', '#EFF6FF', '#93C5FD', '#1E40AF'],
                ['inner_cover', 'Inner Cover', '#FEF3C7', '#FDE68A', '#92400E'],
              ] as const
            ).map(([type, label, bg, border, fg]) => (
              <button key={type} type="button" onClick={() => add(type)} className="h-11 rounded-xl text-xs font-black shadow-sm" style={{ background: bg, border: `2px solid ${border}`, color: fg }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
