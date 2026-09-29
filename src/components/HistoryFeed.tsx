// Shared history list ("HistoryFeed") — SPEC B §12 (screenshot B25).

import { useEffect, useState } from 'react';
import { DeleteHint, EditPencil } from './EditPencil';
import { supabase } from '../lib/supabase';
import { parseBars, type StackPart, type TopBar } from '../lib/apiaryHiveData';
import { BAR_COLOUR, PART_STYLE } from './hiveConfig';

export type FeedKind = 'inspection' | 'intervention' | 'snapshot' | 'task' | 'varroa';
export type FeedFilter = 'inspections' | 'interventions' | 'snapshots' | 'tasks' | 'varroa_tests' | 'all';

export interface FeedItem {
  kind: FeedKind;
  id: string;
  sortTime: number;
  row: Record<string, unknown>;
}

const TABLES: Record<Exclude<FeedFilter, 'all'>, { table: 'inspections' | 'interventions' | 'hive_snapshots' | 'tasks' | 'varroa_tests'; order: string; kind: FeedKind }> = {
  inspections: { table: 'inspections', order: 'timestamp', kind: 'inspection' },
  interventions: { table: 'interventions', order: 'timestamp', kind: 'intervention' },
  snapshots: { table: 'hive_snapshots', order: 'timestamp', kind: 'snapshot' },
  tasks: { table: 'tasks', order: 'created_at', kind: 'task' },
  varroa_tests: { table: 'varroa_tests', order: 'tested_at', kind: 'varroa' },
};

const DEFAULT_TITLE: Record<FeedFilter, string> = {
  inspections: 'Inspection History',
  interventions: 'Intervention History',
  tasks: 'Task History',
  snapshots: 'Configuration History',
  varroa_tests: 'Mite Test History',
  all: 'Recent History',
};

async function loadFeed(hiveId: string, filter: FeedFilter): Promise<FeedItem[]> {
  const keys = filter === 'all' ? (Object.keys(TABLES) as (keyof typeof TABLES)[]) : [filter];
  const limit = filter === 'all' ? 10 : 100;
  const parts = await Promise.all(
    keys.map(async k => {
      const t = TABLES[k];
      const { data } = await supabase.from(t.table).select('*').eq('hive_id', hiveId).order(t.order, { ascending: false }).limit(limit);
      return (data ?? []).map(row => {
        const r = row as Record<string, unknown>;
        const when = (r.timestamp as string) || (r.created_at as string);
        return { kind: t.kind, id: String(r.id), sortTime: when ? Date.parse(when) : Date.now(), row: r };
      });
    }),
  );
  const merged = parts.flat().sort((a, b) => b.sortTime - a.sortTime);
  return filter === 'all' ? merged.slice(0, 10) : merged;
}

const miteColour = (pct: number, threshold: number) => (pct >= 1.5 * threshold ? '#EF4444' : pct >= threshold ? '#F59E0B' : '#10B981');

