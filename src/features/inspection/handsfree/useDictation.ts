import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Continuous dictation for a Hands-free inspection.
 *
 * The microphone stays on from start() until stop(). Every PIECE_SECONDS the
 * recorder is restarted on the same microphone stream, so each piece is a
 * complete, separately playable audio file that can be sent for transcription
 * on its own (keeps every request well under the server's size limit, and a
 * failed piece only loses a minute). The gap between pieces is a few
 * milliseconds.
 *
 * If the microphone is taken away (phone call, screen lock on some phones) the
 * last piece is saved and the state becomes 'paused' so the screen can offer
 * "tap to continue".
 */

export const PIECE_SECONDS = 60;
/** Pieces shorter than this (a tap-and-stop) are dropped — nothing worth sending. */
const MIN_PIECE_MS = 1500;

export type DictationState = 'idle' | 'starting' | 'recording' | 'paused';

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export function useDictation(onPiece: (audio: Blob) => void) {
  const [state, setState] = useState<DictationState>('idle');
  const [seconds, setSeconds] = useState(0); // length of the current part
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pieceTimerRef = useRef<number | null>(null);
  const clockRef = useRef<number | null>(null);
  const onPieceRef = useRef(onPiece);
  onPieceRef.current = onPiece;
  // Set when the stop was asked for by us (stop / pause), so the recorder's
  // onstop knows not to roll straight into a new piece.
  const endingRef = useRef<'none' | 'stop' | 'pause'>('none');

  const clearTimers = () => {
    if (pieceTimerRef.current) window.clearTimeout(pieceTimerRef.current);
    if (clockRef.current) window.clearInterval(clockRef.current);
    pieceTimerRef.current = null;
    clockRef.current = null;
  };

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startPiece = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (Date.now() - startedAt >= MIN_PIECE_MS && blob.size > 0) onPieceRef.current(blob);
      if (endingRef.current === 'none' && streamRef.current) {
        startPiece(); // rolling over to the next one-minute piece
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    pieceTimerRef.current = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, PIECE_SECONDS * 1000);
  }, []);

  const finish = useCallback((how: 'stop' | 'pause') => {
    endingRef.current = how;
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop(); // flushes the last piece
    releaseMic();
    setState(how === 'pause' ? 'paused' : 'idle');
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Microphone taken away (call, some phones on screen lock) → keep what we
      // have and ask the user to continue.
      stream.getAudioTracks().forEach((t) => {
        t.onended = () => {
          if (streamRef.current === stream) finish('pause');
        };
      });
      endingRef.current = 'none';
      setSeconds(0);
      clockRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      startPiece();
      setState('recording');
    } catch (e: any) {
      releaseMic();
      setState('idle');
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission is blocked. Allow it in your browser settings to dictate.'
          : 'Could not start the microphone on this device.'
      );
    }
  }, [finish, startPiece]);

  const stop = useCallback(() => finish('stop'), [finish]);

  // Leaving the screen ends dictation cleanly.
  useEffect(() => () => {
    endingRef.current = 'stop';
    clearTimers();
    const r = recorderRef.current;
    if (r && r.state !== 'inactive') r.stop();
    releaseMic();
  }, []);

  return { state, seconds, error, start, stop };
}
