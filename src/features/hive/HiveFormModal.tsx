import React, { useState, useEffect } from 'react';
import { createHive, updateHive, deleteHive, fetchApiariesForDropdown } from '../../data/hiveRepository';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2, X, Box, Minus, Plus } from 'lucide-react';

export const HiveFormModal: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { user, isHiveFormOpen, editingHive, setHiveFormOpen, selectedApiaryId } = useAppStore();
  
  // Form State
  const [name, setName] = useState('');
  const [hiveType, setHiveType] = useState('Top Bar');
  const [barCount, setBarCount] = useState(30);
  const [installedOn, setInstalledOn] = useState(new Date().toISOString().split('T')[0]);
  
  // Apiary Select State
  const [apiaries, setApiaries] = useState<{ id: string, name: string }[]>([]);
  const [selectedApiary, setSelectedApiary] = useState(selectedApiaryId || '');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user's apiaries for the dropdown so they can move a hive
    const fetchApiaries = async () => {
      if (!user) return;
      const data = await fetchApiariesForDropdown(user.id);
      setApiaries(data);
    };
    fetchApiaries();
  }, [user]);

  useEffect(() => {
    if (isHiveFormOpen) {
      if (editingHive) {
        setName(editingHive.title || '');
        // "Top Bar" or "Langstroth" comes from subtitle or statusBadge in SelectionItem
        // If it's not explicit, default to Top Bar
        const isLang = editingHive.subtitle?.toLowerCase().includes('langstroth') || editingHive.statusBadge?.text.toLowerCase().includes('langstroth');
        setHiveType(isLang ? 'Langstroth' : 'Top Bar');
        
        // We might not have the raw database object in editingHive, just the SelectionItem.
        // If we want exact dates and apiary ID, we might have to fetch or pass the raw object.
        // For simplicity, default to current selected apiary and today if we don't have it.
        setSelectedApiary(editingHive.raw?.apiary_id || selectedApiaryId || '');
        setInstalledOn(editingHive.raw?.installed_on || new Date().toISOString().split('T')[0]);
        // Load existing bar count if available
        const existingBars = editingHive.raw?.bars;
        setBarCount(Array.isArray(existingBars) ? existingBars.length : 30);
      } else {
        setName('');
        setHiveType('Top Bar');
        setBarCount(30);
        setSelectedApiary(selectedApiaryId || '');
        setInstalledOn(new Date().toISOString().split('T')[0]);
      }
      setError(null);
    }
  }, [isHiveFormOpen, editingHive, selectedApiaryId]);

  if (!isHiveFormOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedApiary) return;
    setSaving(true);
    setError(null);

    try {
      const hiveData: any = {
        name: name.trim(),
        apiary_id: selectedApiary,
        type: hiveType
      };

      // For Top Bar hives, generate the initial bars array
      if (hiveType === 'Top Bar' && !editingHive) {
        hiveData.bars = Array.from({ length: barCount }, (_, i) => ({
          position: i + 1,
          status: 'inactive'
        }));
      }

      if (editingHive?.id) {
        await updateHive(editingHive.id, hiveData);
      } else {
        await createHive(hiveData);
      }

      setHiveFormOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save hive');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingHive?.id) return;
    
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone and will delete all history!`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    
    try {
      await deleteHive(editingHive.id);

      setHiveFormOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete hive');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--color-bg)] w-full max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300 max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#E67E22] p-5 flex justify-between items-center text-white">
          <h3 className="font-black text-xl flex items-center gap-2">
            <Box size={24} /> 
            {editingHive ? 'Edit Hive' : 'Create New Hive'}
          </h3>
          <button
            onClick={() => setHiveFormOpen(false)}
            className="hover:bg-black/10 rounded-full p-2 transition-colors active:scale-95"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
          
          <div>
            <label className="block text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Hive Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hive 1, Queen Beatrice..."
              className="w-full p-4 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 placeholder-gray-300 focus:border-[#E67E22] focus:ring-4 focus:ring-[#E67E22]/20 outline-none transition-all text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Location (Apiary)</label>
            <div className="relative">
              <select
                required
                value={selectedApiary}
                onChange={(e) => setSelectedApiary(e.target.value)}
                className="w-full p-4 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 focus:border-[#E67E22] focus:ring-4 focus:ring-[#E67E22]/20 outline-none transition-all appearance-none text-lg"
              >
                <option value="" disabled>Select an Apiary...</option>
                {apiaries.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                ▼
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Hive Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHiveType('Top Bar')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-black transition-all ${
                  hiveType === 'Top Bar' 
                    ? 'border-[#E67E22] bg-[#FFFBF0] text-[#E67E22]' 
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                Top Bar
              </button>
              <button
                type="button"
                onClick={() => setHiveType('Langstroth')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-black transition-all ${
                  hiveType === 'Langstroth' 
                    ? 'border-[#E67E22] bg-[#FFFBF0] text-[#E67E22]' 
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                Langstroth
              </button>
            </div>
          </div>

          {/* Bar Count — only for Top Bar hives */}
          {hiveType === 'Top Bar' && (
            <div>
              <label className="block text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Number of Bars</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBarCount(c => Math.max(1, c - 1))}
                  className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#E67E22] hover:text-[#E67E22] active:scale-90 transition-all"
                >
                  <Minus size={20} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={barCount}
                  onChange={(e) => setBarCount(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center p-3 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-black text-gray-900 text-xl focus:border-[#E67E22] focus:ring-4 focus:ring-[#E67E22]/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setBarCount(c => Math.min(60, c + 1))}
                  className="w-12 h-12 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center text-gray-500 hover:border-[#E67E22] hover:text-[#E67E22] active:scale-90 transition-all"
                >
                  <Plus size={20} />
                </button>
                <span className="text-sm font-bold text-gray-400 ml-1">bars</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Installation Date</label>
            <input
              type="date"
              required
              value={installedOn}
              onChange={(e) => setInstalledOn(e.target.value)}
              className="w-full p-4 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 focus:border-[#E67E22] focus:ring-4 focus:ring-[#E67E22]/20 outline-none transition-all text-lg"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border-2 border-red-100 flex items-center gap-2">
              <span className="text-xl">⚠️</span> {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col gap-3">
            <button
              type="submit"
              disabled={saving || deleting || !name.trim() || !selectedApiary}
              className="w-full bg-[#E67E22] text-white py-4 rounded-xl font-black text-lg hover:bg-[#D35400] transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#E67E22]/30"
            >
              {saving ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <><Save size={20} /> {editingHive ? 'Save Changes' : 'Create Hive'}</>
              )}
            </button>
            
            {editingHive && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="w-full bg-red-50 text-red-600 py-4 rounded-xl font-black hover:bg-red-100 transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 border-2 border-transparent hover:border-red-200"
              >
                {deleting ? (
                  <div className="w-6 h-6 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
                ) : (
                  <><Trash2 size={20} /> Delete Hive</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
