import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

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

export function adminMessaging() {
  initAdminApp();
  return getMessaging();
}

function resolveStorageBucketName(): string | undefined {
  const raw =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    '';
  const trimmed = raw.replace(/^gs:\/\//, '').trim();
  return trimmed || undefined;
}

export function adminStorageBucket() {
  initAdminApp();
  const name = resolveStorageBucketName();
  return name ? getStorage().bucket(name) : getStorage().bucket();
}

