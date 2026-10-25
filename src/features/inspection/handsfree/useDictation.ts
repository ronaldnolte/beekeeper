import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Continuous dictation for a Hands-free inspection.
 *
 * The microphone stays on from start() until stop(). Every PIECE_SECONDS the
 * recorder is restarted, so each piece is a complete, separately playable
 * audio file that can be sent for transcription on its own (keeps every
 * request well under the server's size limit, and a failed piece only loses a
 * minute). The gap between pieces is a few milliseconds.
 *
 * Phones can take the microphone away or refuse a new recorder at the hand-over
 * between pieces. When that happens we quietly reconnect the microphone and
 * carry on; only if reconnecting fails does dictation pause ("tap to
 * continue"). Whenever dictation ends on its own, `endReason` says why, in
 * plain words, so testing on real phones can pin the cause down.
 */

export const PIECE_SECONDS = 60;
/** Pieces shorter than this (a tap-and-stop) are dropped — nothing worth sending. */
const MIN_PIECE_MS = 1500;
/** Give up reconnecting after this many tries in a row without a good piece. */
const MAX_RECONNECTS = 3;
/**
 * A minute whose loudest moment stays below this (0–1 scale, same as the ready
 * check's sound bar) had no speech — just a quiet pause — and isn't sent.
 * Deliberately low so quiet speech is never dropped; buzzing still gets sent
 * and the transcription is told to ignore it.
 */
const SILENCE_PEAK = 0.04;
/** Set while dictating, so a reload of the screen mid-dictation can be reported. */
const ACTIVE_KEY = 'handsFreeDictationActive';

export type DictationState = 'idle' | 'starting' | 'recording' | 'paused';

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

function markActive(on: boolean) {
  try {
    if (on) sessionStorage.setItem(ACTIVE_KEY, '1');
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function useDictation(onPiece: (audio: Blob) => void) {
  const [state, setState] = useState<DictationState>('idle');
  const [seconds, setSeconds] = useState(0); // length of the current part
  const [error, setError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string | null>(() => {
    try {
      const v = sessionStorage.getItem(ACTIVE_KEY);
      if (v === '1') return 'The screen reloaded while you were dictating.';
      // Left by the previous copy of this screen a moment ago → it was redrawn.
      if (v?.startsWith('left:') && Date.now() - Number(v.slice(5)) < 5000) {
        return 'The screen was redrawn while you were dictating.';
      }
      return null;
    } catch {
      return null;
    }
  });

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const pieceTimerRef = useRef<number | null>(null);
  const clockRef = useRef<number | null>(null);
  const onPieceRef = useRef(onPiece);
  onPieceRef.current = onPiece;
  // Set when dictation is being ended, so the recorder's onstop doesn't roll
  // straight into a new piece.
  const endingRef = useRef<'none' | 'stop' | 'pause'>('none');
  const reconnectsRef = useRef(0);

  // Loudness of the current piece, measured live so silent minutes can be skipped.
  const levelRef = useRef<{ max: number; samples: number }>({ max: 0, samples: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const monitorRef = useRef<number | null>(null);

  const stopMonitor = () => {
    if (monitorRef.current) window.clearInterval(monitorRef.current);
    monitorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
  };

  const closeAudio = () => {
    stopMonitor();
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  };

  /** Watch the microphone's loudness. Best effort: if it can't run, nothing is skipped. */
  const startMonitor = (stream: MediaStream) => {
    stopMonitor();
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current!;
      ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      const buf = new Uint8Array(analyser.fftSize);
      monitorRef.current = window.setInterval(() => {
        if (ctx.state !== 'running') return;
        analyser.getByteTimeDomainData(buf);
        let max = 0;
        for (const v of buf) max = Math.max(max, Math.abs(v - 128));
        const level = levelRef.current;
        level.max = Math.max(level.max, max / 64);
        level.samples += 1;
      }, 150);
    } catch {
      /* no loudness check on this device — every piece is sent */
    }
  };

  const note = (msg: string) => console.warn('[hands-free dictation]', msg);

  const clearTimers = () => {
    if (pieceTimerRef.current) window.clearTimeout(pieceTimerRef.current);
    if (clockRef.current) window.clearInterval(clockRef.current);
    pieceTimerRef.current = null;
    clockRef.current = null;
  };

  const releaseMic = () => {
    const s = streamRef.current;
    streamRef.current = null;
    s?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
  };

  // Declared up front so the pieces below can call each other.
  const startPieceRef = useRef<() => void>(() => {});
  const reconnectRef = useRef<(why: string) => void>(() => {});

  const finish = useCallback((how: 'stop' | 'pause', reason?: string) => {
    endingRef.current = how;
    clearTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop(); // flushes the last piece
      } catch {
        /* already gone */
      }
    }
    releaseMic();
    closeAudio();
    markActive(false);
    if (reason) {
      note(reason);
      setEndReason(reason);
    }
    setState(how === 'pause' ? 'paused' : 'idle');
  }, []);

  const openMic = async (): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => {
        if (streamRef.current === stream && endingRef.current === 'none') {
          reconnectRef.current('The phone took the microphone away');
        }
      };
    });
    startMonitor(stream);
    return stream;
  };

  startPieceRef.current = () => {
    const stream = streamRef.current;
    if (!stream || endingRef.current !== 'none') return;
    let recorder: MediaRecorder;
    try {
      const mimeType = pickMimeType();
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (e: any) {
      reconnectRef.current(`Could not start the next minute (${e?.name ?? 'error'})`);
      return;
    }
    const chunks: Blob[] = [];
    const level = { max: 0, samples: 0 };
    levelRef.current = level;
    const startedAt = Date.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = (e: any) => {
      reconnectRef.current(`The recorder reported a problem (${e?.error?.name ?? 'error'})`);
    };
    recorder.onstop = () => {
      if (pieceTimerRef.current) window.clearTimeout(pieceTimerRef.current);
      pieceTimerRef.current = null;
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      // Silent only if the loudness check actually ran for most of the piece.
      const measured = level.samples * 150 >= (Date.now() - startedAt) * 0.5;
      const silent = measured && level.max < SILENCE_PEAK;
      if (silent) note('Skipped a minute with no speech');
      if (!silent && Date.now() - startedAt >= MIN_PIECE_MS && blob.size > 0) {
        reconnectsRef.current = 0; // a good piece — the microphone is healthy
        onPieceRef.current(blob);
      }
      // Rolling over to the next one-minute piece (only if this was the timed
      // hand-over, not an ending or a reconnect, which start their own piece).
      if (endingRef.current === 'none' && recorderRef.current === recorder) {
        recorderRef.current = null;
        startPieceRef.current();
      }
    };
    recorderRef.current = recorder;
    try {
      recorder.start();
    } catch (e: any) {
      recorderRef.current = null;
      reconnectRef.current(`Could not start the next minute (${e?.name ?? 'error'})`);
      return;
    }
    pieceTimerRef.current = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, PIECE_SECONDS * 1000);
  };

  reconnectRef.current = (why: string) => {
    if (endingRef.current !== 'none') return;
    note(`${why} — reconnecting the microphone`);
    // Save what this recorder has, without letting its onstop start a new piece.
    const old = recorderRef.current;
    recorderRef.current = null;
    if (pieceTimerRef.current) window.clearTimeout(pieceTimerRef.current);
    pieceTimerRef.current = null;
    if (old && old.state !== 'inactive') {
      try {
        old.stop();
      } catch {
        /* ignore */
      }
    }
    releaseMic();
    reconnectsRef.current += 1;
    if (reconnectsRef.current > MAX_RECONNECTS) {
      finish('pause', `${why}, and reconnecting didn't work.`);
      return;
    }
    openMic()
      .then(() => startPieceRef.current())
      .catch((e: any) => finish('pause', `${why}, and the microphone couldn't be reopened (${e?.name ?? 'error'}).`));
  };

  const start = useCallback(async () => {
    setError(null);
    setEndReason(null);
    setState('starting');
    endingRef.current = 'none';
    reconnectsRef.current = 0;
    try {
      await openMic();
      setSeconds(0);
      clockRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      markActive(true);
      startPieceRef.current();
      setState('recording');
    } catch (e: any) {
      releaseMic();
      closeAudio();
      setState('idle');
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission is blocked. Allow it in your browser settings to dictate.'
          : 'Could not start the microphone on this device.'
      );
    }
  }, []);

  const stop = useCallback(() => finish('stop'), [finish]);

  // Leaving the screen ends dictation cleanly (the last piece is still saved).
  useEffect(() => () => {
    endingRef.current = 'stop';
    clearTimers();
    const r = recorderRef.current;
    const wasRecording = !!r && r.state !== 'inactive';
    if (wasRecording) r!.stop();
    releaseMic();
    closeAudio();
    try {
      if (wasRecording) sessionStorage.setItem(ACTIVE_KEY, 'left:' + Date.now());
      else sessionStorage.removeItem(ACTIVE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { state, seconds, error, endReason, start, stop };
}
