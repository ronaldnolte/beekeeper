// Voice recording overlay — SPEC B §15 ("Record voice note" / "Record caption").

import { useEffect, useRef, useState } from 'react';
import { Check, Mic, Pause, Play, RotateCcw, Square, X } from 'lucide-react';
import { Overlay } from '../../components/Overlay';

const MAX_SECONDS = 90;
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
const pickType = () => TYPES.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function VoiceRecorder({ title, onUse, onCancel }: { title: string; onUse: (clip: Blob) => void; onCancel: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'recorded'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<Blob | null>(null);
  const [playing, setPlaying] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);

  const release = () => {
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
  };
  useEffect(
    () => () => {
      release();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  useEffect(() => {
    if (phase !== 'recording') return;
    const start = Date.now();
    const t = setInterval(() => {
      const s = (Date.now() - start) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) rec.current?.stop(); // stops itself at 90 s
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  const start = async () => {
    setError(null);
    try {
      // Microphone permission is asked only now, on the first tap (SCAR S-INSP-9).
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError((err as Error).name === 'NotAllowedError' ? 'Microphone permission denied. Allow it in your browser to record.' : 'Could not start recording on this device.');
      return;
    }
    try {
      const type = pickType();
      const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = e => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        const blob = new Blob(chunks, { type: r.mimeType || type || 'audio/webm' });
        release();
        setClip(blob);
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(blob);
        setPhase('recorded');
      };
      rec.current = r;
      r.start();
      setElapsed(0);
      setPhase('recording');
    } catch {
      release();
      setError('Could not start recording on this device.');
    }
  };

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().then(() => setPlaying(true));
    else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <Overlay>
      <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-quick">
        <div role="dialog" aria-modal="true" aria-label={title} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-bg p-6 animate-sheet-in" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">{title}</h2>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => {
                if (rec.current?.state === 'recording') {
                  rec.current.onstop = null;
                  rec.current.stop();
                }
                release(); // releases the microphone
                onCancel();
              }}
              className="p-1 text-text-muted"
            >
              <X size={24} />
            </button>
          </div>
          <p className="mt-4 text-center text-3xl font-black tabular-nums">
            {fmt(elapsed)} <span className="text-text-muted text-xl">/ 1:30</span>
          </p>
          <div className="mt-6 flex justify-center">
            {phase === 'idle' && (
              <button type="button" aria-label="Start recording" onClick={() => void start()} className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
                <Mic size={34} />
              </button>
            )}
            {phase === 'recording' && (
              <button type="button" aria-label="Stop recording" onClick={() => rec.current?.stop()} className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-pulse">
                <Square size={30} fill="currentColor" />
              </button>
            )}
            {phase === 'recorded' && (
              <div className="flex items-center gap-3">
                <audio ref={audio} src={url.current ?? undefined} onEnded={() => setPlaying(false)} />
                <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center">
                  {playing ? <Pause size={24} /> : <Play size={24} />}
                </button>
                <button type="button" onClick={() => (setClip(null), setElapsed(0), setPhase('idle'))} className="h-12 px-4 rounded-2xl bg-white shadow font-bold flex items-center gap-2">
                  <RotateCcw size={18} /> Re-record
                </button>
                <button type="button" onClick={() => clip && onUse(clip)} className="h-12 px-5 rounded-2xl bg-primary text-white font-black flex items-center gap-2">
                  <Check size={18} /> Use
                </button>
              </div>
            )}
          </div>
          <p className="mt-5 text-center text-sm text-text-muted">
            {phase === 'idle' && 'Tap the mic to start. Tap again to stop.'}
            {phase === 'recording' && 'Recording… tap the square to stop.'}
            {phase === 'recorded' && 'Play it back, then Use or Re-record.'}
          </p>
          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
        </div>
      </div>
    </Overlay>
  );
}
