// Photos & Voice — SPEC B §15 (screenshot B30).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, Download, ImagePlus, Mic, Trash2, X } from 'lucide-react';
import { useApp } from '../../app/store';
import { Overlay } from '../../components/Overlay';
import { Spinner } from '../../components/Chrome';
import { PHOTO_CAP, deleteAttachment, listAttachments, saveVoiceNote, setTranscript, signedUrls, uploadPhoto, type Attachment } from '../../lib/attachments';
import { ImageError, preparePhoto } from '../../lib/imagePipeline';
import { saveSinglePhoto } from '../../lib/exportFiles';
import { BottomBar, RecordTabs } from './RecordParts';
import { VoiceRecorder } from './VoiceRecorder';

const canCapture = () =>
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches);

function VoiceBody({ a, urls, onChanged }: { a: Attachment; urls: Record<string, string>; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(a.transcript ?? '');
  const settled = a.transcript_status === 'done' || a.transcript_status === 'failed';
  return (
    <div className="mt-2 space-y-2">
      {a.audio_path && urls[a.audio_path] && <audio controls src={urls[a.audio_path]} className="w-full h-10" />}
      {a.transcript_status === 'pending' && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Spinner className="w-4 h-4" /> Converting voice to text…
        </p>
      )}
      {settled &&
        (editing ? (
          <div className="space-y-2">
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Type the correct text…" rows={3} className="w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-primary-ring" />
            <div className="flex gap-2">
              <button type="button" onClick={() => void setTranscript(a.id, text).then(() => (setEditing(false), onChanged()))} className="h-9 px-3 rounded-xl bg-primary text-white text-sm font-bold">
                ✓ Save
              </button>
              <button type="button" onClick={() => (setText(a.transcript ?? ''), setEditing(false))} className="h-9 px-3 rounded-xl bg-white text-sm font-bold">
                ✕ Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm text-text whitespace-pre-wrap">
              {a.transcript?.trim() ? (
                a.transcript
              ) : (
                <em className="text-text-muted">{a.transcript_status === 'failed' ? 'Couldn’t transcribe — play the audio, or type the text.' : 'No speech detected — tap edit to type the text.'}</em>
              )}
            </p>
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-sm font-bold text-primary-ink">
              ✏️ Edit
            </button>
          </div>
        ))}
    </div>
  );
}

