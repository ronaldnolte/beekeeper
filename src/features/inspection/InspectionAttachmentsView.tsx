import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Mic, Trash2, ChevronLeft, X, Loader2, MessageSquarePlus, Pencil, Check, Download } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SubTabBar } from '../../shared/components/SubTabBar';
import { RecordOverlay } from './RecordOverlay';
import {
  fetchAttachments,
  uploadPhoto,
  uploadVoiceNote,
  requestTranscription,
  updateTranscript,
  deleteAttachment,
  type AttachmentWithUrls,
} from '../../data/inspectionAttachmentRepository';
import { exportSinglePhoto } from './exportPhotos';

/** Soft cap on photos per inspection (raise later if users push back). */
const PHOTO_CAP = 12;

/**
 * Whether an <input capture> will actually open a camera. True on phones/tablets;
 * false on desktop, where browsers ignore `capture` and just show a file picker
 * (even with a webcam). Used to gray out "Take" on PCs.
 */
const CAN_CAPTURE =
  typeof navigator !== 'undefined' &&
  (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches));

type RecordTarget = { kind: 'standalone' } | { kind: 'caption'; parentId: string } | null;

export const InspectionAttachmentsView: React.FC = () => {
  const { selectedRecord, setCurrentView, selectedHiveName } = useAppStore();
  const goBackToForm = () => setCurrentView('INSPECTION_FORM');
  const inspectionId = selectedRecord?.id as string | undefined;

  const [items, setItems] = useState<AttachmentWithUrls[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [recordTarget, setRecordTarget] = useState<RecordTarget>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

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

  const handleVoiceDone = async (audio: Blob) => {
    const target = recordTarget;
    setRecordTarget(null);
    if (!inspectionId || !target) return;
    setBusy(true);
    setError(null);
    try {
      const created = await uploadVoiceNote(inspectionId, audio, {
        parentId: target.kind === 'caption' ? target.parentId : undefined,
        sortOrder: items.length,
      });
      await load();
      // Transcribe in the background; the feed shows "converting…" until done.
      requestTranscription(created.id, audio, created.audio_path)
        .then(() => load())
        .catch((e) => {
          console.warn('Transcription failed:', e?.message);
          load();
        });
    } catch (e: any) {
      setError(e.message ?? 'Could not save that voice note.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (v: AttachmentWithUrls) => {
    setEditingId(v.id);
    setEditText(v.transcript ?? '');
  };

  const saveEdit = async (id: string) => {
    setBusy(true);
    try {
      await updateTranscript(id, editText.trim(), 'done');
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Could not save the text.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: AttachmentWithUrls, label: string) => {
    if (!confirm(`Delete this ${label}?`)) return;
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

  const handleSavePhoto = async (url: string) => {
    setSavingPhoto(true);
    setError(null);
    try {
      const hivePart = (selectedHiveName ?? 'hive').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const datePart = selectedRecord?.timestamp
        ? new Date(selectedRecord.timestamp).toISOString().split('T')[0]
        : 'photo';
      await exportSinglePhoto(url, `photo-${hivePart}-${datePart}.jpg`);
    } catch (e: any) {
      setError(e?.message ?? 'Could not save that photo.');
    } finally {
      setSavingPhoto(false);
    }
  };

  if (!inspectionId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
        <p className="font-bold text-[var(--color-text)] mb-2">No inspection selected</p>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          Start a Plus inspection first, then add photos and voice notes to it.
        </p>
        <button onClick={goBackToForm} className="bg-[var(--color-primary)] text-white px-5 py-3 rounded-2xl font-bold">
          Back
        </button>
      </div>
    );
  }

  // Top-level feed = photos + standalone notes (already ordered); captions nest under photos.
  const topLevel = items.filter((i) => i.kind === 'photo' || !i.parent_id);
  const captionFor = (photoId: string) =>
    items.find((i) => i.kind === 'voice_note' && i.parent_id === photoId);

  const renderVoiceBody = (v: AttachmentWithUrls) => {
    const isEditing = editingId === v.id;
    const canEdit = v.transcript_status === 'done' || v.transcript_status === 'failed';
    return (
      <>
        {v.audioUrl && <audio controls src={v.audioUrl} className="w-full h-9 mt-1" />}

        {v.transcript_status === 'pending' && (
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Converting voice to text…
          </p>
        )}

        {isEditing ? (
          <div className="mt-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              autoFocus
              className="w-full p-2.5 rounded-xl bg-[var(--color-input-bg)] border border-[var(--color-primary)] text-sm text-[var(--color-text)] outline-none resize-none"
              placeholder="Type the correct text…"
            />
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => saveEdit(v.id)}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-[var(--color-primary)] px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-50"
              >
                <Check size={14} /> Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-input-bg)] px-3 py-1.5 rounded-lg active:scale-95"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          canEdit && (
            <div className="mt-1.5 flex items-start justify-between gap-2">
              {v.transcript ? (
                <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap flex-1">{v.transcript}</p>
              ) : (
                <p className="text-xs italic text-[var(--color-text-muted)] flex-1">
                  {v.transcript_status === 'failed'
                    ? 'Couldn’t transcribe — play the audio, or type the text.'
                    : 'No speech detected — tap edit to type the text.'}
                </p>
              )}
              <button
                onClick={() => startEdit(v)}
                className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary)] active:scale-95"
                aria-label="Edit text"
              >
                <Pencil size={14} /> Edit
              </button>
            </div>
          )
        )}
      </>
    );
  };

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
            <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
          </div>
        ) : topLevel.length === 0 ? (
          <div className="w-full max-w-2xl text-center py-10 text-[var(--color-text-muted)]">
            <ImagePlus size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-bold">No attachments yet</p>
            <p className="text-sm">Take a photo, choose one, or record a voice note below.</p>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-3">
            {topLevel.map((item) => {
              if (item.kind === 'photo') {
                const caption = captionFor(item.id);
                return (
                  <div key={item.id} className="card p-2.5">
                    <div className="flex gap-3 items-center">
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
                        {!caption && (
                          <button
                            onClick={() => setRecordTarget({ kind: 'caption', parentId: item.id })}
                            disabled={busy}
                            className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] disabled:opacity-50"
                          >
                            <MessageSquarePlus size={15} /> Add caption
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item, 'photo')}
                        disabled={busy}
                        className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center active:scale-95 disabled:opacity-50"
                        aria-label="Delete photo"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {caption && (
                      <div className="mt-2 pl-3 border-l-2 border-[var(--color-primary)]/30">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-primary)] flex items-center gap-1">
                              <Mic size={12} /> Caption
                            </p>
                            {renderVoiceBody(caption)}
                          </div>
                          <button
                            onClick={() => handleDelete(caption, 'caption')}
                            disabled={busy}
                            className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center active:scale-95 disabled:opacity-50"
                            aria-label="Delete caption"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // Standalone voice note
              return (
                <div key={item.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-primary)] flex items-center gap-1">
                        <Mic size={12} /> Voice note
                      </p>
                      {renderVoiceBody(item)}
                    </div>
                    <button
                      onClick={() => handleDelete(item, 'voice note')}
                      disabled={busy}
                      className="flex-shrink-0 w-9 h-9 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center active:scale-95 disabled:opacity-50"
                      aria-label="Delete voice note"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
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
          onClick={goBackToForm}
          className="flex-shrink-0 bg-white/60 backdrop-blur-sm border border-white/50 text-[var(--color-text)] px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2 active:scale-95 dark:bg-black/30 dark:border-white/10 dark:text-white"
          aria-label="Back to inspection"
        >
          <ChevronLeft size={16} />
          Back to Form
        </button>
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy || atCap || !CAN_CAPTURE}
          title={CAN_CAPTURE ? undefined : 'Camera capture works on phones and tablets'}
          className="flex-1 bg-[var(--color-primary)] text-white py-3.5 rounded-2xl font-black text-sm flex flex-col items-center justify-center gap-0.5 active:scale-95 disabled:opacity-50"
        >
          <span className="flex items-center gap-1.5">
            <Camera size={19} /> Take
          </span>
          {!CAN_CAPTURE && <span className="text-[9px] font-bold leading-none">Mobile Only</span>}
        </button>
        <button
          onClick={() => libraryInputRef.current?.click()}
          disabled={busy || atCap}
          className="flex-1 bg-[var(--color-primary)] text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <ImagePlus size={19} /> Choose
        </button>
        <button
          onClick={() => setRecordTarget({ kind: 'standalone' })}
          disabled={busy}
          className="flex-1 bg-[var(--color-primary)] text-white py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
        >
          <Mic size={19} /> Voice
        </button>
      </div>

      {busy && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-20">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-xl">
            <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
            <span className="font-bold text-sm text-[var(--color-text)]">Working…</span>
          </div>
        </div>
      )}

      {recordTarget && (
        <RecordOverlay
          title={recordTarget.kind === 'caption' ? 'Record caption' : 'Record voice note'}
          onCancel={() => setRecordTarget(null)}
          onDone={handleVoiceDone}
        />
      )}

      {/* Full-res lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <img src={lightbox} alt="full size" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSavePhoto(lightbox);
            }}
            disabled={savingPhoto}
            className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-white/15 text-white px-5 py-3 rounded-full font-bold text-sm flex items-center gap-2 active:scale-95 disabled:opacity-60 backdrop-blur-sm"
          >
            {savingPhoto ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Save photo
          </button>
        </div>
      )}
    </div>
  );
};
