import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initWebNotifications } from './services/notificationService';
import { Analytics } from "@vercel/analytics/react";

// Initialize Notifications
initWebNotifications().catch(console.error);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
);
