import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Mic, Square, Loader2, MessageSquarePlus, Check, RotateCcw, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { SubTabBar } from '../../../shared/components/SubTabBar';
import { RecordOverlay } from '../RecordOverlay';
import { PHOTO_CAP } from '../inspectionOptions';
import {
  fetchAttachments,
  uploadPhoto,
  uploadVoiceNote,
  requestTranscription,
  retryTranscription,
  type AttachmentWithUrls,
} from '../../../data/inspectionAttachmentRepository';
import { discardInspection } from '../../../data/inspectionRepository';
import { keepScreenAwake, allowScreenSleep } from '../../../shared/device/keepAwake';
import { useDictation } from './useDictation';
import { ReadyCheck, hasPassedBefore, quietCheck } from './ReadyCheck';

/**
 * Hands-free inspection: the phone sits on the hive box while the beekeeper
 * talks. Take turns — dictate, take a photo (dictation stops by itself), add a
 * caption, Continue dictation. Each stretch of talking is stored as ordered
 * voice-note pieces (one per minute) on the inspection, with photos between
 * them, using the same attachments as Photos & Voice.
 *
 * The screen is kept awake for the whole inspection. While dictating it never
 * times out; between recordings it lets go after 30 minutes with no touch (the
 * phone was really left behind). Finish opens the normal form to review & save.
 */

