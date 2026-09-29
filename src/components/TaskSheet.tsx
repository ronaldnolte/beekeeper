// Task sheet (create/edit) — SPEC B §3 (screenshots B36, B37).

import { useState } from 'react';
import { AlertTriangle, Calendar, Save, Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { Spinner } from './Chrome';
import { TextArea, TextInput } from './Form';

/** The task sheet's labels are smaller than the other record sheets' (screenshots B36, B37). */
function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block mb-2 text-xs font-black uppercase tracking-wider text-text-muted">
      {children}
    </label>
  );
}
import { useApp } from '../app/store';
import { defaultDueDay, deleteTask, dueDateIso, dueDay, saveTask, type Task } from '../lib/records';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful save or delete. */
  onSaved: () => void;
  task?: Task | null;
  defaultHiveId?: string | null;
  defaultApiaryId?: string | null;
}

/** Selected = amber fill with white text (deliberate change #5: the live app drew amber on amber). */
function Choice({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex-1 h-12 rounded-2xl border border-white/60 text-sm font-black flex items-center justify-center gap-2 ${on ? 'bg-primary text-white' : 'bg-white/70 text-text-muted'}`}
    >
      {children}
    </button>
  );
}

function TaskForm({ task, onClose, onSaved, defaultHiveId, defaultApiaryId }: Omit<Props, 'open'>) {
  const { state } = useApp();
  const editing = !!task;
  const [title, setTitle] = useState(task?.title ?? '');
  const [status, setStatus] = useState(task?.status ?? 'pending');
  const [priority, setPriority] = useState(task?.priority ?? 'medium');
  const [day, setDay] = useState(task ? (task.due_date ? dueDay(task.due_date) : '') : defaultDueDay());
  const [description, setDescription] = useState(task?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return setError('Please enter a task title');
    setBusy(true);
    setError(null);
    try {
      await saveTask(
        task ?? null,
        { title: title.trim(), status, priority, due_date: dueDateIso(day), description: description.trim() || null },
        { hiveId: defaultHiveId ?? null, apiaryId: defaultHiveId ? null : (defaultApiaryId ?? null) },
        state.user!.id,
      );
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!task || !window.confirm('Are you sure you want to delete this task?')) return;
    setBusy(true);
    try {
      await deleteTask(task.id);
      onSaved();
      onClose();
    } catch (err) {
      window.alert(`Error deleting task: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="px-4 pt-5 pb-4 space-y-5">
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">⚠️ {error}</div>}
        <div>
          <Label htmlFor="task-title">Task title</Label>
          <TextInput id="task-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Order bee packages, check for mites..." className="!h-[52px] !text-[15px]" />
        </div>
        {editing && (
          <div>
            <Label>Status</Label>
            <div className="flex gap-2">
              <Choice on={status === 'pending'} onClick={() => setStatus('pending')}>Pending</Choice>
              <Choice on={status === 'completed'} onClick={() => setStatus('completed')}>Completed</Choice>
            </div>
          </div>
        )}
        <div>
          <Label>Priority</Label>
          <div className="flex gap-2">
            <Choice on={priority === 'low'} onClick={() => setPriority('low')}>Low</Choice>
            <Choice on={priority === 'medium'} onClick={() => setPriority('medium')}>Medium</Choice>
            <Choice on={priority === 'high'} onClick={() => setPriority('high')}>
              <AlertTriangle size={15} /> High
            </Choice>
          </div>
        </div>
        <div>
          <Label htmlFor="task-due">Due date</Label>
          <div className="relative">
            <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              id="task-due"
              type="date"
              value={day}
              onChange={e => setDay(e.target.value)}
              className="w-full h-12 rounded-2xl bg-white/70 border border-white/60 pl-12 pr-4 text-base font-bold text-primary outline-none focus:ring-4 focus:ring-primary-ring"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="task-desc">Description</Label>
          <TextArea id="task-desc" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Add any extra details..." className="!text-[15px]" />
        </div>
      </div>
      <div className="sticky bottom-0 flex gap-3 border-t border-divider bg-bg px-4 py-4">
        {editing && (
          <button type="button" aria-label="Delete task" disabled={busy} onClick={() => void remove()} className="w-[60px] h-[60px] shrink-0 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center disabled:opacity-50">
            <Trash2 size={24} />
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void save()} className="flex-1 h-[60px] rounded-2xl bg-primary text-white text-lg font-black shadow-md flex items-center justify-center gap-3 disabled:opacity-60">
          {busy ? <Spinner className="w-6 h-6" /> : <Save size={24} />} {editing ? 'Update Task' : 'Save Task'}
        </button>
      </div>
    </>
  );
}

export function TaskSheet({ open, onClose, task, ...rest }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={task ? 'Edit Task' : 'New Task'}>
      <TaskForm key={task?.id ?? 'new'} task={task} onClose={onClose} {...rest} />
    </Sheet>
  );
}
