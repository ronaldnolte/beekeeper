/**
 * Keep the screen from dimming/locking while the user is recording, so a long
 * dictation isn't cut off by the phone's screen timeout.
 *
 * - Native (Google Play app): the keep-awake plugin sets Android's
 *   keep-screen-on window flag. No permission needed.
 * - Web / installed web app: the standard Screen Wake Lock API (Chrome, Samsung
 *   Internet, Firefox, Edge, Safari 16.4+). The browser drops the lock whenever
 *   the page is hidden (camera, app switch), so we re-request it when the page
 *   becomes visible again.
 *
 * Best effort: a browser may refuse (battery saver, unsupported). Callers get
 * `false` back and can show a tip; recording itself never depends on this.
 */
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

type WakeLockSentinelLike = { release: () => Promise<void>; addEventListener: (t: 'release', cb: () => void) => void };

let wanted = false;
let sentinel: WakeLockSentinelLike | null = null;
let listening = false;

async function requestWebLock(): Promise<boolean> {
  const wakeLock = (navigator as any).wakeLock;
  if (!wakeLock?.request) return false;
  try {
    const s: WakeLockSentinelLike = await wakeLock.request('screen');
    sentinel = s;
    s.addEventListener('release', () => {
      if (sentinel === s) sentinel = null;
    });
    return true;
  } catch {
    // Refused (e.g. low battery, page not visible). Not fatal.
    return false;
  }
}

function onVisibilityChange() {
  if (wanted && !sentinel && document.visibilityState === 'visible') {
    void requestWebLock();
  }
}

/** Ask the device to keep the screen on. Resolves true if it agreed. */
export async function keepScreenAwake(): Promise<boolean> {
  wanted = true;
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.keepAwake();
      return true;
    } catch {
      return false;
    }
  }
  if (!listening) {
    document.addEventListener('visibilitychange', onVisibilityChange);
    listening = true;
  }
  if (sentinel) return true;
  return requestWebLock();
}

/** Let the screen sleep normally again. Safe to call more than once. */
export async function allowScreenSleep(): Promise<void> {
  wanted = false;
  if (Capacitor.isNativePlatform()) {
    try {
      await KeepAwake.allowSleep();
    } catch {
      /* ignore */
    }
    return;
  }
  if (listening) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    listening = false;
  }
  const s = sentinel;
  sentinel = null;
  if (s) await s.release().catch(() => {});
}
