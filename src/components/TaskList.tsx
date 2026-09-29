// Task list with its "+ New Task" button and task sheet — SPEC B §2, used by the Dashboard
// (every task assigned to the user) and the hive's Tasks screen (that hive's tasks; deliberate
// change #6: the same list and edit cue everywhere).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Circle, Plus } from 'lucide-react';
import { useApp } from '../app/store';
import { Spinner } from './Chrome';
import { EditPencil } from './EditPencil';
import { TaskSheet } from './TaskSheet';
import { loadTasks, placeLine, setTaskDone, type Task, type TaskWithPlace } from '../lib/records';

function TaskRow({ t, onToggle, onOpen }: { t: TaskWithPlace; onToggle: () => void; onOpen: () => void }) {
  const done = t.status === 'completed';
  const due = t.due_date ? new Date(t.due_date) : null;
  const overdue = !!due && due.getTime() < Date.now() && !done;
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => e.key === 'Enter' && onOpen()} className="card flex items-center gap-3 px-4 py-4 cursor-pointer active:scale-[0.99] transition-transform">
      <button
        type="button"
        aria-label={done ? 'Mark as pending' : 'Mark as completed'}
        onClick={e => {
          e.stopPropagation();
          onToggle();
        }}
        className="shrink-0"
      >
        {done ? <CheckCircle2 size={26} className="text-green-500" /> : <Circle size={26} className="text-gray-300" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-bold truncate ${done ? 'line-through text-text-muted' : 'text-text'}`}>{t.title}</p>
          {t.priority === 'high' && !done && (
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">
              <AlertTriangle size={11} /> HIGH
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm text-text-muted">
          <span className="truncate">{placeLine(t)}</span>
          {due && (
            <span className={`shrink-0 flex items-center gap-1 ${overdue ? 'text-red-600 font-bold' : ''}`}>
              <Calendar size={13} /> {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      <EditPencil />
    </div>
  );
}

interface Props {
  /** Dashboard: every task assigned to the user. Hive screen: that hive's tasks. */
  hiveId?: string | null;
  apiaryId?: string | null;
  heading: string;
  subheading: string;
  listTitle: string;
  /** Open this task's edit sheet straight away (tapped on the Hive Detail page). */
  openTask?: Task | null;
  /** Called after any change, e.g. so the dashboard's to-do count follows. */
  onChanged?: (tasks: TaskWithPlace[]) => void;
}

export function TaskPanel({ hiveId, apiaryId, heading, subheading, listTitle, openTask, onChanged }: Props) {
  const { state, reloadNavData } = useApp();
  const userId = state.user?.id;
  const [tasks, setTasksRaw] = useState<TaskWithPlace[] | null>(null);
  const [sheet, setSheet] = useState<{ task: Task | null } | null>(openTask ? { task: openTask } : null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Held in a ref so a new callback each render never re-triggers the load.
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const setTasks = useCallback((t: TaskWithPlace[]) => {
    setTasksRaw(t);
    changed.current?.(t);
  }, []);

  const reload = useCallback(async () => {
    if (!userId) return;
    setTasks(await loadTasks(hiveId ? { hiveId } : { userId }).catch(() => []));
  }, [userId, hiveId, setTasks]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = (tasks ?? []).filter(t => showCompleted || t.status !== 'completed');
  const shown = showAll ? visible : visible.slice(0, 3);

  // Optimistic toggle; revert on failure.
  const toggle = async (t: TaskWithPlace) => {
    if (!tasks) return;
    const done = t.status !== 'completed';
    const before = tasks;
    setTasks(tasks.map(x => (x.id === t.id ? { ...x, status: done ? 'completed' : 'pending', completed_at: done ? new Date().toISOString() : null } : x)));
    try {
      await setTaskDone(t.id, done);
    } catch {
      setTasks(before);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-text">{heading}</h2>
          <p className="mt-1 text-text-muted">{subheading}</p>
        </div>
        <button type="button" onClick={() => setSheet({ task: null })} className="shrink-0 h-[38px] px-4 rounded-full bg-card-bg border border-card-border shadow-sm font-bold text-text flex items-center gap-2">
          <Plus size={18} /> New Task
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 px-1">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-text whitespace-nowrap">{listTitle}</h3>
          {visible.length > 3 && (
            <button type="button" onClick={() => setShowAll(s => !s)} className="h-8 px-3 rounded-full border-2 border-primary-faint bg-white/80 text-xs font-black text-primary-ink">
              {showAll ? 'Show Less' : `Show All (${visible.length})`}
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-text-muted shrink-0">
          <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} className="w-5 h-5 accent-[var(--color-primary)]" />
          Show Completed
        </label>
      </div>
      {tasks === null ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-divider bg-white/30 px-6 py-10 text-center text-lg text-text-muted">No tasks found. You're all caught up!</div>
      ) : (
        <div className="space-y-3">
          {shown.map(t => (
            <TaskRow key={t.id} t={t} onToggle={() => void toggle(t)} onOpen={() => setSheet({ task: t })} />
          ))}
        </div>
      )}

      <TaskSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        task={sheet?.task}
        defaultHiveId={hiveId}
        defaultApiaryId={apiaryId}
        onSaved={() => {
          void reload();
          void reloadNavData();
        }}
      />
    </div>
  );
}
