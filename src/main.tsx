import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './app/App.tsx'
import { TestSiteStrip } from './shared/components/TestSiteStrip'
import { reserveTestSiteStrip } from './shared/testSite'
import { loadAnalytics } from './shared/analytics'

// Lets the stylesheet tell the installed app from the website — today only
// for the amber strip behind Android's system buttons (--color-system-bar).
// Set before the first render so the strip never flashes cream first.
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('native');
}

// Test copies (any database other than production) show a reminder strip;
// reserve its height before the first render so nothing jumps.
reserveTestSiteStrip();

// Google Analytics (gtag.js), unless this device has opted out in Settings.
loadAnalytics();

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
