import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'

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
    <App />
  </StrictMode>,
)
