import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { Save, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { HistoryFeed } from '../components/HistoryFeed';

export const TaskFormView: React.FC = () => {
  const { selectedHiveId, selectedApiaryId, selectedInspection, setCurrentView, user } = useAppStore();
  const [loading, setLoading] = useState(false);

  // Initialize from selectedInspection (which acts as a generic "selected item" for the forms)
  const isEditing = !!selectedInspection && selectedInspection._model_type === 'task';

  const [title, setTitle] = useState<string>(isEditing ? selectedInspection.title : '');
  const [description, setDescription] = useState(isEditing ? selectedInspection.description || '' : '');
  const [priority, setPriority] = useState<string>(isEditing ? selectedInspection.priority : 'medium');
  const [dueDate, setDueDate] = useState(() => {
    if (isEditing && selectedInspection.due_date) {
      return new Date(selectedInspection.due_date).toISOString().split('T')[0];
    }
    // Default to 1 week from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<string>(isEditing ? selectedInspection.status : 'pending');
  const [isFormOpen, setIsFormOpen] = useState(isEditing);

  React.useEffect(() => {
    if (selectedInspection && selectedInspection._model_type === 'task') {
      setIsFormOpen(true);
      setTitle(selectedInspection.title || '');
      setDescription(selectedInspection.description || '');
      setPriority(selectedInspection.priority || 'medium');
      setStatus(selectedInspection.status || 'pending');
      if (selectedInspection.due_date) {
        setDueDate(new Date(selectedInspection.due_date).toISOString().split('T')[0]);
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
  }, [selectedInspection]);

  const handleSave = async () => {
    if (!selectedHiveId) return;
    if (!title.trim()) {
      alert("Please enter a task title");
      return;
    }
    
    setLoading(true);

    try {
      const payload = {
        hive_id: selectedHiveId,
        apiary_id: selectedApiaryId,
        assigned_user_id: user?.id,
        title,
        description,
        priority,
        due_date: new Date(dueDate).toISOString(),
        status
      };

      if (isEditing) {
        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', selectedInspection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([payload]);
        if (error) throw error;
      }

      if (typeof window !== 'undefined') {
        window.history.pushState({ view: 'HIVE_DETAIL' }, '');
      }
      setCurrentView('HIVE_DETAIL');

    } catch (error: any) {
      alert('Error saving task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedInspection || !confirm('Are you sure you want to delete this task?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', selectedInspection.id);
      if (error) throw error;

      if (typeof window !== 'undefined') {
        window.history.pushState({ view: 'HIVE_DETAIL' }, '');
      }
      setCurrentView('HIVE_DETAIL');
    } catch (error: any) {
      alert('Error deleting task: ' + error.message);
      setLoading(false);
    }
  };

  if (!isFormOpen) {
    return (
      <div className="w-full flex flex-col items-center p-4 pb-24 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-full max-w-2xl mb-4">
          <button
            onClick={() => setIsFormOpen(true)}
            className="w-full bg-[#E67E22] text-white py-4 rounded-2xl font-black text-xl hover:bg-[#D35400] transition-colors shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            + Add Task
          </button>
        </div>

        <div className="w-full max-w-2xl">
          <HistoryFeed hiveId={selectedHiveId!} filter="tasks" />
        </div>

      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center p-3 sm:p-4 pb-24 space-y-4 animate-in slide-in-from-bottom-4">
      <div className="w-full max-w-2xl card p-4 sm:p-5 space-y-5">
        
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Task Title</label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 placeholder-gray-400 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-colors"
            placeholder="e.g. Add super, check for mites..."
          />
        </div>

        {/* Status (If Editing) */}
        {isEditing && (
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setStatus('pending')}
                className={`py-3 rounded-lg font-bold text-sm border-2 transition-colors ${status === 'pending' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
              >
                Pending
              </button>
              <button 
                onClick={() => setStatus('completed')}
                className={`py-3 rounded-lg font-bold text-sm border-2 transition-colors ${status === 'completed' ? 'bg-green-50 border-green-400 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}
              >
                Completed
              </button>
            </div>
          </div>
        )}

        {/* Priority */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Priority</label>
          <div className="grid grid-cols-3 gap-2">
            <button 
              onClick={() => setPriority('low')}
              className={`py-3 rounded-lg font-bold text-sm border-2 transition-colors ${priority === 'low' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-gray-50 border-transparent text-gray-500'}`}
            >
              Low
            </button>
            <button 
              onClick={() => setPriority('medium')}
              className={`py-3 rounded-lg font-bold text-sm border-2 transition-colors ${priority === 'medium' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-gray-50 border-transparent text-gray-500'}`}
            >
              Medium
            </button>
            <button 
              onClick={() => setPriority('high')}
              className={`py-3 rounded-lg font-bold text-sm border-2 transition-colors flex items-center justify-center gap-1 ${priority === 'high' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-gray-50 border-transparent text-gray-500'}`}
            >
              <AlertTriangle size={16} /> High
            </button>
          </div>
        </div>

        {/* Due Date */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Due Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
              type="date" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-colors"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
          <textarea 
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 placeholder-gray-400 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-colors"
            placeholder="Add any extra details..."
          />
        </div>

      </div>

      <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[var(--color-bg)] to-[var(--color-bg)]/80 backdrop-blur-sm z-50 flex justify-center gap-3">
        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="p-4 bg-red-100 text-red-600 rounded-2xl font-black shadow-lg active:scale-95 transition-transform"
          >
            <Trash2 size={24} />
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 max-w-sm flex items-center justify-center gap-2 p-4 bg-[#E67E22] text-white rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-70"
        >
          {loading ? (
             <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <Save size={24} />
              {isEditing ? 'Update Task' : 'Save Task'}
            </>
          )}
        </button>
      </div>

    </div>
  );
};
