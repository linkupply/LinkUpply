import {StrictMode} from 'react';
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
