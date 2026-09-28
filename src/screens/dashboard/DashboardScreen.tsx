// Dashboard and its task list — SPEC B §1, §2 (screenshots B02, B37, B38).

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Box, Calendar, CheckCircle2, ChevronRight, Circle, ClipboardList, MapPin, Plus, type LucideIcon } from 'lucide-react';
import { useApp } from '../../app/store';
import { Spinner } from '../../components/Chrome';
import { TaskSheet } from '../../components/TaskSheet';
import { loadMyTasks, placeLine, setTaskDone, type Task, type TaskWithPlace } from '../../lib/records';

function StatTile({ icon: Icon, colour, value, label, onClick }: { icon: LucideIcon; colour: string; value: string | number; label: string; onClick?: () => void }) {
  const body = (
    <>
      <Icon size={26} className={colour} />
      <span className="mt-2 block text-3xl font-black text-text leading-none">{value}</span>
      <span className="mt-3 block text-xs font-black uppercase tracking-wider text-text-muted">{label}</span>
    </>
  );
  const cls = 'card flex-1 min-w-0 px-4 py-4 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:scale-[0.98] transition-transform`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

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
      <ChevronRight size={20} className="shrink-0 text-text-muted" />
    </div>
  );
}

function TaskList({ tasks, onChange, onOpen }: { tasks: TaskWithPlace[] | null; onChange: (next: TaskWithPlace[]) => void; onOpen: (t: Task) => void }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const visible = (tasks ?? []).filter(t => showCompleted || t.status !== 'completed');
  const shown = showAll ? visible : visible.slice(0, 3);

  // Optimistic toggle; revert on failure.
  const toggle = async (t: TaskWithPlace) => {
    if (!tasks) return;
    const done = t.status !== 'completed';
    const before = tasks;
    onChange(tasks.map(x => (x.id === t.id ? { ...x, status: done ? 'completed' : 'pending', completed_at: done ? new Date().toISOString() : null } : x)));
    try {
      await setTaskDone(t.id, done);
    } catch {
      onChange(before);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 px-1">
        <div className="flex items-center gap-3">
          <h3 className="text-2xl font-bold text-text">My Upcoming Tasks</h3>
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
            <TaskRow key={t.id} t={t} onToggle={() => void toggle(t)} onOpen={() => onOpen(t)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardScreen() {
  const { state, openApiariesTab, openHivesTab, reloadNavData } = useApp();
  const userId = state.user?.id;
  const [tasks, setTasks] = useState<TaskWithPlace[] | null>(null);
  const [sheet, setSheet] = useState<{ task: Task | null } | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setTasks(await loadMyTasks(userId).catch(() => []));
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const todo = tasks === null ? '...' : tasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6">
      <h1 className="text-3xl font-black text-text">
        Welcome back, <span className="text-primary">Beekeeper</span>!
      </h1>
      <p className="mt-1 text-text-muted">Here is an overview of your apiaries and hives today.</p>

      <div className="mt-6 flex gap-3">
        <StatTile icon={MapPin} colour="text-primary" value={state.apiaries.length} label="Apiaries" onClick={openApiariesTab} />
        <StatTile icon={Box} colour="text-primary" value={state.hives.length} label="Hives" onClick={openHivesTab} />
        <StatTile icon={ClipboardList} colour="text-blue-500" value={todo} label="To-Do" />
      </div>

      <hr className="my-8 border-divider" />

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-black text-text">My Tasks</h2>
          <p className="mt-1 text-text-muted">Keep track of inspections and tasks.</p>
        </div>
        <button type="button" onClick={() => setSheet({ task: null })} className="shrink-0 h-[38px] px-4 rounded-full bg-card-bg border border-card-border shadow-sm font-bold text-text flex items-center gap-2">
          <Plus size={18} /> New Task
        </button>
      </div>

      <TaskList tasks={tasks} onChange={setTasks} onOpen={t => setSheet({ task: t })} />

      <TaskSheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        task={sheet?.task}
        onSaved={() => {
          void reload();
          void reloadNavData();
        }}
      />
    </div>
  );
}
