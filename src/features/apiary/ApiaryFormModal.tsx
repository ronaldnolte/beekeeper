import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Save, Trash2, X, MapPin } from 'lucide-react';
import { createApiary, updateApiary, deleteApiaryWithCascade } from '../../data/apiaryRepository';

export const ApiaryFormModal: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { user, isApiaryFormOpen, editingApiary, setApiaryFormOpen } = useAppStore();
  const [name, setName] = useState('');
  const [locationMode, setLocationMode] = useState<'zip' | 'coords'>('zip');
  const [zipCode, setZipCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isApiaryFormOpen) {
      if (editingApiary) {
        const raw = editingApiary.raw || {};
        setName(editingApiary.title || '');
        setZipCode(raw.zip_code || '');
        setLatitude(raw.latitude ? String(raw.latitude) : '');
        setLongitude(raw.longitude ? String(raw.longitude) : '');
        setNotes(raw.notes || '');
        
        if (raw.latitude && raw.longitude && !raw.zip_code) {
            setLocationMode('coords');
        } else {
            setLocationMode('zip');
        }
      } else {
        setName('');
        setZipCode('');
        setLatitude('');
        setLongitude('');
        setNotes('');
        setLocationMode('zip');
      }
      setError(null);
    }
  }, [isApiaryFormOpen, editingApiary]);

  if (!isApiaryFormOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const apiaryData = {
        name: name.trim(),
        zip_code: locationMode === 'zip' ? zipCode.trim() : '',
        latitude: locationMode === 'coords' && latitude ? parseFloat(latitude) : null,
        longitude: locationMode === 'coords' && longitude ? parseFloat(longitude) : null,
        notes: notes.trim(),
        user_id: user.id
      };

      if (editingApiary?.id) {
        await updateApiary(editingApiary.id, user.id, apiaryData);
      } else {
        await createApiary(apiaryData);
      }

      setApiaryFormOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save apiary');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingApiary?.id) return;
    
    // Quick confirmation
    if (!window.confirm(`Are you sure you want to delete "${name}"? This will delete all hives inside it!`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    
    try {
      // Use the shared deletion utility to handle all cascading deletes and RLS checks
      await deleteApiaryWithCascade(editingApiary.id, user.id);

      setApiaryFormOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete apiary');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--color-bg)] w-full max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="bg-[#E67E22] p-5 flex justify-between items-center text-white">
          <h3 className="font-black text-xl flex items-center gap-2">
            <MapPin size={24} /> 
            {editingApiary ? 'Edit Apiary' : 'Create New Apiary'}
          </h3>
          <button
            onClick={() => setApiaryFormOpen(false)}
            className="hover:bg-black/10 rounded-full p-2 transition-colors active:scale-95"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Apiary Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home Yard, South Farm..."
              className="w-full p-4 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 placeholder-gray-300 focus:border-[#E67E22] focus:ring-4 focus:ring-[#E67E22]/20 outline-none transition-all text-lg"
            />
          </div>

          {/* Location Section */}
          <div className="space-y-3">
            <label className="block text-sm font-black text-gray-400 uppercase tracking-wider">Location <span className="text-gray-300 normal-case font-medium">(for weather)</span></label>
            
            <div className="flex w-full bg-gray-50 border border-gray-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLocationMode('zip')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  locationMode === 'zip' ? 'bg-white text-[#E67E22] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Postal Code
              </button>
              <button
                type="button"
                onClick={() => setLocationMode('coords')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  locationMode === 'coords' ? 'bg-white text-[#E67E22] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Coordinates
              </button>
            </div>

            {locationMode === 'zip' ? (
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 12345"
                className="w-full p-4 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 placeholder-gray-300 focus:border-[#E67E22] focus:ring-4 focus:ring-[#E67E22]/20 outline-none transition-all text-lg"
              />
            ) : (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="35.0385"
                    className="w-full p-3 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 placeholder-gray-300 focus:border-[#E67E22] outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="-106.7065"
                    className="w-full p-3 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 placeholder-gray-300 focus:border-[#E67E22] outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-black text-gray-400 uppercase tracking-wider mb-2">Notes <span className="text-gray-300 normal-case font-medium">(optional)</span></label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. South Valley, Albuquerque NM"
              className="w-full p-4 bg-white border-2 border-[var(--color-card-border)] rounded-xl font-bold text-gray-900 placeholder-gray-300 focus:border-[#E67E22] focus:ring-4 focus:ring-[#E67E22]/20 outline-none transition-all text-sm resize-none custom-scrollbar"
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
              disabled={saving || deleting || !name.trim()}
              className="w-full bg-[#E67E22] text-white py-4 rounded-xl font-black text-lg hover:bg-[#D35400] transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-[#E67E22]/30"
            >
              {saving ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <><Save size={20} /> {editingApiary ? 'Save Changes' : 'Create Apiary'}</>
              )}
            </button>
            
            {editingApiary && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="w-full bg-red-50 text-red-600 py-4 rounded-xl font-black hover:bg-red-100 transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2 border-2 border-transparent hover:border-red-200"
              >
                {deleting ? (
                  <div className="w-6 h-6 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin"></div>
                ) : (
                  <><Trash2 size={20} /> Delete Apiary</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
