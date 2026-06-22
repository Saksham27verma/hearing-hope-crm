import { adminAuth } from '@/server/firebaseAdmin';

function firebaseWebApiKey(): string {
  const key = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '').trim();
  if (!key || key === 'demo-api-key') {
    throw new Error('Firebase API key is not configured');
  }
  return key;
}

/** Send Firebase password-reset email via Identity Toolkit (works server-side). */
export async function sendPasswordResetEmailServer(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Email is required');

  // Ensure the Auth account exists before triggering reset (clearer errors than REST alone).
  await adminAuth().getUserByEmail(normalized);

  const apiKey = firebaseWebApiKey();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: normalized,
      }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data?.error?.message || 'Failed to send password reset email');
  }
}
