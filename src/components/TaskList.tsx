import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
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

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        setLoading(false);
        return;
      }

      if (tasksData) {
        setTasks(tasksData);

        // Fetch location names separately to match legacy app logic and prevent FK join errors
        const locations: Record<string, { apiaryName?: string, hiveName?: string }> = {};
        
        const hiveIds = [...new Set(tasksData.map(t => t.hive_id).filter(Boolean))];
        const hiveToApiaryMap = new Map<string, string>();
        
        if (hiveIds.length > 0) {
          const { data: hives } = await supabase.from('hives').select('id, name, apiary_id').in('id', hiveIds);
          const hiveMap = new Map(hives?.map(h => [h.id, h.name]) || []);
          hives?.forEach(h => {
            if (h.apiary_id) hiveToApiaryMap.set(h.id, h.apiary_id);
          });
          
          tasksData.forEach(task => {
            if (task.hive_id) {
              if (!locations[task.id]) locations[task.id] = {};
              locations[task.id].hiveName = hiveMap.get(task.hive_id);
            }
          });
        }

        const apiaryIdsFromTasks = tasksData.map(t => t.apiary_id).filter(Boolean);
        const apiaryIdsFromHives = Array.from(hiveToApiaryMap.values());
        const apiaryIds = [...new Set([...apiaryIdsFromTasks, ...apiaryIdsFromHives])];

        if (apiaryIds.length > 0) {
          const { data: apiaries } = await supabase.from('apiaries').select('id, name').in('id', apiaryIds);
          const apiaryMap = new Map(apiaries?.map(a => [a.id, a.name]) || []);
          
          tasksData.forEach(task => {
            let apiaryId = task.apiary_id;
            if (!apiaryId && task.hive_id) apiaryId = hiveToApiaryMap.get(task.hive_id);
            
            if (apiaryId) {
              if (!locations[task.id]) locations[task.id] = {};
              locations[task.id].apiaryName = apiaryMap.get(apiaryId);
            }
          });
        }
        
        setTaskLocations(locations);
      }
      setLoading(false);
    };

    fetchTasks();
  }, [user, refreshKey]);

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t));

    await supabase
      .from('tasks')
      .update({ status: newStatus, completed_at: completedAt })
      .eq('id', task.id);
  };

  const visibleTasks = tasks.filter(t => showCompleted || t.status !== 'completed');

  if (loading) {
    return (
      <div className="w-full flex justify-center py-8">
        <div className="w-6 h-6 border-4 border-[#E67E22] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center px-1 mb-2">
        <h3 className="text-lg font-bold text-[var(--color-text)]">My Upcoming Tasks</h3>
        <label className="flex items-center gap-2 text-xs text-gray-500 font-medium cursor-pointer">
          <input 
            type="checkbox" 
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded text-[#E67E22] focus:ring-[#E67E22]"
          />
          Show Completed
        </label>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 bg-white/50 rounded-xl border border-dashed border-[#E6DCC3]">
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
                className={`card p-3 flex gap-3 items-center cursor-pointer active:scale-[0.98] transition-transform ${isCompleted ? 'opacity-60 bg-gray-50' : 'bg-white'}`}
              >
                {/* Checkbox */}
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                  className="flex-shrink-0 p-1 transition-colors"
                >
                  {isCompleted ? (
                    <CheckCircle className="text-green-500" size={24} />
                  ) : (
                    <Circle className="text-gray-300 hover:text-[#E67E22]" size={24} />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`font-bold text-sm truncate pr-2 ${isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                      {task.title}
                    </h4>
                    {isHighPriority && !isCompleted && (
                      <span className="flex-shrink-0 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                        <AlertTriangle size={10} /> High
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="truncate max-w-[50%] font-medium text-gray-600">
                      {locationStr}
                    </span>
                    {dueDate && (
                      <span className={`flex items-center gap-1 flex-shrink-0 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                        <Calendar size={12} />
                        {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
