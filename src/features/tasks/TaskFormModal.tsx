import React, { useState, useEffect } from 'react';
import { createTask, updateTask, deleteTask } from '../../data/taskRepository';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2, Calendar, AlertTriangle, X } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
  defaultHiveId?: string;
  defaultApiaryId?: string;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialData,
  defaultHiveId,
  defaultApiaryId
}) => {
  const { user } = useAppStore();
  const [loading, setLoading] = useState(false);

  const isEditing = !!initialData;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setPriority(initialData.priority || 'medium');
        setStatus(initialData.status || 'pending');
        if (initialData.due_date) {
          setDueDate(new Date(initialData.due_date).toISOString().split('T')[0]);
        }
      } else {
        setTitle('');
        setDescription('');
        setPriority('medium');
        setStatus('pending');
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setDueDate(d.toISOString().split('T')[0]);
      }
    }
  }, [isOpen, initialData]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg("Please enter a task title");
      return;
    }
    
    setLoading(true);

    try {
      let parsedDueDate = null;
      try {
        if (dueDate) {
          parsedDueDate = new Date(dueDate).toISOString();
        }
      } catch (e: any) {
        throw new Error("Invalid due date");
      }

      const hiveId = isEditing ? initialData.hive_id : (defaultHiveId || null);
      const apiaryId = isEditing ? initialData.apiary_id : (defaultApiaryId || null);
      // Scope must stay consistent with which location is set, or the database's
      // tasks_scope_check rejects the row. The old code recomputed it from hive_id
      // alone, so editing an apiary-level task set scope='general' while keeping
      // the apiary_id -> constraint violation. On edit, preserve the task's
      // existing (already-valid) scope; only derive it for brand-new tasks.
      // Allowed scopes are 'hive' | 'apiary' | 'user' (per the DB tasks_scope_check).
      // A task with no hive/apiary is personal -> 'user' (the old code used the
      // invalid value 'general').
      const derivedScope = hiveId ? 'hive' : apiaryId ? 'apiary' : 'user';
      const payload = {
        hive_id: hiveId,
        apiary_id: apiaryId,
        assigned_user_id: user?.id,
        title,
        description,
        priority,
        due_date: parsedDueDate,
        status,
        scope: isEditing ? (initialData.scope ?? derivedScope) : derivedScope
      };

      if (isEditing) {
        await updateTask(initialData.id, payload);
      } else {
        await createTask(payload);
      }

      onSuccess();
    } catch (error: any) {
      console.error("Task Save Error:", error);
      setErrorMsg(error.message || 'An unexpected error occurred while saving.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData || !confirm('Are you sure you want to delete this task?')) return;
    setLoading(true);
    try {
      await deleteTask(initialData.id);
      onSuccess();
    } catch (error: any) {
      alert('Error deleting task: ' + error.message);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-[var(--color-bg)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-[var(--color-divider)] bg-[var(--color-primary)]">
          <h2 className="text-xl font-black text-white">
            {isEditing ? 'Edit Task' : 'New Task'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-white/80 hover:bg-black/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Task Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3.5 bg-[var(--color-input-bg)] border border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
              placeholder="e.g. Order bee packages, check for mites..."
            />
          </div>

          {/* Status (If Editing) */}
          {isEditing && (
            <div>
              <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setStatus('pending')}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors ${status === 'pending' ? 'bg-amber-500/15 border-amber-500 text-amber-400' : 'bg-[var(--color-input-bg)] border-[var(--color-card-border)] text-[var(--color-text-muted)]'}`}
                >
                  Pending
                </button>
                <button 
                  onClick={() => setStatus('completed')}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors ${status === 'completed' ? 'bg-green-500/15 border-green-500 text-green-400' : 'bg-[var(--color-input-bg)] border-[var(--color-card-border)] text-[var(--color-text-muted)]'}`}
                >
                  Completed
                </button>
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Priority</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setPriority('low')}
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors ${priority === 'low' ? 'bg-blue-500/15 border-blue-500 text-blue-400' : 'bg-[var(--color-input-bg)] border-[var(--color-card-border)] text-[var(--color-text-muted)]'}`}
              >
                Low
              </button>
              <button 
                onClick={() => setPriority('medium')}
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors ${priority === 'medium' ? 'bg-amber-500/15 border-amber-500 text-amber-400' : 'bg-[var(--color-input-bg)] border-[var(--color-card-border)] text-[var(--color-text-muted)]'}`}
              >
                Medium
              </button>
              <button 
                onClick={() => setPriority('high')}
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors flex items-center justify-center gap-1 ${priority === 'high' ? 'bg-red-500/15 border-red-500 text-red-400' : 'bg-[var(--color-input-bg)] border-[var(--color-card-border)] text-[var(--color-text-muted)]'}`}
              >
                <AlertTriangle size={16} /> High
              </button>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Due Date</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3.5 text-[var(--color-text-muted)]" size={20} />
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-12 pl-11 pr-4 py-0 block bg-[var(--color-input-bg)] border border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Description</label>
            <textarea 
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 bg-[var(--color-input-bg)] border border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all resize-none"
              placeholder="Add any extra details..."
            />
          </div>

        </div>

        {errorMsg && (
          <div className="px-4 pb-2 sm:px-6">
            <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm font-bold border-2 border-red-500/20 flex items-center gap-2">
              <span className="text-xl">⚠️</span> {errorMsg}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex-shrink-0 p-4 border-t border-[var(--color-divider)] bg-[var(--color-bg)] flex justify-center gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-black active:scale-95 transition-transform"
            >
              <Trash2 size={24} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 p-4 bg-[var(--color-primary)] text-white rounded-2xl font-black text-lg shadow-lg shadow-[var(--color-primary)]/20 active:scale-95 transition-transform disabled:opacity-70"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Save size={24} />
                {isEditing ? 'Update Task' : 'Save Task'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
