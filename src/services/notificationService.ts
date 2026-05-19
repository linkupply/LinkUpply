import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";

export const registerWebPush = async () => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
        
        let permission = Notification.permission;
        if (permission !== 'granted' && permission !== 'denied') {
             permission = await Notification.requestPermission();
        }

        if (permission === 'granted') {
          try {
             const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
             console.log('Service Worker registered successfully!', registration);
             
             const { auth, db, messaging } = await import("../firebase");
             if (auth.currentUser && messaging) {
                const { getToken } = await import("firebase/messaging");
                const currentToken = await getToken(messaging, { 
                  vapidKey: "BL9Mv__dKofjB-uA2T7hssYwS6Xm06lJ2-F_jVv-oOpx7gN8P5x0gD9xV9OqZzH96jB0p_n6-yYw9zHqXmJ45lY",
                  serviceWorkerRegistration: registration 
                }).catch((e) => {
                  console.error('Error getting token', e);
                  return null;
                });

                if (currentToken) {
                  const userRef = doc(db, "users", auth.currentUser.uid);
                  await updateDoc(userRef, {
                    pushToken: currentToken, 
                    pushTokens: arrayUnion(currentToken),
                    platform: "web",
                    lastSeen: serverTimestamp(),
                  }).catch((err) => console.error("Error saving web token:", err));
                  console.log("FCM Token saved successfully to Firestore:", currentToken);
                }
             }
          } catch(err) {
             console.log('FCM generic error', err);
          }
        } else {
          console.log('Notification permission not granted.');
        }
      }
    } catch (e) {
      console.log('Web Push init error:', e);
    }
};

export const initWebNotifications = async () => {
  // Always attempt web push registration for web app initialization
  setTimeout(() => {
    registerWebPush().catch(console.error);
  }, 2000);
  
  // Setup window focus listener to update status
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', async () => {
      try {
        const { auth, db } = await import("../firebase");
        if (auth.currentUser) {
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            isOnline: true,
            lastSeen: serverTimestamp(),
          }).catch((err) => console.error("Status update error:", err));
        }
      } catch (e) {}
    });
    window.addEventListener('blur', async () => {
      try {
        const { auth, db } = await import("../firebase");
        if (auth.currentUser) {
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            isOnline: false,
            lastSeen: serverTimestamp(),
          }).catch((err) => console.error("Status update error:", err));
        }
      } catch (e) {}
    });
  }
};

export const showSystemNotification = async (
  title: string,
  body: string,
  senderId?: string,
  photoURL?: string,
  platformOverride?: string
) => {
  // Prevent duplicate notifications if chat is open
  const activeChatWith = localStorage.getItem("active_chat_with");
  const windowActiveChat = (window as any).activeChatWith;
  const chatContainer = document.getElementById("active-chat-container");
  const domActiveChat = chatContainer ? chatContainer.getAttribute("data-chat-with") : null;

  const sId = String(senderId || '').trim();
  const isChatActive =
    (activeChatWith && String(activeChatWith).trim() === sId) ||
    (windowActiveChat && String(windowActiveChat).trim() === sId) ||
    (domActiveChat && String(domActiveChat).trim() === sId);

  if (isChatActive) {
    console.log("Suppressing notification: User is already viewing chat with", senderId);
    return;
  }

  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
       new Notification(title, {
          body: body,
          icon: photoURL || '/icon-192.png'
       });
    }
  } catch(e) {
    console.log('Web notification error:', e);
  }
};

export const triggerHaptic = async () => {
  // Try to use browser vibration API if available
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  } catch (e) {}
};

export const requestMediaPermissions = async (type: "voice" | "video") => {
  console.log(`Requesting ${type} permissions on web`);
};
