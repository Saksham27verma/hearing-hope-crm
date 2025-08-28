import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Set auth persistence to LOCAL (survives browser restarts)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase Auth persistence set to LOCAL');
    })
    .catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
}

// Connect to emulators if in development and emulators are enabled
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
  // Connect to Firestore emulator
  if (process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_URL) {
    const [host, portStr] = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_EMULATOR_URL.split(':');
    const port = parseInt(portStr, 10);
    connectFirestoreEmulator(db, host, port);
    console.log(`Connected to Firestore emulator at ${host}:${port}`);
  }

  // Connect to Auth emulator
  if (process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL) {
    connectAuthEmulator(auth, process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL);
    console.log(`Connected to Auth emulator at ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL}`);
  }

  // Connect to Storage emulator
  if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_URL) {
    const [host, portStr] = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_URL.split(':');
    const port = parseInt(portStr, 10);
    connectStorageEmulator(storage, host, port);
    console.log(`Connected to Storage emulator at ${host}:${port}`);
  }
}

export { app, db, auth, storage }; 