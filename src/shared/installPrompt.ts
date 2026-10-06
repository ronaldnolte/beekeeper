// "Install this site" handling for Chrome, Brave and Edge (Safari never offers it).
//
// Left alone, Chrome shows its own install bar, which some versions give no way
// to dismiss. Instead we catch the browser's offer, stop its bar, and show our
// own invitation on the Dashboard with Install / Not now, plus an "Install app"
// button under Settings → About for anyone who said not now.
//
// Not offered on test sites (a second Beekeeper icon wired to the test database
// is too easy to mistake for the real one) or inside the Android app (it never
// fires there; the Play Store app is the install).

import { IS_TEST_SITE } from './testSite';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SNOOZE_KEY = 'beekeeper_install_snoozed_until';
const SNOOZE_DAYS = 30;

let offer: InstallPromptEvent | null = null;
let installedThisSession = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** Call once at startup, before React renders: the browser's offer can arrive early. */
export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // no automatic browser bar
    if (IS_TEST_SITE) return;
    offer = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    installedThisSession = true;
    notify();
  });
}

/**
 * What Settings → About should say about installing, for this device:
 *  test        installing is off on test sites
 *  native      running inside the Android app
 *  installed   already running as (or just became) an installed app
 *  available   the browser offers an install right now
 *  ios         iPhone/iPad: Safari's Share → Add to Home Screen
 *  waiting     Chrome-family browser not offering yet (or already installed)
 *  unsupported a browser that can't install sites (e.g. Firefox)
 */
export type InstallState = 'test' | 'native' | 'installed' | 'available' | 'ios' | 'waiting' | 'unsupported';

export function installState(): InstallState {
  if (IS_TEST_SITE) return 'test';
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return 'native';
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone || installedThisSession) return 'installed';
  if (offer) return 'available';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if ('onbeforeinstallprompt' in window) return 'waiting';
  return 'unsupported';
}

function snoozed(): boolean {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

/** True when the Dashboard invitation should show. */
export function shouldInvite(): boolean {
  return offer !== null && !snoozed();
}

/** "Not now": hide the Dashboard invitation for 30 days. */
export function snoozeInstall(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // Storage blocked: the invitation is still hidden until the page reloads.
  }
  notify();
}

/** Show the browser's own install dialog. The offer can only be used once. */
export async function installApp(): Promise<void> {
  const current = offer;
  if (!current) return;
  offer = null;
  await current.prompt();
  await current.userChoice;
  notify();
}

/** Re-render when the offer arrives, is used, or is snoozed. */
export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
