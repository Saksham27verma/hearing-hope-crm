import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Helper function to sanitize environment variables (remove newlines and whitespace)
const sanitizeEnvVar = (value: string | undefined): string | undefined => {
  if (!value) return value;
  return value.replace(/\n/g, '').replace(/\r/g, '').trim();
};

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) || "demo-api-key",
  authDomain: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || "demo-project.firebaseapp.com",
  projectId: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || "demo-project",
  storageBucket: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || "demo-project.appspot.com",
  messagingSenderId: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || "123456789",
  appId: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) || "1:123456789:web:abcdef123456",
  measurementId: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) || "G-XXXXXXXXXX",
};

// Check if all required environment variables are present
const isConfigValid = sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) && 
                     sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
                     sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_APP_ID) &&
                     sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) !== "demo-api-key";

// Initialize Firebase
let app: any = null;
let db: any = null;
let auth: any = null;
let storage: any = null;

try {
  if (isConfigValid) {
    console.log('Initializing Firebase with valid configuration');
    console.log('Project ID:', firebaseConfig.projectId);
    console.log('Auth Domain:', firebaseConfig.authDomain);
    
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    console.log('Firebase initialized successfully');
  } else {
    console.warn('Firebase environment variables not found or using demo values.');
    console.warn('Available env vars:', {
      hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      hasAppId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      projectId: sanitizeEnvVar(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    });
    
    if (process.env.NODE_ENV === 'development') {
      // In development, still try to initialize for testing
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      db = getFirestore(app);
      auth = getAuth(app);
      storage = getStorage(app);
    } else {
      throw new Error('Firebase configuration invalid in production');
    }
  }
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.error('Firebase config being used:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    apiKeyLength: firebaseConfig.apiKey?.length || 0
  });
  
  // Create fallback objects to prevent app crashes
  app = null;
  db = null;
  auth = null;
  storage = null;
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