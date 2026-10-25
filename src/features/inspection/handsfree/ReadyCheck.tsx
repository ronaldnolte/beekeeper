import React, { useEffect, useRef, useState } from 'react';
import { Mic, CheckCircle2, AlertTriangle, XCircle, Loader2, RotateCcw } from 'lucide-react';
import { checkTranscription } from '../../../data/inspectionAttachmentRepository';
import { supabase } from '../../../data/supabase';
import { keepScreenAwake } from '../../../shared/device/keepAwake';

/**
 * Hands-free "ready check" — about 10 seconds before the hive is opened, so the
 * beekeeper never finds out mid-inspection that dictation can't work.
 *
 * Checks: microphone (permission + a live sound bar), turning speech into text
 * (a short test clip really goes through the service and the words come back),
 * keep-screen-awake, and still signed in.
 *
 * Green = go. Amber = can continue with a warning. Red = stop; offer the
 * regular form instead. After a full pass on this device, later inspections
 * run a quiet check (no "say testing") and only show this screen on a problem.
 */

const PASSED_KEY = 'handsFreeReadyCheckPassed';
const TEST_SECONDS = 4;

type Level = 'pending' | 'running' | 'ok' | 'warn' | 'fail';
interface Row { level: Level; text: string }

export function hasPassedBefore(): boolean {
  try {
    return localStorage.getItem(PASSED_KEY) === '1';
  } catch {
    return false;
  }
}
function rememberPassed() {
  try {
    localStorage.setItem(PASSED_KEY, '1');
  } catch {
    /* private window etc. — the full check just runs again next time */
  }
}

/** Quiet check for repeat users: sign-in, microphone permission, screen awake. */
export async function quietCheck(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    return false;
  }
  return keepScreenAwake('hands-free');
}

interface ReadyCheckProps {
  onReady: () => void;
  onUseForm: () => void;
}

