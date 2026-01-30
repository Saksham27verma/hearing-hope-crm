import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initAdminApp() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // Prefer explicit service account env vars (works on Vercel).
  if (projectId && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return;
  }

  // Fallback (works on Google runtimes / local if GOOGLE_APPLICATION_CREDENTIALS is set).
  initializeApp({
    credential: applicationDefault(),
  });
}

export function adminAuth() {
  initAdminApp();
  return getAuth();
}

export function adminDb() {
  initAdminApp();
  return getFirestore();
}

