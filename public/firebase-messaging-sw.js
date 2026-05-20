importScripts(
  "https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore-compat.js",
);

const firebaseConfig = {
  apiKey: "AIzaSyAcRg7TU3CXGCpZTzX9QA8KaX_TgAYQaIU",
  authDomain: "linkup-4ffb4.firebaseapp.com",
  projectId: "linkup-4ffb4",
  storageBucket: "linkup-4ffb4.firebasestorage.app",
  messagingSenderId: "997540535836",
  appId: "1:997540535836:web:37dfbcbd2d32515a2c49d9",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Required for PWA WebAPK generation on Android
self.addEventListener('fetch', (event) => {
  // Empty fetch handler is enough to satisfy the PWA installability requirements
  // though typically you'd want to serve offline fallback pages here.
});

messaging.onBackgroundMessage((payload) => {
  console.log("FCM Background Message Received:", payload);

  if (payload.data) {
    const data = payload.data;
    const fallbackIcon = "https://linkupply-4ffb4.web.app/icon-192.png";
    const userIcon =
      data.icon && data.icon.startsWith("http") ? data.icon : fallbackIcon;

    const options = {
      body: data.body,
      icon: userIcon,
      badge: fallbackIcon, // Must be small, transparent, monochrome ideally
      data: data, // Pass data for click handling
      actions: [
        {
          action: "reply",
          title: "Reply",
        },
        {
          action: "mark_read",
          title: "Mark as Read",
        },
      ],
    };

    self.registration.showNotification(
      data.title || "New Message",
      options,
    );
  }
});

// Helper to get current user via a Promise
function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const senderId = event.notification.data?.senderId;
  const replyText = event.reply;

  if (event.action === "reply" || !event.action) {
    const targetUrl = "/";
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((windowClients) => {
          for (let i = 0; i < windowClients.length; i++) {
            let client = windowClients[i];
            if (client.url.indexOf(targetUrl) !== -1 && "focus" in client) {
              client.postMessage({ type: "OPEN_CHAT", senderId });
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        }),
    );
  } else if (event.action === "mark_read") {
    console.log("Mark read clicked via background SW");
    event.waitUntil(
      (async () => {
        try {
          const user = await getCurrentUser();
          if (!user || !senderId) return;
          const chatId =
            user.uid === "linkup_official"
              ? "official_broadcast"
              : [user.uid, senderId].sort().join("_");

          await db
            .collection("chats")
            .doc(chatId)
            .update({
              [`unread.${user.uid}`]: firebase.firestore.FieldValue.delete(),
            });
        } catch (e) {
          console.error("SW Mark Read error", e);
        }
      })(),
    );
  }
});
