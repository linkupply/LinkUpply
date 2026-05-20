import {StrictMode} from 'react';

// Global error catcher for UI debugging
window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="color:red; padding:20px; font-family:monospace; word-break:break-all;"><b>FATAL ERROR:</b> ${e.message}<br/>${e.filename}:${e.lineno}<br/><pre>${e.error?.stack}</pre></div>`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="color:red; padding:20px; font-family:monospace; word-break:break-all;"><b>PROMISE REJECTION:</b> ${e.reason?.message || e.reason}<br/><pre>${e.reason?.stack}</pre></div>`;
  }
});

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initWebNotifications } from './services/notificationService';
import { Analytics } from "@vercel/analytics/react";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then((registration) => {
      // SW registered
    }).catch((registrationError) => {
      // SW failed
    });
  });
}

// Initialize Notifications
initWebNotifications().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
