import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './app/App.tsx'
import { TestSiteStrip } from './shared/components/TestSiteStrip'
import { reserveTestSiteStrip } from './shared/testSite'

// Lets the stylesheet tell the installed app from the website — today only
// for the amber strip behind Android's system buttons (--color-system-bar).
// Set before the first render so the strip never flashes cream first.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native');
}

// Test copies (any database other than production) show a reminder strip;
// reserve its height before the first render so nothing jumps.
reserveTestSiteStrip();

// Google Analytics (gtag.js) Dynamic Loader
const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-V3F9W1WQT0';
if (gaId && typeof window !== 'undefined') {
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  const dataLayer = ((window as any).dataLayer = (window as any).dataLayer || []);
  const gtag = ((window as any).gtag = function () {
    dataLayer.push(arguments);
  });
  (gtag as any)('js', new Date());
  (gtag as any)('config', gaId);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TestSiteStrip />
    <App />
  </StrictMode>,
)
