'use client';

export async function notifyAdminsNewSale(saleId: string): Promise<void> {
  const cleanId = String(saleId || '').trim();
  if (!cleanId) return;
  try {
    const { auth } = await import('@/firebase/config');
    const user = auth?.currentUser;
    if (!user) return;
    const idToken = await user.getIdToken();
    await fetch('/api/notifications/new-sale', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ saleId: cleanId }),
    });
  } catch (err) {
    console.warn('notifyAdminsNewSale failed:', err);
  }
}

