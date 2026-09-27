// Where the app is running. The packaged phone app has no server of its own (its origin is
// https://localhost on Android, capacitor://localhost on iOS), so it calls production by
// absolute address; the website always calls its own server (SCAR S-API-1, S-API-2).

const PRODUCTION_ORIGIN = 'https://beekeeper.beektools.com';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function capacitor(): CapacitorGlobal | undefined {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True inside the packaged Android (or future iOS) app. */
export const isNativeApp = (): boolean => !!capacitor()?.isNativePlatform?.();

export const isAndroidApp = (): boolean => isNativeApp() && capacitor()?.getPlatform?.() === 'android';

/** Prefix for /api calls: empty (same origin) on the web, production in the packaged app. */
export const apiBase = (): string => (isNativeApp() ? PRODUCTION_ORIGIN : '');

/** Where password-reset emails send the user (SPEC A §8). */
export const passwordResetRedirect = (): string =>
  `${isNativeApp() ? PRODUCTION_ORIGIN : window.location.origin}/auth/update-password`;
