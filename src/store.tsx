import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { registerWebPush } from './services/notificationService';

export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  role?: string;
  bio: string;
  emoji: string;
  linkupId: string;
  photoURL?: string;
  pushToken?: string; // Kept for backwards config
  pushTokens?: string[]; // Array to support multiple devices
  platform?: string;
  isOnline: boolean;
  lastChanged: any;
  lastSeen?: any;
  privacy?: {
    lastSeen: 'everyone' | 'contacts' | 'nobody';
    status: 'everyone' | 'contacts' | 'nobody';
    readReceipts: boolean;
  };
  blockedUsers?: string[];
  securityNotifications?: boolean;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  isLoggingOut: boolean;
  setIsLoggingOut: (val: boolean) => void;
  isDeleting: boolean;
  setIsDeleting: (val: boolean) => void;
  theme: string;
  setTheme: (theme: string) => void;
  logout: () => Promise<void>;
  isNetworkOnline: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isNetworkOnline: true,
  isLoggingOut: false,
  setIsLoggingOut: () => {},
  isDeleting: false,
  setIsDeleting: () => {},
  theme: 'premium', 
  setTheme: () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setTheme = (newTheme: string) => {
    // Theme is now fixed
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'premium');
  }, []);

  useEffect(() => {
    console.log("AuthProvider: Starting auth listener");
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      console.log("AuthProvider: Auth state changed", currentUser?.uid);
      setUser(currentUser);
      setIsLoggingOut(false); // Reset logging out state when auth state changes
      setIsDeleting(false); // Reset deleting state when auth state changes
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    setLoading(true); // Ensure we are loading when a new user is detected
    console.log("AuthProvider: Starting profile listener for", user.uid);
    const userRef = doc(db, 'users', user.uid);
    
    // Heartbeat to keep user online
    const heartbeatInterval = setInterval(async () => {
      if (document.visibilityState === 'visible' && profile) {
        try {
          await updateDoc(userRef, {
            isOnline: true,
            lastSeen: serverTimestamp(),
            lastChanged: serverTimestamp()
          });
        } catch (e) {
          // Ignore
        }
      }
    }, 20000); // Every 20 seconds

    let lastStatus: boolean | null = null;
    let offlineTimeout: any = null;
    const updatePresence = async (online: boolean) => {
      if (lastStatus === online) return;
      
      if (online && offlineTimeout) {
        clearTimeout(offlineTimeout);
        offlineTimeout = null;
      }

      if (online && profile?.isOnline) {
        lastStatus = true;
        return;
      }

      if (!profile) return;

      lastStatus = online;
      
      try {
        if (!online) {
          offlineTimeout = setTimeout(async () => {
            if (document.visibilityState === 'hidden') {
              try {
                await updateDoc(userRef, {
                  isOnline: false,
                  lastChanged: serverTimestamp()
                });
              } catch (e) {
                // Ignore
              }
              offlineTimeout = null;
            }
          }, 10000); // Faster offline detection (10s)
          return;
        }

        await updateDoc(userRef, {
          isOnline: true,
          lastChanged: serverTimestamp()
        });
      } catch (e) {
        if (e instanceof Error && !e.message.includes('not-found')) {
          console.error("Presence update failed", e);
        }
      }
    };

    const timeout = setTimeout(() => updatePresence(true), 1000);

    const handleVisibility = () => {
      updatePresence(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
      console.log("AuthProvider: Profile snapshot received", docSnap.exists());
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        setLoading(false); // Only set loading false if we have data

        // Check if we have a stored FCM token and it's not in the profile
        const storedToken = localStorage.getItem('fcm_token');
        if (storedToken && data.pushToken !== storedToken) {
          try {
            await updateDoc(userRef, { pushToken: storedToken });
          } catch (e) {
            console.error("Error updating profile with stored FCM token:", e);
          }
        }
        
        // Also ensure web push is registered
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'denied') {
          registerWebPush().catch(console.error);
        }
      } else {
        setProfile(null);
        setLoading(false); // Or if we are sure it doesn't exist
      }
    }, (err) => {
      console.error("Profile listener error:", err);
      // Don't set loading false on transient errors
      if (err.code === 'permission-denied') {
        setProfile(null);
        setLoading(false);
      }
      // For other errors (like network), we keep loading true so the safety timeout handles it
      // or the user stays on the loading screen instead of seeing the setup screen
    });

    // Safety timeout to ensure loading state resolves
    const safetyTimeout = setTimeout(() => {
      console.log("AuthProvider: Safety timeout reached, forcing loading false");
      setLoading(false);
    }, 15000); // Increased to 15 seconds for slower connections

    const handleUnload = () => {
      updatePresence(false);
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      clearTimeout(timeout);
      clearTimeout(safetyTimeout);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribeProfile();
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [user]);

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          isOnline: false,
          lastChanged: serverTimestamp()
        });
      }
      await auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
      await auth.signOut();
    } finally {
      // Don't set isLoggingOut(false) here, let the auth listener do it
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isLoggingOut, setIsLoggingOut, isDeleting, setIsDeleting, theme: 'premium', setTheme, logout, isNetworkOnline }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
