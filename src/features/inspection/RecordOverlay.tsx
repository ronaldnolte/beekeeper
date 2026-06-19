import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Pause, Check, X, RotateCcw } from 'lucide-react';

/** Max clip length (seconds) — auto-stops to keep transcription quick + cheap. */
const MAX_SECONDS = 90;

interface RecordOverlayProps {
  title: string;
  onCancel: () => void;
  onDone: (audio: Blob) => void;
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

type Phase = 'idle' | 'recording' | 'recorded';

/**
 * Tap-to-start / tap-to-stop voice recorder in a modal overlay. Mic permission
 * is requested only on the first tap of "Start" (just-in-time), never on mount.
 */
export const RecordOverlay: React.FC<RecordOverlayProps> = ({ title, onCancel, onDone }) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupStream();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = URL.createObjectURL(blob);
        setPhase('recorded');
        cleanupStream();
      };

      recorder.start();
      setPhase('recording');
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e: any) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied. Allow it in your browser to record.'
          : 'Could not start recording on this device.'
      );
      cleanupStream();
      setPhase('idle');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play();
    }
  };

  const reset = () => {
    blobRef.current = null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPhase('idle');
    setSeconds(0);
    setPlaying(false);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--color-bg)] rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-[var(--color-text)]">{title}</h2>
          <button
            onClick={() => {
              cleanupStream();
              onCancel();
            }}
            className="w-9 h-9 rounded-full bg-[var(--color-input-bg)] flex items-center justify-center text-[var(--color-text-muted)]"
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-5 py-2">
          <div className="text-3xl font-black tabular-nums text-[var(--color-text)]">
            {fmt(seconds)}
            <span className="text-sm font-bold text-[var(--color-text-muted)]"> / {fmt(MAX_SECONDS)}</span>
          </div>

          {phase === 'idle' && (
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center active:scale-95 shadow-lg"
              aria-label="Start recording"
            >
              <Mic size={32} />
            </button>
          )}

          {phase === 'recording' && (
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center active:scale-95 shadow-lg animate-pulse"
              aria-label="Stop recording"
            >
              <Square size={30} />
            </button>
          )}

          {phase === 'recorded' && (
            <div className="w-full flex flex-col items-center gap-4">
              <audio
                ref={audioElRef}
                src={previewUrlRef.current ?? undefined}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center active:scale-95"
                aria-label={playing ? 'Pause' : 'Play back'}
              >
                {playing ? <Pause size={26} /> : <Play size={26} />}
              </button>
              <div className="flex gap-2.5 w-full">
                <button
                  onClick={reset}
                  className="flex-1 bg-[var(--color-input-bg)] text-[var(--color-text)] py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95"
                >
                  <RotateCcw size={18} /> Re-record
                </button>
                <button
                  onClick={() => blobRef.current && onDone(blobRef.current)}
                  className="flex-1 bg-[var(--color-primary)] text-white py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 active:scale-95"
                >
                  <Check size={18} /> Use
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--color-text-muted)] text-center">
            {phase === 'idle' && 'Tap the mic to start. Tap again to stop.'}
            {phase === 'recording' && 'Recording… tap the square to stop.'}
            {phase === 'recorded' && 'Play it back, then Use or Re-record.'}
          </p>
        </div>
      </div>
    </div>
  );
};
