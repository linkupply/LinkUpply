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
      console.log('SW registered:', registration);
    }).catch((registrationError) => {
      console.log('SW registration failed:', registrationError);
    });
  });
}

// Initialize Notifications
initWebNotifications().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
