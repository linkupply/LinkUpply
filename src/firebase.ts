import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  "apiKey": "AIzaSyAcRg7TU3CXGCpZTzX9QA8KaX_TgAYQaIU",
  "authDomain": "linkup-4ffb4.firebaseapp.com",
  "projectId": "linkup-4ffb4",
  "storageBucket": "linkup-4ffb4.firebasestorage.app",
  "messagingSenderId": "997540535836",
  "appId": "1:997540535836:web:37dfbcbd2d32515a2c49d9",
  "measurementId": "G-D2S564ZS3N",
  "firestoreDatabaseId": "(default)"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Check if firestoreDatabaseId exists and is not empty/default, otherwise use default initialization
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)" 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const storage = getStorage(app);

export let messaging: any = null;
if (typeof window !== 'undefined') {
  import('firebase/messaging').then(({ getMessaging, isSupported }) => {
    isSupported().then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
      }
    });
  });
}
