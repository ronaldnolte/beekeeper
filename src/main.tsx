import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { MilestoneZero } from './MilestoneZero';

// SPEC A §2 step 2: register the service worker after window load (web only).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MilestoneZero />
  </StrictMode>,
);
