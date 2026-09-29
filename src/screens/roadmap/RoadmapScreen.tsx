// Feedback & Roadmap — SPEC C §7 (screenshots B43, B44).

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, LayoutGrid, Lightbulb, Pencil, Triangle } from 'lucide-react';
import { useApp } from '../../app/store';
import { Spinner } from '../../components/Chrome';
import { DialogActions, DialogFrame, dialogField, dialogLabel } from '../../components/FeedbackDialog';
import { BottomBar } from '../records/RecordParts';
import { adminDelete, adminUpdate, loadRoadmap, setVote, sortRoadmap, submitIdea, type RoadmapItem } from '../../lib/profileData';

const CHIP: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  planned: 'bg-blue-100 text-blue-700',
};

function StatusChip({ status }: { status: string | null }) {
  const s = status ?? 'pending';
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${CHIP[s] ?? 'bg-gray-100 text-gray-600'}`}>
      {s === 'completed' ? <CheckCircle2 size={14} /> : s === 'pending' ? <Clock size={14} /> : null}
      {s}
    </span>
  );
}

function IdeaDialog({ title, initial, submitLabel, onClose, onSubmit }: { title: string; initial?: { title: string; description: string }; submitLabel: string; onClose: () => void; onSubmit: (t: string, d: string) => Promise<void> }) {
  const [t, setT] = useState(initial?.title ?? '');
  const [d, setD] = useState(initial?.description ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <DialogFrame icon={initial ? Pencil : Lightbulb} title={title} onClose={onClose}>
      <label className="block">
        <span className={dialogLabel}>Title</span>
        <input className={`${dialogField} h-14`} value={t} onChange={e => setT(e.target.value)} placeholder="e.g., Add offline mode" />
      </label>
      <label className="mt-5 block">
        <span className={dialogLabel}>Description</span>
        <textarea className={`${dialogField} py-4 resize-none`} rows={4} value={d} onChange={e => setD(e.target.value)} placeholder="Tell us why this would be helpful..." />
      </label>
      <DialogActions
        onCancel={onClose}
        label={submitLabel}
        disabled={!t.trim() || !d.trim() || busy}
        onSubmit={() => {
          setBusy(true);
          void onSubmit(t.trim(), d.trim()).finally(() => setBusy(false));
        }}
      />
    </DialogFrame>
  );
}

export default function RoadmapScreen() {
  const { state, navigate } = useApp();
  const userId = state.user!.id;
  const isAdmin = state.roles.includes('admin');
  const [items, setItems] = useState<RoadmapItem[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<RoadmapItem | null>(null);

  const reload = useCallback(async () => {
    setItems(await loadRoadmap(userId).catch(() => []));
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = (id: string, change: (i: RoadmapItem) => RoadmapItem) => setItems(cur => (cur ? cur.map(i => (i.id === id ? change(i) : i)) : cur));

  // Optimistic; on failure reload the list.
  const toggleVote = async (item: RoadmapItem) => {
    const on = !item.mine;
    setItems(cur => (cur ? sortRoadmap(cur.map(i => (i.id === item.id ? { ...i, mine: on, votes: i.votes + (on ? 1 : -1) } : i))) : cur));
    try {
      await setVote(item.id, userId, on);
    } catch {
      void reload();
    }
  };

  const setStatus = async (item: RoadmapItem, status: string) => {
    const before = item.status;
    patch(item.id, i => ({ ...i, status }));
    try {
      await adminUpdate(item.id, { status });
    } catch {
      patch(item.id, i => ({ ...i, status: before }));
      window.alert('Could not update status — your admin permission may not be set up yet.');
    }
  };

  const remove = async (item: RoadmapItem) => {
    if (!window.confirm(`Delete "${item.title}" and its ${item.votes} vote(s)? This cannot be undone.`)) return;
    const before = items;
    setItems(cur => (cur ? cur.filter(i => i.id !== item.id) : cur));
    try {
      await adminDelete(item.id);
    } catch {
      setItems(before);
      window.alert('Could not delete — your admin permission may not be set up yet.');
    }
  };

  const adminChip = (on: boolean) => `rounded-full px-3 py-1 text-xs font-black ${on ? 'bg-primary text-white' : 'bg-white/80 text-text-muted border border-divider'}`;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-40">
      <div className="rounded-3xl border-2 border-primary/30 bg-[#FFFBF0] px-5 py-6 flex items-center justify-between gap-3 shadow-sm">
        <div>
          <h1 className="text-[26px] font-black leading-tight text-primary-ink">Feedback &amp; Roadmap</h1>
          <p className="mt-1 text-sm font-black uppercase tracking-wider text-primary-ink">Community driven</p>
        </div>
        <button type="button" onClick={() => setSubmitting(true)} className="shrink-0 min-h-[64px] w-[34%] max-w-[170px] rounded-2xl bg-primary px-3 text-white text-lg font-black shadow-md flex items-center justify-center gap-2">
          <Lightbulb size={18} /> Submit Idea
        </button>
      </div>

      <div className="mt-6 mb-4 flex items-center justify-between px-1">
        <h2 className="text-sm font-black uppercase tracking-wider text-text-muted">Community requests</h2>
        <span className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold text-text-muted">Sorted by Votes</span>
      </div>

      {items === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-lg font-black text-text">No feature requests yet!</p>
          <p className="mt-1 text-text-muted">Be the first to submit an idea.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => (
            <article key={item.id} className="card p-4 flex gap-4">
              <button
                type="button"
                aria-pressed={item.mine}
                aria-label={item.mine ? 'Remove my vote' : 'Vote for this'}
                onClick={() => void toggleVote(item)}
                className={`shrink-0 w-14 h-[68px] rounded-2xl flex flex-col items-center justify-center gap-1 font-black text-lg ${item.mine ? 'bg-primary text-white' : 'bg-white/80 text-text-muted'}`}
              >
                <Triangle size={20} fill="currentColor" />
                {item.votes}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-black leading-snug text-text min-w-0">{item.title}</h3>
                  <StatusChip status={item.status} />
                </div>
                {item.description && <p className="mt-2 whitespace-pre-wrap leading-relaxed text-text-muted">{item.description}</p>}
                {isAdmin && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-text-muted">Admin · Set:</span>
                    {[
                      ['pending', 'pending'],
                      ['planned', 'planned'],
                      ['completed', 'Done'],
                    ].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => void setStatus(item, value)} className={adminChip((item.status ?? 'pending') === value)}>
                        {label}
                      </button>
                    ))}
                    <button type="button" onClick={() => setEditing(item)} className={adminChip(false)}>
                      ✏️ Edit
                    </button>
                    <button type="button" onClick={() => void remove(item)} className="rounded-full px-3 py-1 text-xs font-black bg-red-50 text-red-600 border border-red-200">
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <BottomBar>
        <button type="button" onClick={() => navigate('DASHBOARD', { keepRecord: false })} className="flex-1 h-[70px] rounded-full bg-white/60 shadow-sm flex flex-col items-center justify-center gap-1 font-bold text-text">
          <LayoutGrid size={22} />
          <span className="text-[13px]">Return to Dashboard</span>
        </button>
      </BottomBar>

      {submitting && (
        <IdeaDialog
          title="Submit Feature Idea"
          submitLabel="Submit Idea"
          onClose={() => setSubmitting(false)}
          onSubmit={async (t, d) => {
            try {
              await submitIdea(userId, t, d);
              setSubmitting(false);
              void reload();
            } catch (err) {
              window.alert(`Error submitting idea: ${(err as Error).message}`);
            }
          }}
        />
      )}
      {editing && (
        <IdeaDialog
          title="Edit Request"
          submitLabel="Save Changes"
          initial={{ title: editing.title, description: editing.description ?? '' }}
          onClose={() => setEditing(null)}
          onSubmit={async (t, d) => {
            const before = editing;
            patch(editing.id, i => ({ ...i, title: t, description: d }));
            setEditing(null);
            try {
              await adminUpdate(before.id, { title: t, description: d });
            } catch {
              patch(before.id, () => before);
              window.alert('Could not save the edit — your admin permission may not be set up yet.');
            }
          }}
        />
      )}
    </div>
  );
}
