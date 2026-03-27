/**
 * Creates `invoiceSettings/default` — single source of truth for sequential invoice numbers.
 *
 * Usage (from hearing-hope-crm): node scripts/seed-invoice-settings.js
 * Requires .env.local with Firebase keys (same as other seed scripts).
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const year = new Date().getFullYear();

async function main() {
  const ref = doc(db, 'invoiceSettings', 'default');
  await setDoc(
    ref,
    {
      prefix: 'INV-',
      suffix: `/${year}`,
      next_number: 1,
      padding: 4,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  console.log('invoiceSettings/default ensured:', { prefix: 'INV-', suffix: `/${year}`, next_number: 1, padding: 4 });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