export const ReadyCheck: React.FC<ReadyCheckProps> = ({ onReady, onUseForm }) => {
  const [phase, setPhase] = useState<'intro' | 'listening' | 'checking' | 'done'>('intro');
  const [mic, setMic] = useState<Row>({ level: 'pending', text: 'Microphone' });
  const [speech, setSpeech] = useState<Row>({ level: 'pending', text: 'Turning speech into text' });
  const [awake, setAwake] = useState<Row>({ level: 'pending', text: 'Keep screen awake' });
  const [signIn, setSignIn] = useState<Row>({ level: 'pending', text: 'Signed in' });
  const [soundLevel, setSoundLevel] = useState(0);
  const [countdown, setCountdown] = useState(TEST_SECONDS);

  const cleanupRef = useRef<() => void>(() => {});
  useEffect(() => () => cleanupRef.current(), []);

  const runCheck = async () => {
    setPhase('listening');
    setMic({ level: 'running', text: 'Microphone' });
    setSpeech({ level: 'pending', text: 'Turning speech into text' });

    // Sign-in first: an expired sign-in would make every piece fail later.
    const { data } = await supabase.auth.getSession();
    setSignIn(
      data.session
        ? { level: 'ok', text: 'Signed in' }
        : { level: 'fail', text: 'Not signed in — sign in again, then retry' }
    );

    const awakeOk = await keepScreenAwake('hands-free');
    setAwake(
      awakeOk
        ? { level: 'ok', text: 'Screen will stay on' }
        : { level: 'warn', text: 'Screen may turn off — set your screen timeout to 5 minutes or more' }
    );

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      setMic({
        level: 'fail',
        text:
          e?.name === 'NotAllowedError'
            ? 'Microphone blocked — allow it in your browser settings'
            : 'No microphone available on this device',
      });
      setSpeech({ level: 'fail', text: 'Turning speech into text — skipped' });
      setPhase('done');
      return;
    }

    // Live sound bar while they speak.
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    let peak = 0;
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let max = 0;
      for (const v of buf) max = Math.max(max, Math.abs(v - 128));
      const level = Math.min(1, max / 64);
      peak = Math.max(peak, level);
      setSoundLevel(level);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    let timer = 0;
    let countTimer = 0;
    cleanupRef.current = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearInterval(countTimer);
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    };

    const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
    recorder.start();
    setCountdown(TEST_SECONDS);
    countTimer = window.setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    timer = window.setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), TEST_SECONDS * 1000);
    await stopped;
    cleanupRef.current();
    cleanupRef.current = () => {};
    setSoundLevel(0);

    setMic(
      peak > 0.08
        ? { level: 'ok', text: 'Microphone is working' }
        : { level: 'warn', text: 'Microphone heard very little — speak up or check nothing covers it' }
    );

    setPhase('checking');
    setSpeech({ level: 'running', text: 'Turning speech into text…' });
    const audio = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const result = await checkTranscription(audio);
    if (result.ok) {
      setSpeech(
        result.transcript
          ? { level: 'ok', text: `We heard: “${result.transcript}”` }
          : { level: 'warn', text: 'No words came through — try again somewhere quieter' }
      );
    } else if (result.reason === 'signed_out') {
      setSignIn({ level: 'fail', text: 'Not signed in — sign in again, then retry' });
      setSpeech({ level: 'fail', text: 'Turning speech into text — needs you signed in' });
    } else if (result.reason === 'unreachable') {
      setSpeech({ level: 'fail', text: 'Can’t reach the service — check your signal' });
    } else {
      setSpeech({ level: 'fail', text: 'The speech-to-text service had a problem — try again shortly' });
    }
    setPhase('done');
  };

  const rows = [mic, speech, awake, signIn];
  const anyFail = rows.some((r) => r.level === 'fail');
  const anyWarn = rows.some((r) => r.level === 'warn');

  useEffect(() => {
    if (phase === 'done' && !anyFail && !anyWarn) rememberPassed();
  }, [phase, anyFail, anyWarn]);

  const icon = (l: Level) =>
    l === 'ok' ? <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
    : l === 'warn' ? <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
    : l === 'fail' ? <XCircle size={20} className="text-red-500 flex-shrink-0" />
    : l === 'running' ? <Loader2 size={20} className="animate-spin text-[var(--color-primary)] flex-shrink-0" />
    : <div className="w-5 h-5 rounded-full border-2 border-[var(--color-card-border)] flex-shrink-0" />;

  return (
    <div className="w-full max-w-2xl space-y-3">
      <div className="card p-4">
        <h2 className="text-lg font-black text-[var(--color-text)]">Ready check</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          A 10-second check before you open the hive, so dictation won’t let you down halfway through.
        </p>
      </div>

      {phase === 'intro' && (
        <button
          onClick={runCheck}
          className="w-full card p-5 flex flex-col items-center gap-2 border-2 border-[var(--color-primary)]/40 active:scale-[0.99]"
        >
          <div className="w-16 h-16 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
            <Mic size={28} />
          </div>
          <span className="font-black text-[var(--color-text)]">Start the check</span>
          <span className="text-sm text-[var(--color-text-muted)] text-center">
            Then say: <b>“Testing, one, two, three”</b>
          </span>
        </button>
      )}

      {phase === 'listening' && (
        <div className="card p-4">
          <p className="font-black text-[var(--color-text)] text-center">
            Say: “Testing, one, two, three” <span className="text-[var(--color-text-muted)]">({countdown})</span>
          </p>
          <div className="mt-3 h-3 rounded-full bg-[var(--color-input-bg)] overflow-hidden">
            <div
              className="h-full bg-green-500 transition-[width] duration-75"
              style={{ width: `${Math.round(soundLevel * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase !== 'intro' && (
        <div className="card p-4 space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-2.5">
              {icon(r.level)}
              <span className="text-sm font-medium text-[var(--color-text)]">{r.text}</span>
            </div>
          ))}
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-2">
          {!anyFail && (
            <button
              onClick={onReady}
              className="w-full bg-[var(--color-primary)] text-white py-4 rounded-2xl font-black text-lg active:scale-95"
            >
              {anyWarn ? 'Continue anyway' : 'All good — start inspection'}
            </button>
          )}
          <button
            onClick={() => {
              setPhase('intro');
              setMic({ level: 'pending', text: 'Microphone' });
              setSpeech({ level: 'pending', text: 'Turning speech into text' });
            }}
            className="w-full bg-[var(--color-input-bg)] text-[var(--color-text)] py-3 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95"
          >
            <RotateCcw size={16} /> Run the check again
          </button>
          {anyFail && (
            <button
              onClick={onUseForm}
              className="w-full bg-[var(--color-input-bg)] text-[var(--color-text)] py-3 rounded-2xl font-bold active:scale-95"
            >
              Use the regular inspection form instead
            </button>
          )}
        </div>
      )}
    </div>
  );
};
