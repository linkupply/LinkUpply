/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { AuthProvider, useAuth } from './store';
import { Auth } from './components/Auth';
import { Main } from './components/Main';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Logo } from './components/Logo';
import { db } from './firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { InstallPrompt } from './components/InstallPrompt';
import { SplashScreen } from './components/SplashScreen';

function AppContent() {
  const { user, profile, loading, isLoggingOut, isDeleting } = useAuth();
  console.log("AppContent: State", { user: user?.uid, profile: !!profile, loading, isLoggingOut, isDeleting });

  useEffect(() => {
    const handleUnload = () => {
      if (user?.uid) {
        // This is a best-effort update for web/PWA
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { isOnline: false, lastChanged: serverTimestamp() });
      }
    };

    const handleVisibilityChange = () => {
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { 
          isOnline: document.visibilityState === 'visible',
          lastChanged: serverTimestamp(),
          lastSeen: serverTimestamp()
        });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.uid]);

  if (loading || isLoggingOut || isDeleting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white gap-4">
        <Logo className="w-16 h-16 animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-2">Connecting to LinkUpply...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <Auth />;
  }

  return <Main />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <SplashScreen>
        <AuthProvider>
          <AppContent />
          <InstallPrompt />
        </AuthProvider>
      </SplashScreen>
    </ErrorBoundary>
  );
}
