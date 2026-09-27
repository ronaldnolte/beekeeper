// Google Analytics 4, loaded at startup (SPEC A §11). The Profile opt-out is stored but not
// read yet — deliberately (DESIGN-REQUIREMENTS §8). Never the forecast app's G-H60164WT45.

const FALLBACK_ID = 'G-V3F9W1WQT0';

type Gtag = (...args: unknown[]) => void;

export function loadAnalytics() {
  // Local development only: keep test traffic out of the real statistics.
  if (import.meta.env.DEV) return;
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID || FALLBACK_ID;
  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // gtag.js expects the arguments object itself.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  w.gtag('js', new Date());
  w.gtag('config', id);
}
