import React, { useEffect, useState } from 'react';
import { fetchApiaries as loadApiaries, deleteApiaryWithCascade } from '../../data/apiaryRepository';
import { useAppStore } from '../../store/useAppStore';
import { SelectionList } from '../../shared/components/SelectionList';
import type { SelectionItem } from '../../shared/components/SelectionCard';
import { MapPin, Plus, ClipboardList } from 'lucide-react';
import { ApiaryFormModal } from './ApiaryFormModal';
import { TaskList } from '../tasks/TaskList';
import { TaskFormModal } from '../tasks/TaskFormModal';

export const ApiarySelectionView: React.FC = () => {
  const { user, selectApiary, setApiaryFormOpen } = useAppStore();
  const [apiaries, setApiaries] = useState<SelectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Task Form State
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  useEffect(() => {
    const fetchApiaries = async () => {
      if (!user) return;
      
      const data = await loadApiaries(user.id);

      const formatted: SelectionItem[] = data.map((a: any) => ({
        id: a.id,
        title: a.name,
        subtitle: a.zip_code ? `ZIP: ${a.zip_code}` : (a.latitude ? 'Location: Coordinates' : 'No location set'),
        icon: <MapPin size={22} />,
        raw: a
      }));
      setApiaries(formatted);
      setLoading(false);
    };

    fetchApiaries();
  }, [user]);

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setIsTaskFormOpen(true);
  };

  const handleDeleteApiary = async (id: string) => {
    const apiary = apiaries.find(a => a.id === id);
    if (!apiary || !user) return;
    
    if (!window.confirm(`Are you sure you want to delete "${apiary.title}"? This will delete all hives inside it!`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteApiaryWithCascade(id, user.id);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to delete apiary');
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center pt-4 pb-28">
      
      {/* 1. Task Dashboard */}
      <div className="w-full max-w-2xl px-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xl font-black text-[var(--color-text)]">Dashboard</h2>
            <p className="text-[var(--color-text-muted)] font-medium text-sm mt-0.5">Your beekeeping overview.</p>
          </div>
          <button
            onClick={handleCreateTask}
            className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] text-[var(--color-text)] px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform"
          >
            <ClipboardList size={16} /> New Task
          </button>
        </div>
        <TaskList onEditTask={handleEditTask} refreshKey={taskRefreshKey} />
      </div>

      <div className="w-full max-w-2xl px-4 my-3">
        <hr className="border-[var(--color-divider)]" />
      </div>

      {/* 2. Apiary Selection */}
      <div className="w-full max-w-2xl px-4 mb-1">
        <h3 className="text-lg font-black text-[var(--color-text)]">My Apiaries</h3>
        <p className="text-[var(--color-text-muted)] font-medium text-xs mt-0.5">Select a location to view hives.</p>
      </div>

      <SelectionList 
        items={apiaries.map(a => ({ ...a, onDelete: handleDeleteApiary }))}
        isLoading={loading}
        onSelect={selectApiary}
        onEdit={(id) => {
          const apiary = apiaries.find(a => a.id === id);
          setApiaryFormOpen(true, apiary);
        }}
        emptyMessage="No apiaries found. Create your first apiary to get started."
      />

      <div className="bottom-action-bar">
        <button
          onClick={() => setApiaryFormOpen(true, null)}
          className="flex-1 max-w-[300px] bg-[var(--color-primary)] text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-[var(--color-primary)]/30"
        >
          <Plus size={18} /> Create Apiary
        </button>
      </div>

      <ApiaryFormModal onSuccess={() => {
        setLoading(true);
        window.location.reload();
      }} />

      <TaskFormModal 
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        initialData={editingTask}
        onSuccess={() => {
          setIsTaskFormOpen(false);
          setTaskRefreshKey(prev => prev + 1);
        }}
      />
    </div>
  );
};
