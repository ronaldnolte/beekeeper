import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { SelectionList } from '../components/SelectionList';
import type { SelectionItem } from '../components/SelectionCard';
import { MapPin, Plus } from 'lucide-react';
import { ApiaryFormModal } from '../components/ApiaryFormModal';
import { TaskList } from '../components/TaskList';
import { TaskFormModal } from '../components/TaskFormModal';

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
      
      const { data } = await supabase
        .from('apiaries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        const formatted: SelectionItem[] = data.map(a => ({
          id: a.id,
          title: a.name,
          subtitle: a.zip_code ? `ZIP: ${a.zip_code}` : (a.latitude ? 'Location: Coordinates' : 'No location set'),
          icon: <MapPin size={24} />,
          raw: a
        }));
        setApiaries(formatted);
      }
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
      const { deleteApiaryWithCascade } = await import('../lib/apiaryDelete');
      await deleteApiaryWithCascade(id, user.id);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to delete apiary');
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center pt-6 honeycomb-bg pb-24">
      
      {/* 1. Global Task Dashboard */}
      <div className="w-full max-w-2xl px-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text)]">Dashboard</h2>
            <p className="text-gray-500 font-medium text-sm mt-0.5">Your beekeeping overview.</p>
          </div>
          <button
            onClick={handleCreateTask}
            className="bg-[#E67E22] text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-[#D35400] transition-colors active:scale-95 shadow-sm shadow-[#E67E22]/20 flex items-center gap-1.5"
          >
            <Plus size={16} /> New Task
          </button>
        </div>

        <TaskList onEditTask={handleEditTask} refreshKey={taskRefreshKey} />
      </div>

      <div className="w-full max-w-2xl px-4 my-4">
        <hr className="border-gray-200" />
      </div>

      {/* 2. Apiary Selection */}
      <div className="w-full max-w-2xl px-4 mb-2 flex justify-between items-end">
        <div>
          <h3 className="text-xl font-bold text-[var(--color-text)]">My Apiaries</h3>
          <p className="text-gray-500 font-medium text-xs mt-0.5">Select a location to view hives.</p>
        </div>
        <button
          onClick={() => setApiaryFormOpen(true, null)}
          className="text-[#E67E22] font-bold text-sm px-3 py-1.5 bg-white rounded-lg border border-[#E67E22]/30 hover:bg-[#E67E22]/5 flex items-center gap-1.5 active:scale-95 shadow-sm"
        >
          <Plus size={14} /> Create Apiary
        </button>
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
