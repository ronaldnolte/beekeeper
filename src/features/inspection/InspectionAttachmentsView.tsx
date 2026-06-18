import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Mic, Trash2, Hexagon, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SubTabBar } from '../../shared/components/SubTabBar';
import {
  fetchAttachments,
  uploadPhoto,
  deleteAttachment,
  type AttachmentWithUrls,
} from '../../data/inspectionAttachmentRepository';

/** Soft cap on photos per inspection (raise later if users push back). */
const PHOTO_CAP = 12;

export const InspectionAttachmentsView: React.FC = () => {
  const { selectedRecord, goBack } = useAppStore();
  const inspectionId = selectedRecord?.id as string | undefined;

  const [items, setItems] = useState<AttachmentWithUrls[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const feedEndRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const photoCount = items.filter((i) => i.kind === 'photo').length;
  const atCap = photoCount >= PHOTO_CAP;

  const load = React.useCallback(async () => {
    if (!inspectionId) return;
    try {
      setItems(await fetchAttachments(inspectionId));
    } catch (e: any) {
      setError(e.message ?? 'Could not load attachments.');
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Chat-style: keep the newest item in view as the feed grows.
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !inspectionId) return;
    setBusy(true);
    setError(null);
    try {
      // Upload sequentially so sort_order stays stable and we respect the cap.
      let nextOrder = items.length;
      for (const file of Array.from(files)) {
        if (photoCount + (nextOrder - items.length) >= PHOTO_CAP) break;
        await uploadPhoto(inspectionId, file, nextOrder);
        nextOrder += 1;
      }
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Upload failed — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: AttachmentWithUrls) => {
    if (!confirm('Delete this photo?')) return;
    setBusy(true);
    try {
      await deleteAttachment(item);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Could not delete that item.');
    } finally {
      setBusy(false);
    }
  };

  if (!inspectionId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
        <p className="font-bold text-[var(--color-text)] mb-2">No inspection selected</p>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Save the inspection first, then add photos and voice notes to it.
        </p>
        <button onClick={goBack} className="bg-[var(--color-primary)] text-white px-5 py-3 rounded-2xl font-bold">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Feed */}
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-3 sm:p-4 space-y-3">
        <div className="w-full max-w-2xl">
          <SubTabBar activeView="INSPECTION_FORM" />
        </div>

        <div className="w-full max-w-2xl flex items-center justify-between px-1">
          <h2 className="text-sm font-black uppercase tracking-wide text-[var(--color-text-muted)]">
            Photos &amp; Voice
          </h2>
          <span className="text-xs font-bold text-[var(--color-text-muted)]">
            {photoCount}/{PHOTO_CAP} photos
          </span>
        </div>

        {error && (
          <div className="w-full max-w-2xl bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center opacity-50 py-10">
            <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="w-full max-w-2xl text-center py-10 text-[var(--color-text-muted)]">
            <ImagePlus size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold">No attachments yet</p>
            <p className="text-sm">Use the buttons below to take or choose a photo.</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-3">
            {items
              .filter((i) => i.kind === 'photo')
              .map((item) => (
                <div key={item.id} className="card p-2.5 flex gap-3 items-center">
                  <button
                    onClick={() => item.fullUrl && setLightbox(item.fullUrl)}
                    className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-[var(--color-input-bg)]"
                  >
                    {item.thumbUrl ? (
                      <img src={item.thumbUrl} alt="inspection" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                        <ImagePlus size={20} />
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-text-muted)] font-medium">
                      {item.width && item.height ? `${item.width}×${item.height}` : 'Photo'}
                      {item.byte_size ? ` · ${Math.round(item.byte_size / 1024)} KB` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={busy}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center active:scale-95 disabled:opacity-50"
                    aria-label="Delete photo"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            <div ref={feedEndRef} />
          </div>
        )}
      </div>

      {/* Hidden file inputs — camera vs library */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Bottom action buttons */}
      <div className="w-full flex-shrink-0 flex justify-center gap-2.5 p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 dark:bg-black/55 dark:border-white/10 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          onClick={goBack}
          className="w-14 flex-shrink-0 bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] py-3.5 rounded-2xl font-bold flex items-center justify-center active:scale-95 dark:bg-black/30 dark:border-white/10 dark:text-white"
          aria-label="Back to inspection"
        >
          <Hexagon size={20} />
        </button>
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy || atCap}
          className="flex-1 max-w-[180px] bg-[var(--color-primary)] text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Camera size={20} /> Take
        </button>
        <button
          onClick={() => libraryInputRef.current?.click()}
          disabled={busy || atCap}
          className="flex-1 max-w-[180px] bg-[var(--color-primary)] text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <ImagePlus size={20} /> Choose
        </button>
        <button
          disabled
          title="Voice notes — coming next"
          className="w-14 flex-shrink-0 bg-[var(--color-input-bg)] text-[var(--color-text-muted)] py-3.5 rounded-2xl flex items-center justify-center opacity-50"
          aria-label="Record voice note (coming soon)"
        >
          <Mic size={20} />
        </button>
      </div>

      {busy && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-xl">
            <div className="w-5 h-5 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="font-bold text-sm text-[var(--color-text)]">Working…</span>
          </div>
        </div>
      )}

      {/* Full-res lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <img src={lightbox} alt="full size" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};