function MiniConfig({ bars }: { bars: unknown[] }) {
  if ((bars[0] as { type?: string } | undefined)?.type) {
    const heights: Record<string, number> = { deep: 16, medium: 12, shallow: 8, feeder: 8, inner_cover: 4, slatted_rack: 6, excluder: 2 };
    return (
      <div className="w-12 mx-auto flex flex-col gap-0.5">
        {(bars as StackPart[]).map((p, i) => {
          const s = PART_STYLE[p.type];
          return <div key={p.id ?? i} style={{ height: heights[p.type] ?? 8, background: s?.fill ?? '#3D3226', border: `1px solid ${s?.border ?? '#3D3226'}` }} />;
        })}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap justify-center gap-0.5">
      {(bars as TopBar[]).map((b, i) => (
        <div key={i} style={{ width: 6, height: 20, background: b.status === 'inactive' ? '#E5E7EB' : BAR_COLOUR[b.status] ?? '#E5E7EB', border: '1px solid rgba(0,0,0,0.08)' }} />
      ))}
    </div>
  );
}

function FeedCard({ item, onTap }: { item: FeedItem; onTap: () => void }) {
  const r = item.row;
  const when = new Date(item.kind === 'varroa' ? (r.tested_at as string) : item.sortTime);
  const date = `${when.toLocaleDateString()} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  let border = 'var(--color-primary)';
  let headline: React.ReactNode = null;
  if (item.kind === 'snapshot') border = '#93c5fd';
  if (item.kind === 'intervention') {
    border = '#a855f7';
    headline = <span className="text-purple-600">Intervention: {(r.type as string) || 'Other'}</span>;
  }
  if (item.kind === 'task') {
    border = '#06b6d4';
    headline = <span className={`text-cyan-600 ${r.status === 'completed' ? 'line-through opacity-60' : ''}`}>Task: {r.title as string}</span>;
  }
  if (item.kind === 'varroa') {
    const pct = Number(r.mite_pct ?? 0);
    const colour = miteColour(pct, Number(r.threshold ?? 0));
    border = colour;
    headline = <span style={{ color: colour }}>Mite Test: {pct.toFixed(1)}% Load</span>;
  }
  if (item.kind === 'inspection') headline = <span className="text-primary-ink">Inspection</span>;
  const body = (r.observations as string) || (r.description as string) || (r.notes as string);
  const bars = item.kind === 'snapshot' ? parseBars(r.bars) : null;
  const chip = 'rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-text-muted';

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left rounded-[1.75rem] bg-card-bg border-2 shadow-sm p-5 flex items-start gap-3 active:scale-[0.99] transition-transform"
      style={{ borderColor: item.kind === 'snapshot' ? '#93c5fd' : 'rgba(255,255,255,0.6)', borderLeft: `6px solid ${border}` }}
    >
      <div className="flex-1 min-w-0">
        {headline && <p className="font-black leading-snug">{headline}</p>}
        <p className={`text-sm font-bold text-text-muted ${headline ? 'mt-0.5' : ''}`}>{date}</p>
        {bars && (
          <div className="mt-3 rounded-2xl bg-white/80 py-4">
            <MiniConfig bars={bars} />
          </div>
        )}
        {body && <p className="mt-2 text-sm text-text line-clamp-2">{body}</p>}
        {item.kind === 'varroa' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={chip}>Bees: {String(r.bee_count)}</span>
            <span className={chip}>Mites: {String(r.mite_count)}</span>
            <span className={chip}>Threshold: {String(r.threshold)}%</span>
          </div>
        )}
        {item.kind === 'task' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={chip}>{(r.status as string) || 'pending'}</span>
            <span className={chip} style={r.priority === 'high' ? { color: '#dc2626' } : undefined}>
              {(r.priority as string) || 'medium'} priority
            </span>
          </div>
        )}
      </div>
      {item.kind === 'snapshot' ? <DeleteHint /> : <EditPencil />}
    </button>
  );
}

interface Props {
  hiveId: string;
  filter: FeedFilter;
  title?: string;
  hideCompletedTasks?: boolean;
  /** Change to reload. */
  refreshKey?: number;
  onOpen: (item: FeedItem) => void;
}

export function HistoryFeed({ hiveId, filter, title, hideCompletedTasks, refreshKey = 0, onOpen }: Props) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let live = true;
    setItems(null);
    void loadFeed(hiveId, filter).then(r => live && setItems(r));
    return () => {
      live = false;
    };
  }, [hiveId, filter, refreshKey, bump]);

  if (items === null) return <div className="rounded-[1.75rem] border-2 border-dashed border-divider bg-card-bg p-8 text-center text-text-muted">Loading history...</div>;
  if (items.length === 0) return <div className="rounded-[1.75rem] border-2 border-dashed border-divider bg-card-bg p-10 text-center text-lg text-text-muted">No recent history found.</div>;

  const completed = items.filter(i => i.kind === 'task' && i.row.status === 'completed');
  const visible = hideCompletedTasks && !showCompleted ? items.filter(i => !(i.kind === 'task' && i.row.status === 'completed')) : items;
  const shown = showAll ? visible : visible.slice(0, 3);

  const tap = async (item: FeedItem) => {
    if (item.kind === 'snapshot') {
      if (!window.confirm('Delete this configuration snapshot?')) return;
      const { error } = await supabase.from('hive_snapshots').delete().eq('id', item.id);
      if (error) window.alert(`Failed to delete snapshot: ${error.message}`);
      setBump(b => b + 1);
      return;
    }
    window.scrollTo({ top: 0 });
    onOpen(item);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-text-muted">{title ?? DEFAULT_TITLE[filter]}</h3>
        <div className="flex items-center gap-3">
          {hideCompletedTasks && completed.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
              Show Completed ({completed.length})
            </label>
          )}
          {visible.length > 3 && (
            <button type="button" onClick={() => setShowAll(s => !s)} className="shrink-0 h-9 px-4 rounded-full border-2 border-primary-faint bg-white/80 text-sm font-black text-primary-ink">
              {showAll ? 'Show Less' : `Show All (${visible.length})`}
            </button>
          )}
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="rounded-[1.75rem] border-2 border-dashed border-divider bg-card-bg p-8 text-center text-text-muted">No open tasks for this hive.</div>
      ) : (
        <div className="space-y-3">
          {shown.map(i => (
            <FeedCard key={`${i.kind}-${i.id}`} item={i} onTap={() => void tap(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
