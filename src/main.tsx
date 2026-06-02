import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'

// Google Analytics (gtag.js) Dynamic Loader
const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-4WLKRJRNHY';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
