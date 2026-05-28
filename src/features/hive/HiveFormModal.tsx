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
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      setConfirmDelete(false);
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
    
    if (!confirmDelete) {
      setConfirmDelete(true);
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
        <div className="bg-[var(--color-primary)] p-5 flex justify-between items-center text-white">
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
            <label className="block text-sm font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Hive Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hive 1, Queen Beatrice..."
              className="w-full p-4 bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 outline-none transition-all text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Location (Apiary)</label>
            <div className="relative">
              <select
                required
                value={selectedApiary}
                onChange={(e) => setSelectedApiary(e.target.value)}
                className="w-full p-4 bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 outline-none transition-all appearance-none text-lg"
              >
                <option value="" disabled>Select an Apiary...</option>
                {apiaries.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-[var(--color-text-muted)]">
                ▼
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Hive Type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setHiveType('Top Bar')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-black transition-all ${
                  hiveType === 'Top Bar' 
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]' 
                    : 'border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                Top Bar
              </button>
              <button
                type="button"
                onClick={() => setHiveType('Langstroth')}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-black transition-all ${
                  hiveType === 'Langstroth' 
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)]' 
                    : 'border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
                }`}
              >
                Langstroth
              </button>
            </div>
          </div>

          {/* Bar Count — only for Top Bar hives */}
          {hiveType === 'Top Bar' && (
            <div>
              <label className="block text-sm font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Number of Bars</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setBarCount(c => Math.max(1, c - 1))}
                  className="w-12 h-12 rounded-xl bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-90 transition-all"
                >
                  <Minus size={20} />
                </button>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={barCount}
                  onChange={(e) => setBarCount(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                  className="w-20 text-center p-3 bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] rounded-xl font-black text-[var(--color-text)] text-xl focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setBarCount(c => Math.min(60, c + 1))}
                  className="w-12 h-12 rounded-xl bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] active:scale-90 transition-all"
                >
                  <Plus size={20} />
                </button>
                <span className="text-sm font-bold text-[var(--color-text-muted)] ml-1">bars</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-black text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Installation Date</label>
            <input
              type="date"
              required
              value={installedOn}
              onChange={(e) => setInstalledOn(e.target.value)}
              className="w-full h-14 px-4 py-0 block bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] rounded-xl font-bold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 outline-none transition-all text-lg"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm font-bold border-2 border-red-500/20 flex items-center gap-2">
              <span className="text-xl">⚠️</span> {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col gap-3">
            <button
              type="submit"
              disabled={saving || deleting || !name.trim() || !selectedApiary}
              className="w-full bg-[var(--color-primary)] text-white py-4 rounded-xl font-black text-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/30"
            >
              {saving ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <><Save size={20} /> {editingHive ? 'Save Changes' : 'Create Hive'}</>
              )}
            </button>
            
            {editingHive && !confirmDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="w-full bg-red-500/10 text-red-400 py-4 rounded-xl font-black hover:bg-red-500/20 transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 border-2 border-red-500/20 hover:border-red-500/30"
              >
                {deleting ? (
                  <div className="w-6 h-6 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
                ) : (
                  <><Trash2 size={20} /> Delete Hive</>
                )}
              </button>
            )}

            {editingHive && confirmDelete && (
              <div className="bg-red-500/10 border-2 border-red-500/20 rounded-xl p-4 space-y-3">
                <p className="text-red-400 font-bold text-sm text-center">
                  ⚠️ Delete "{name}"? This will remove all inspections, tasks, and history. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-3 rounded-xl font-black text-[var(--color-text-muted)] bg-[var(--color-input-bg)] border-2 border-[var(--color-card-border)] hover:bg-[var(--color-card-bg)] transition-colors active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-xl font-black text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <><Trash2 size={16} /> Yes, Delete</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