export default function PhotosVoiceScreen() {
  const { state, navigate } = useApp();
  const inspection = state.selectedRecord;
  const userId = state.user!.id;
  const [items, setItems] = useState<Attachment[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorder, setRecorder] = useState<{ parent: Attachment | null } | null>(null);
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const takeInput = useRef<HTMLInputElement>(null);
  const chooseInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const capture = canCapture();

  const reload = useCallback(async () => {
    if (!inspection) return;
    try {
      const list = await listAttachments(inspection.id);
      setItems(list);
      setUrls(await signedUrls(list.flatMap(a => [a.thumb_path, a.storage_path, a.audio_path].filter((p): p is string => !!p))));
    } catch {
      setError('Could not load attachments.');
    }
  }, [inspection]);

  useEffect(() => {
    void reload();
  }, [reload]);
  // Poll while a transcript is pending.
  useEffect(() => {
    if (!items?.some(a => a.transcript_status === 'pending')) return;
    const t = setTimeout(() => void reload(), 3000);
    return () => clearTimeout(t);
  }, [items, reload]);
  // Scroll to the newest item whenever the count changes.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [items?.length]);

  if (!inspection) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-2">
        <RecordTabs active="INSPECTION_PLUS" />
        <div className="card p-8 text-center">
          <h2 className="text-lg font-black">No inspection selected</h2>
          <p className="mt-2 text-text-muted">Start a Plus inspection first, then add photos and voice notes to it.</p>
          <button type="button" onClick={() => navigate('INSPECTION_FORM')} className="mt-5 h-11 px-6 rounded-2xl bg-primary text-white font-black">
            Back
          </button>
        </div>
      </div>
    );
  }

  const photos = (items ?? []).filter(a => a.kind === 'photo');
  const atCap = photos.length >= PHOTO_CAP;
  const topLevel = (items ?? []).filter(a => !a.parent_id);
  const captionOf = (photo: Attachment) => (items ?? []).find(a => a.parent_id === photo.id);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      let count = photos.length;
      let order = items?.length ?? 0;
      for (const file of Array.from(files)) {
        if (count >= PHOTO_CAP) break; // stops silently at the cap
        const p = await preparePhoto(file);
        await uploadPhoto({ userId, inspectionId: inspection.id, sortOrder: order++, ...p });
        count++;
      }
    } catch (err) {
      setError(err instanceof ImageError ? err.message : (err as Error).message || 'Upload failed — check your connection and try again.');
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const remove = async (a: Attachment, noun: string) => {
    if (!window.confirm(`Delete this ${noun}?`)) return;
    setBusy(true);
    try {
      await deleteAttachment(a);
    } finally {
      setBusy(false);
      await reload();
    }
  };

  const useClip = async (clip: Blob) => {
    const parent = recorder?.parent ?? null;
    setRecorder(null);
    setBusy(true);
    setError(null);
    try {
      await saveVoiceNote({ userId, inspectionId: inspection.id, sortOrder: items?.length ?? 0, parentId: parent?.id ?? null, clip, onDone: () => void reload() });
    } catch {
      setError('Could not save that voice note.');
    } finally {
      setBusy(false);
      await reload();
    }
  };

  // Four buttons share the width so none is pushed off a phone screen.
  const bar = 'h-12 min-w-0 rounded-2xl bg-primary text-white text-[15px] font-black flex items-center justify-center gap-1 px-1.5 whitespace-nowrap disabled:opacity-50';

  return (
    <div className="max-w-2xl mx-auto px-2.5 pt-2 pb-36">
      <RecordTabs active="INSPECTION_PLUS" />
      <div className="flex items-center justify-between px-1 mb-4">
        <h2 className="text-lg font-black uppercase tracking-wide text-text-muted">Photos &amp; Voice</h2>
        <span className="text-sm font-bold text-text-muted">
          {photos.length}/{PHOTO_CAP} photos
        </span>
      </div>

      {error && <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : topLevel.length === 0 ? (
        <div className="py-12 text-center text-text-muted">
          <ImagePlus size={56} className="mx-auto opacity-40" />
          <p className="mt-4 text-lg font-black">No attachments yet</p>
          <p className="mt-1">Take a photo, choose one, or record a voice note below.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topLevel.map(a => {
            if (a.kind === 'photo') {
              const cap = captionOf(a);
              return (
                <div key={a.id} className="card p-3">
                  <div className="flex gap-3 items-start">
                    <button type="button" onClick={() => setLightbox(a)} className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-divider" aria-label="Open photo">
                      {a.thumb_path && urls[a.thumb_path] && <img src={urls[a.thumb_path]} alt="" className="w-full h-full object-cover" />}
                    </button>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-text-muted">{a.width && a.height ? `${a.width}×${a.height} · ${Math.round((a.byte_size ?? 0) / 1024)} KB` : 'Photo'}</p>
                      {!cap && (
                        <button type="button" onClick={() => setRecorder({ parent: a })} className="mt-2 text-sm font-bold text-primary-ink">
                          💬 Add caption
                        </button>
                      )}
                    </div>
                    <button type="button" aria-label="Delete photo" onClick={() => void remove(a, 'photo')} className="p-2 text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {cap && (
                    <div className="mt-3 rounded-xl bg-white/70 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-wider text-text-muted">🎤 Caption</p>
                        <button type="button" aria-label="Delete caption" onClick={() => void remove(cap, 'caption')} className="p-1 text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <VoiceBody a={cap} urls={urls} onChanged={() => void reload()} />
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={a.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-text-muted">🎤 Voice note</p>
                  <button type="button" aria-label="Delete voice note" onClick={() => void remove(a, 'voice note')} className="p-1 text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
                <VoiceBody a={a} urls={urls} onChanged={() => void reload()} />
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
      )}

      <input ref={takeInput} type="file" accept="image/*" capture="environment" hidden onChange={e => (void addPhotos(e.target.files), (e.target.value = ''))} />
      <input ref={chooseInput} type="file" accept="image/*" multiple hidden onChange={e => (void addPhotos(e.target.files), (e.target.value = ''))} />

      <BottomBar gap="gap-2.5">
        <button type="button" onClick={() => navigate('INSPECTION_FORM')} className="h-12 px-2.5 rounded-2xl bg-white shadow-sm text-[15px] font-bold text-text flex items-center gap-0.5 shrink-0 whitespace-nowrap">
          <ChevronLeft size={20} /> Back to Form
        </button>
        <button
          type="button"
          onClick={() => takeInput.current?.click()}
          disabled={busy || atCap || !capture}
          title={capture ? undefined : 'Camera capture works on phones and tablets'}
          className={`${bar} flex-1 flex-col !gap-0 leading-tight`}
        >
          <span className="flex items-center gap-1.5">
            <Camera size={16} /> Take
          </span>
          {!capture && <span className="text-[9px] font-bold opacity-90">Mobile Only</span>}
        </button>
        <button type="button" onClick={() => chooseInput.current?.click()} disabled={busy || atCap} className={`${bar} flex-1`}>
          <ImagePlus size={16} /> Choose
        </button>
        <button type="button" onClick={() => setRecorder({ parent: null })} disabled={busy} className={`${bar} flex-1`}>
          <Mic size={16} /> Voice
        </button>
      </BottomBar>

      {busy && (
        <Overlay>
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/30">
            <div className="rounded-2xl bg-white px-6 py-4 font-bold flex items-center gap-3 shadow-lg">
              <Spinner className="w-5 h-5" /> Working…
            </div>
          </div>
        </Overlay>
      )}

      {recorder && <VoiceRecorder title={recorder.parent ? 'Record caption' : 'Record voice note'} onCancel={() => setRecorder(null)} onUse={clip => void useClip(clip)} />}

      {lightbox && lightbox.storage_path && (
        <Overlay>
          <div className="fixed inset-0 z-[170] bg-black flex flex-col" onClick={() => setLightbox(null)}>
            <div className="flex justify-between p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  void saveSinglePhoto(lightbox, state.hives.find(h => h.id === state.selectedHiveId)?.name ?? null, inspection.timestamp as string | undefined);
                }}
                className="h-10 px-4 rounded-full bg-white/15 text-white font-bold flex items-center gap-2"
              >
                <Download size={18} /> Save photo
              </button>
              <button type="button" aria-label="Close" className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center">
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-2">
              <img src={urls[lightbox.storage_path]} alt="" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
