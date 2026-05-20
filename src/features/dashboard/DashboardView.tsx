import React, { useEffect, useState } from 'react';
import { fetchTasks as loadTasks } from '../../data/taskRepository';
import { useAppStore } from '../../store/useAppStore';
import { TaskList } from '../tasks/TaskList';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { MapPin, Box, ClipboardList, Plus } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { user, apiariesList, hivesList, navigateToApiariesTab, navigateToHivesTab } = useAppStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  
  // Task Form State
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!user) return;
      try {
        const data = await loadTasks(user.id);
        setTasks(data);
      } catch (e) {
        console.error("Failed to load dashboard tasks", e);
      } finally {
        setLoadingTasks(false);
      }
    };
    fetchTasks();
  }, [user, taskRefreshKey]);

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setIsTaskFormOpen(true);
  };

  const handleTaskSuccess = () => {
    setIsTaskFormOpen(false);
    setTaskRefreshKey(prev => prev + 1);
    
    // Also trigger store reload of navigation context to sync count
    if (user) {
      useAppStore.getState().loadNavigationContext(user.id);
    }
  };

  const pendingTasksCount = tasks.filter(t => t.status !== 'completed').length;

  return (
    <div className="w-full flex-1 overflow-y-auto flex flex-col items-center pt-4 animate-in fade-in duration-300">
      
      {/* 1. Greeting Header */}
      <div className="w-full max-w-2xl px-4 mb-6">
        <h2 className="text-2xl sm:text-3xl font-black text-[var(--color-text)] leading-tight">
          Welcome back, <span className="text-[var(--color-primary)]">Beekeeper</span>!
        </h2>
        <p className="text-[var(--color-text-muted)] font-medium text-sm mt-1">
          Here is an overview of your apiaries and hives today.
        </p>
      </div>

      {/* 2. Glassmorphic Statistics Grid */}
      <div className="w-full max-w-2xl px-4 grid grid-cols-3 gap-3 mb-6">
        
        {/* Apiaries Stat Card */}
        <button
          onClick={navigateToApiariesTab}
          className="card p-3 sm:p-4 text-left flex flex-col justify-between h-24 sm:h-28 active:scale-95 transition-transform hover:border-[var(--color-primary)] hover:bg-[var(--color-card-bg)]/80 outline-none"
        >
          <div className="text-[var(--color-primary)]">
            <MapPin size={22} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">
              {apiariesList.length}
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
              Apiaries
            </div>
          </div>
        </button>

        {/* Hives Stat Card */}
        <button
          onClick={navigateToHivesTab}
          className="card p-3 sm:p-4 text-left flex flex-col justify-between h-24 sm:h-28 active:scale-95 transition-transform hover:border-[var(--color-primary)] hover:bg-[var(--color-card-bg)]/80 outline-none"
        >
          <div className="text-amber-500">
            <Box size={22} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">
              {hivesList.length}
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
              Hives
            </div>
          </div>
        </button>

        {/* Pending Tasks Stat Card */}
        <div
          className="card p-3 sm:p-4 text-left flex flex-col justify-between h-24 sm:h-28"
        >
          <div className="text-blue-500">
            <ClipboardList size={22} />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[var(--color-text)]">
              {loadingTasks ? '...' : pendingTasksCount}
            </div>
            <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mt-0.5">
              To-Do
            </div>
          </div>
        </div>

      </div>

      <div className="w-full max-w-2xl px-4 my-2">
        <hr className="border-[var(--color-divider)]" />
      </div>

      {/* 3. Task Dashboard Section */}
      <div className="w-full max-w-2xl px-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-[var(--color-text)]">My Tasks</h3>
            <p className="text-[var(--color-text-muted)] font-medium text-xs mt-0.5">
              Keep track of inspections and tasks.
            </p>
          </div>
          <button
            onClick={handleCreateTask}
            className="bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-transform shadow-sm"
          >
            <Plus size={14} /> New Task
          </button>
        </div>
        
        <TaskList onEditTask={handleEditTask} refreshKey={taskRefreshKey} />
      </div>

      {/* Forms and Modals */}
      <TaskFormModal 
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        initialData={editingTask}
        onSuccess={handleTaskSuccess}
      />

    </div>
  );
};
