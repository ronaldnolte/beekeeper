import React, { useState, useEffect } from 'react';
import { fetchTasks as loadTasks, fetchTaskLocations, toggleTaskStatus as repoToggle } from '../../data/taskRepository';
import { useAppStore } from '../../store/useAppStore';
import { CheckCircle, Circle, Calendar, AlertTriangle, ChevronRight } from 'lucide-react';

type Task = any; // We'll use any if types are not strictly defined for now

interface TaskListProps {
  onEditTask: (task: Task) => void;
  refreshKey: number;
}

export const TaskList: React.FC<TaskListProps> = ({ onEditTask, refreshKey }) => {
  const { user } = useAppStore();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [taskLocations, setTaskLocations] = useState<Record<string, { apiaryName?: string, hiveName?: string }>>({});

  useEffect(() => {
    const fetchTasks = async () => {
      if (!user) return;
      setLoading(true);

      const tasksData = await loadTasks(user.id);
      setTasks(tasksData);

      // Fetch location names via repository
      const locations = await fetchTaskLocations(tasksData);
      setTaskLocations(locations);
      setLoading(false);
    };

    fetchTasks();
  }, [user, refreshKey]);

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t));

    try {
      await repoToggle(task.id, task.status);
    } catch (e) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status, completed_at: task.completed_at } : t));
    }
  };

  const visibleTasks = tasks.filter(t => showCompleted || t.status !== 'completed');

  if (loading) {
    return (
      <div className="w-full flex justify-center py-8">
        <div className="w-6 h-6 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center px-1 mb-2">
        <h3 className="text-lg font-bold text-[var(--color-text)]">My Upcoming Tasks</h3>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-medium cursor-pointer">
          <input 
            type="checkbox" 
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          Show Completed
        </label>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-muted)] bg-[var(--color-card-bg)]/50 rounded-xl border border-dashed border-[var(--color-card-border)]">
          <p className="font-medium text-sm">No tasks found. You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map(task => {
            const isCompleted = task.status === 'completed';
            const isHighPriority = task.priority === 'high';
            const dueDate = task.due_date ? new Date(task.due_date) : null;
            const isOverdue = dueDate && dueDate < new Date() && !isCompleted;

            // Location string
            let locationStr = 'General Task';
            const loc = taskLocations[task.id];
            if (loc?.hiveName) {
              locationStr = loc.apiaryName ? `${loc.apiaryName} / ${loc.hiveName}` : loc.hiveName;
            } else if (loc?.apiaryName) {
              locationStr = loc.apiaryName;
            }

            return (
              <div 
                key={task.id} 
                onClick={() => onEditTask(task)}
                className={`card p-3 flex gap-3 items-center cursor-pointer active:scale-[0.98] transition-transform ${isCompleted ? 'opacity-60' : ''}`}
              >
                {/* Checkbox */}
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                  className="flex-shrink-0 p-1 transition-colors"
                >
                  {isCompleted ? (
                    <CheckCircle className="text-green-500" size={24} />
                  ) : (
                    <Circle className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)]" size={24} />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`font-bold text-sm truncate pr-2 ${isCompleted ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
                      {task.title}
                    </h4>
                    {isHighPriority && !isCompleted && (
                      <span className="flex-shrink-0 bg-red-900/30 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                        <AlertTriangle size={10} /> High
                      </span>
                    )}
                  </div>
                  
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="truncate max-w-[50%] font-medium text-[var(--color-text-muted)]">
                      {locationStr}
                    </span>
                    {dueDate && (
                      <span className={`flex items-center gap-1 flex-shrink-0 ${isOverdue ? 'text-red-400 font-bold' : ''}`}>
                        <Calendar size={12} />
                        {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight size={18} className="text-[var(--color-text-muted)] flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
