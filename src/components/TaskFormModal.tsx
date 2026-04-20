import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
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

      const payload = {
        hive_id: isEditing ? initialData.hive_id : (defaultHiveId || null),
        apiary_id: isEditing ? initialData.apiary_id : (defaultApiaryId || null),
        assigned_user_id: user?.id,
        title,
        description,
        priority,
        due_date: parsedDueDate,
        status
      };

      if (isEditing) {
        // Add timeout to prevent silent hangs
        const updatePromise = supabase
          .from('tasks')
          .update(payload)
          .eq('id', initialData.id);
          
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Database update request timed out after 8 seconds.")), 8000)
        );

        const { error } = await Promise.race([updatePromise, timeoutPromise]) as any;
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([payload]);
        if (error) throw error;
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
      const { error } = await supabase.from('tasks').delete().eq('id', initialData.id);
      if (error) throw error;
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
        
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-100 bg-white">
          <h2 className="text-xl font-bold text-gray-800">
            {isEditing ? 'Edit Task' : 'New Task'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-50/50">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Task Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-800 placeholder-gray-400 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-all shadow-sm"
              placeholder="e.g. Order bee packages, check for mites..."
            />
          </div>

          {/* Status (If Editing) */}
          {isEditing && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setStatus('pending')}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors ${status === 'pending' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-gray-100 text-gray-400 shadow-sm'}`}
                >
                  Pending
                </button>
                <button 
                  onClick={() => setStatus('completed')}
                  className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors ${status === 'completed' ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-100 text-gray-400 shadow-sm'}`}
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
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors shadow-sm ${priority === 'low' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-transparent text-gray-500'}`}
              >
                Low
              </button>
              <button 
                onClick={() => setPriority('medium')}
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors shadow-sm ${priority === 'medium' ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-transparent text-gray-500'}`}
              >
                Medium
              </button>
              <button 
                onClick={() => setPriority('high')}
                className={`py-3 rounded-xl font-bold text-sm border-2 transition-colors shadow-sm flex items-center justify-center gap-1 ${priority === 'high' ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-transparent text-gray-500'}`}
              >
                <AlertTriangle size={16} /> High
              </button>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Due Date</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3.5 text-gray-400" size={20} />
              <input 
                type="date" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-3.5 pl-11 bg-white border border-gray-200 rounded-xl font-bold text-gray-800 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
            <textarea 
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-800 placeholder-gray-400 focus:border-[#E67E22] focus:ring-1 focus:ring-[#E67E22] transition-all shadow-sm resize-none"
              placeholder="Add any extra details..."
            />
          </div>

        </div>

        {errorMsg && (
          <div className="px-4 pb-2 sm:px-6">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border-2 border-red-100 flex items-center gap-2">
              <span className="text-xl">⚠️</span> {errorMsg}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-white flex justify-center gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {isEditing && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl font-black active:scale-95 transition-transform"
            >
              <Trash2 size={24} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 p-4 bg-[#E67E22] text-white rounded-2xl font-black text-lg shadow-lg shadow-[#E67E22]/20 active:scale-95 transition-transform disabled:opacity-70"
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
    </div>
  );
};
