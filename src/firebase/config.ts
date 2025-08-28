import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef123456",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-XXXXXXXXXX",
};

// Check if all required environment variables are present
const isConfigValid = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                     process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                     process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

// Initialize Firebase only if config is valid or in development
let app: any = null;
let db: any = null;
let auth: any = null;
let storage: any = null;

if (isConfigValid || process.env.NODE_ENV === 'development') {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.warn('Firebase initialization failed:', error);
    // Initialize with demo config for build purposes
    if (!app) {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      db = getFirestore(app);
      auth = getAuth(app);
      storage = getStorage(app);
    }
  }
} else {
  console.warn('Firebase environment variables not found. Using demo configuration for build.');
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

// Set auth persistence to LOCAL (survives browser restarts)
if (typeof window !== 'undefined' && auth) {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('Firebase Auth persistence set to LOCAL');
    })
    .catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
}

// Connect to emulators if in development and emulators are enabled
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' && app && db && auth && storage) {
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