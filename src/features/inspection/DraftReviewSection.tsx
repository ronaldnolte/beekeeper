import React, { useEffect, useState } from 'react';
import { Sparkles, Check, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { fetchDraftInspections, approveInspection, discardInspection } from '../../data/inspectionRepository';

interface DraftReviewSectionProps {
  hiveId: string;
  /** Bump to re-fetch (e.g. after returning from capture). */
  refreshTrigger?: number;
  /** Called after an approve, so the parent can refresh the history feed. */
  onChange?: () => void;
}

/**
 * "Drafts waiting for review" — the review surface for Plus inspections.
 * Each draft can be re-opened (Review → the Plus flow) or finalized (Approve →
 * flips review_status to 'approved', which moves it into the normal history).
 * Renders nothing when there are no drafts.
 */
export const DraftReviewSection: React.FC<DraftReviewSectionProps> = ({
  hiveId,
  refreshTrigger = 0,
  onChange,
}) => {
  const { selectInspection, navigateTo } = useAppStore();
  const [drafts, setDrafts] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setDrafts(await fetchDraftInspections(hiveId));
    } catch {
      setDrafts([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiveId, refreshTrigger]);

  if (drafts.length === 0) return null;

  const review = (d: any) => {
    selectInspection({ _model_type: 'inspection', ...d });
    navigateTo('INSPECTION_PLUS_FACTS');
  };

  const approve = async (d: any) => {
    setBusyId(d.id);
    try {
      await approveInspection(d.id);
      await load();
      onChange?.();
    } catch (e: any) {
      alert('Could not approve: ' + (e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (d: any) => {
    if (!confirm('Discard this draft inspection and its photos/voice notes?')) return;
    setBusyId(d.id);
    try {
      await discardInspection(d.id);
      await load();
      onChange?.();
    } catch (e: any) {
      alert('Could not discard: ' + (e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-2">
      <h3 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-1 flex items-center gap-1.5">
        <Sparkles size={14} className="text-[var(--color-primary)]" />
        Drafts waiting for review ({drafts.length})
      </h3>
      {drafts.map((d) => (
        <div key={d.id} className="card p-3 border-l-4 border-amber-400 flex items-center gap-2">
          <button onClick={() => review(d)} className="flex-1 text-left min-w-0">
            <p className="font-bold text-sm text-[var(--color-text)]">Plus inspection</p>
            <p className="text-[11px] text-[var(--color-text-muted)] font-bold uppercase tracking-wide">
              {new Date(d.timestamp).toLocaleDateString()}{' '}
              {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </button>
          <button
            onClick={() => review(d)}
            className="px-3 py-2 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-text)] font-bold text-xs active:scale-95 flex-shrink-0"
          >
            Review
          </button>
          <button
            onClick={() => approve(d)}
            disabled={busyId === d.id}
            className="px-3 py-2 rounded-xl bg-[var(--color-primary)] text-white font-bold text-xs flex items-center gap-1 active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            <Check size={14} /> Approve
          </button>
          <button
            onClick={() => discard(d)}
            disabled={busyId === d.id}
            aria-label="Discard draft"
            className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