const IDLE_RELEASE_MS = 30 * 60 * 1000;
const AWAKE_HOLDER = 'hands-free';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const HandsFreeView: React.FC = () => {
  const { selectedRecord, setCurrentView, selectInspection } = useAppStore();
  const inspectionId = selectedRecord?.id as string | undefined;

  const [stage, setStage] = useState<'quiet-check' | 'ready-check' | 'session'>(
    hasPassedBefore() ? 'quiet-check' : 'ready-check'
  );
  const [items, setItems] = useState<AttachmentWithUrls[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [captionPromptFor, setCaptionPromptFor] = useState<string | null>(null);
  const [recordingCaptionFor, setRecordingCaptionFor] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [screenReleased, setScreenReleased] = useState(false);

  const nextOrderRef = useRef<number | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const feedEndRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const lastTouchRef = useRef(Date.now());

  const load = useCallback(async () => {
    if (!inspectionId) return;
    try {
      const rows = await fetchAttachments(inspectionId);
      setItems(rows);
      if (nextOrderRef.current === null) {
        nextOrderRef.current = rows.reduce((m, r) => Math.max(m, r.sort_order + 1), 0);
      }
    } catch (e: any) {
      setError(e.message ?? 'Could not load this inspection.');
    }
  }, [inspectionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items.length, captionPromptFor]);

  /** Run uploads one after another so the saved order matches the spoken order. */
  const enqueue = (task: (sortOrder: number) => Promise<void>) => {
    const order = nextOrderRef.current ?? 0;
    nextOrderRef.current = order + 1;
    setUploading((n) => n + 1);
    queueRef.current = queueRef.current
      .then(() => task(order))
      .catch((e: any) => setError(e?.message ?? 'Something could not be saved — check your signal.'))
      .finally(() => setUploading((n) => n - 1));
    return queueRef.current;
  };

  const handlePiece = (audio: Blob) => {
    if (!inspectionId) return;
    enqueue(async (sortOrder) => {
      const created = await uploadVoiceNote(inspectionId, audio, { sortOrder });
      await load();
      requestTranscription(created.id, audio, created.audio_path)
        .catch((e) => console.warn('Transcription failed:', e?.message))
        .finally(() => load());
    });
  };

  const dictation = useDictation(handlePiece);
  const recording = dictation.state === 'recording' || dictation.state === 'starting';

  // Quiet check for repeat users; fall back to the full check on any problem.
  useEffect(() => {
    if (stage !== 'quiet-check') return;
    let cancelled = false;
    quietCheck().then((ok) => {
      if (!cancelled) setStage(ok ? 'session' : 'ready-check');
    });
    return () => {
      cancelled = true;
    };
  }, [stage]);

  // Keep the screen on for the whole session (see header comment).
  useEffect(() => {
    if (stage !== 'session') return;
    void keepScreenAwake(AWAKE_HOLDER);
    lastTouchRef.current = Date.now();
    const onTouch = () => {
      lastTouchRef.current = Date.now();
      setScreenReleased((released) => {
        if (released) void keepScreenAwake(AWAKE_HOLDER);
        return false;
      });
    };
    window.addEventListener('pointerdown', onTouch);
    return () => {
      window.removeEventListener('pointerdown', onTouch);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'session') return;
    const id = window.setInterval(() => {
      if (!recording && !screenReleased && Date.now() - lastTouchRef.current > IDLE_RELEASE_MS) {
        void allowScreenSleep(AWAKE_HOLDER);
        setScreenReleased(true);
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [stage, recording, screenReleased]);

  useEffect(() => () => void allowScreenSleep(AWAKE_HOLDER), []);

  const photoCount = items.filter((i) => i.kind === 'photo').length;
  const atCap = photoCount >= PHOTO_CAP;

  const handleTakePhoto = () => {
    if (recording) dictation.stop(); // take turns: the camera ends this stretch of talking
    setCaptionPromptFor(null);
    // Must open the camera inside this tap, or the browser blocks it.
    cameraInputRef.current?.click();
  };

  const handlePhotoFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !inspectionId) return;
    enqueue(async (sortOrder) => {
      const photo = await uploadPhoto(inspectionId, file, sortOrder);
      await load();
      setCaptionPromptFor(photo.id);
    });
  };

  const handleCaptionDone = (audio: Blob) => {
    const parentId = recordingCaptionFor;
    setRecordingCaptionFor(null);
    setCaptionPromptFor(null);
    if (!inspectionId || !parentId) return;
    enqueue(async (sortOrder) => {
      const created = await uploadVoiceNote(inspectionId, audio, { parentId, sortOrder });
      await load();
      requestTranscription(created.id, audio, created.audio_path)
        .catch((e) => console.warn('Transcription failed:', e?.message))
        .finally(() => load());
    });
  };

  const handleRetry = async (item: AttachmentWithUrls) => {
    setError(null);
    try {
      await retryTranscription(item);
    } catch (e: any) {
      setError(e?.message ?? 'Still could not turn that into text.');
    } finally {
      load();
    }
  };

  const handleFinish = async () => {
    setFinishing(true);
    if (recording) dictation.stop();
    // Give the recorder a moment to hand over its last piece, then wait for saves.
    await new Promise((r) => setTimeout(r, 300));
    await queueRef.current;
    await allowScreenSleep(AWAKE_HOLDER);
    setFinishing(false);
    setCurrentView('INSPECTION_FORM'); // record still selected → form opens for review
  };

  const handleCancelBeforeStart = async () => {
    if (inspectionId && items.length === 0) {
      try {
        await discardInspection(inspectionId);
      } catch {
        /* leave it; it shows in history and can be deleted there */
      }
      selectInspection(null);
    }
    await allowScreenSleep(AWAKE_HOLDER);
    setCurrentView('INSPECTION_FORM');
  };

  if (!inspectionId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
        <p className="font-bold text-[var(--color-text)] mb-4">No inspection selected</p>
        <button onClick={() => setCurrentView('INSPECTION_FORM')} className="bg-[var(--color-primary)] text-white px-5 py-3 rounded-2xl font-bold">
          Back
        </button>
      </div>
    );
  }

  // ----- Running log: parts of dictation with photos between them -----
  const captionFor = (photoId: string) => items.find((i) => i.kind === 'voice_note' && i.parent_id === photoId);
  const topLevel = items.filter((i) => i.kind === 'photo' || !i.parent_id);

  const renderPieceText = (v: AttachmentWithUrls) => {
    if (v.transcript_status === 'pending') {
      return (
        <span key={v.id} className="italic text-[var(--color-text-muted)] inline-flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> turning speech into text…{' '}
        </span>
      );
    }
    if (v.transcript_status === 'failed') {
      return (
        <span key={v.id} className="block my-1 text-xs text-red-600">
          A minute of dictation couldn’t be turned into text.{' '}
          <button onClick={() => handleRetry(v)} className="font-bold underline inline-flex items-center gap-1">
            <RotateCcw size={11} /> Try again
          </button>
        </span>
      );
    }
    return <span key={v.id}>{v.transcript ? v.transcript + ' ' : ''}</span>;
  };

  const log: React.ReactNode[] = [];
  let part = 0;
  let group: AttachmentWithUrls[] = [];
  const flush = () => {
    if (group.length === 0) return;
    part += 1;
    const pieces = group;
    log.push(
      <div key={`part-${pieces[0].id}`} className="card p-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-primary)] flex items-center gap-1 mb-1">
          <Mic size={12} /> Part {part}
        </p>
        <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{pieces.map(renderPieceText)}</p>
      </div>
    );
    group = [];
  };
  topLevel.forEach((item, idx) => {
    if (item.kind === 'voice_note') {
      group.push(item);
      return;
    }
    flush();
    const caption = captionFor(item.id);
    const photoNumber = topLevel.slice(0, idx + 1).filter((i) => i.kind === 'photo').length;
    log.push(
      <div key={item.id} className="card p-2.5 flex gap-3 items-start">
        <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-[var(--color-input-bg)]">
          {item.thumbUrl && <img src={item.thumbUrl} alt={`photo ${photoNumber}`} className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-primary)] flex items-center gap-1">
            <Camera size={12} /> Photo {photoNumber}
          </p>
          {caption ? (
            <p className="text-sm text-[var(--color-text)]">{renderPieceText(caption)}</p>
          ) : captionPromptFor === item.id ? (
            <div className="flex gap-2 mt-1.5">
              <button
                onClick={() => setRecordingCaptionFor(item.id)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[var(--color-primary)] px-3 py-2 rounded-lg active:scale-95"
              >
                <MessageSquarePlus size={14} /> Add caption
              </button>
              <button
                onClick={() => setCaptionPromptFor(null)}
                className="text-xs font-bold text-[var(--color-text-muted)] bg-[var(--color-input-bg)] px-3 py-2 rounded-lg active:scale-95"
              >
                Skip
              </button>
            </div>
          ) : (
            <p className="text-xs italic text-[var(--color-text-muted)]">No caption</p>
          )}
        </div>
      </div>
    );
  });
  flush();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto w-full flex flex-col items-center p-3 sm:p-4 space-y-3">
        <div className="w-full max-w-2xl">
          <SubTabBar activeView="INSPECTION_FORM" />
        </div>

        {stage === 'quiet-check' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-text-muted)]">
            <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm font-bold">Getting ready…</p>
          </div>
        )}

        {stage === 'ready-check' && (
          <ReadyCheck onReady={() => setStage('session')} onUseForm={() => setCurrentView('INSPECTION_FORM')} />
        )}

        {stage === 'session' && (
          <>
            <div className="w-full max-w-2xl flex items-center justify-between px-1">
              <h2 className="text-sm font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                Hands-free inspection
              </h2>
              <span className="text-xs font-bold text-[var(--color-text-muted)]">
                {photoCount}/{PHOTO_CAP} photos
              </span>
            </div>

            {recording && (
              <div className="w-full max-w-2xl rounded-2xl bg-red-500 text-white px-4 py-3 flex items-center gap-2 font-black animate-pulse">
                <span className="w-3 h-3 rounded-full bg-white" /> Dictating · {fmt(dictation.seconds)}
              </div>
            )}
            {dictation.state === 'paused' && (
              <div className="w-full max-w-2xl rounded-2xl bg-amber-500/15 border border-amber-500/50 text-amber-700 px-4 py-3 text-sm font-bold">
                Dictation paused — what you said is saved. Tap Continue dictation to carry on.
              </div>
            )}
            {screenReleased && (
              <div className="w-full max-w-2xl rounded-2xl bg-[var(--color-input-bg)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
                Nothing happened for 30 minutes, so the screen may turn off normally. Tap anywhere to keep it on again.
              </div>
            )}
            {(error || dictation.error) && (
              <div className="w-full max-w-2xl bg-red-500/10 border border-red-500/40 text-red-600 rounded-xl px-3 py-2 text-sm font-medium">
                {dictation.error ?? error}
              </div>
            )}

            {log.length === 0 && !recording ? (
              <div className="w-full max-w-2xl text-center py-10 text-[var(--color-text-muted)]">
                <Mic size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-bold">Set the phone down and start talking</p>
                <p className="text-sm">
                  Say where you are as you go — “bar 7”, “box 2, frame 4” — and what you see.
                </p>
              </div>
            ) : (
              <div className="w-full max-w-2xl space-y-3">{log}</div>
            )}
            {uploading > 0 && (
              <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> Saving…
              </p>
            )}
            <div ref={feedEndRef} />
          </>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handlePhotoFile(e.target.files);
          e.target.value = '';
        }}
      />

      {stage === 'session' && (
        <div className="w-full flex-shrink-0 flex justify-center gap-2.5 p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={handleTakePhoto}
            disabled={atCap || finishing}
            className="flex-shrink-0 bg-[var(--color-input-bg)] text-[var(--color-text)] px-4 py-4 rounded-2xl font-black text-sm flex flex-col items-center justify-center gap-0.5 active:scale-95 disabled:opacity-50"
          >
            <Camera size={22} /> Photo
          </button>
          {recording ? (
            <button
              onClick={dictation.stop}
              className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95"
            >
              <Square size={20} /> Stop dictation
            </button>
          ) : (
            <button
              onClick={() => {
                setCaptionPromptFor(null);
                dictation.start();
              }}
              disabled={finishing}
              className="flex-1 bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Mic size={20} /> {log.length === 0 ? 'Start dictation' : 'Continue dictation'}
            </button>
          )}
          <button
            onClick={handleFinish}
            disabled={finishing}
            className="flex-shrink-0 bg-[var(--color-input-bg)] text-[var(--color-text)] px-4 py-4 rounded-2xl font-black text-sm flex flex-col items-center justify-center gap-0.5 active:scale-95 disabled:opacity-50"
          >
            {finishing ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />} Finish
          </button>
        </div>
      )}

      {stage === 'ready-check' && (
        <div className="w-full flex-shrink-0 flex justify-center p-4 bg-white/75 backdrop-blur-xl border-t border-white/40 z-10 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={handleCancelBeforeStart}
            className="flex-1 max-w-md bg-white/60 border border-white/50 text-[var(--color-text)] py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      )}

      {recordingCaptionFor && (
        <RecordOverlay
          title="Record caption"
          onCancel={() => setRecordingCaptionFor(null)}
          onDone={handleCaptionDone}
        />
      )}
    </div>
  );
};
