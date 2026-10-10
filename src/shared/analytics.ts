// Google Analytics, gated on the beekeeper's "Don't count my usage" choice.
//
// The choice is stored on the profile (profiles.analytics_opt_out), but the
// loader runs before anyone has signed in. So each device also keeps a copy in
// localStorage: it is written whenever the profile is read or the switch is
// flipped, and read here at startup. Google's own `ga-disable-<id>` flag stops
// any further hits at once when someone opts out mid-session.

const GA_ID: string = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-V3F9W1WQT0';
const OPT_OUT_KEY = 'beekeeper_analytics_opt_out';

type GtagWindow = Window & Record<string, unknown> & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
const w = (): GtagWindow => window as unknown as GtagWindow;

let loaded = false;

function readOptOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Load gtag.js unless this device has opted out. Call once at startup. */
export function loadAnalytics(): void {
  if (typeof window === 'undefined' || !GA_ID || loaded) return;
  if (readOptOut()) {
    w()[`ga-disable-${GA_ID}`] = true;
    return;
  }
  loaded = true;
  w()[`ga-disable-${GA_ID}`] = false;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  const win = w();
  win.dataLayer = win.dataLayer || [];
  const dataLayer = win.dataLayer;
  win.gtag = function gtag() {
    // gtag.js reads the arguments object itself, so push it as-is.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  win.gtag('js', new Date());
  win.gtag('config', GA_ID);
}

/** Apply a choice now and remember it on this device. Opting back in loads analytics. */
export function setAnalyticsOptOut(optOut: boolean): void {
  if (typeof window === 'undefined' || !GA_ID) return;
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, '1');
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // Storage blocked: the choice still applies for this session below.
  }
  w()[`ga-disable-${GA_ID}`] = optOut;
  if (!optOut) loadAnalytics();
}
