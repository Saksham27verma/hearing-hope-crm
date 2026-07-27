#!/usr/bin/env node
/**
 * Backfill all existing (non-cancelled) CRM `sales` documents into the lifecycle app.
 * Safe to re-run: the lifecycle ingest endpoint upserts by `crmSaleId`.
 *
 * Usage:
 *   node scripts/backfill-lifecycle-sales.js
 *
 * Required env (loaded from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *   LIFECYCLE_APP_URL
 *   LIFECYCLE_WEBHOOK_SECRET
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const CONCURRENCY = 5;

function initAdmin() {
  if (admin.apps.length) return;
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('Missing FIREBASE_ADMIN_* env vars');
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function toYmd(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value && typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString().slice(0, 10);
    } catch {}
  }
  const secs = value && (value.seconds ?? value._seconds);
  if (typeof secs === 'number') {
    return new Date(secs * 1000).toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

async function resolveReference(db, sale) {
  const enquiryId = sale.enquiryId ? String(sale.enquiryId) : '';
  if (enquiryId) {
    try {
      const enquirySnap = await db.collection('enquiries').doc(enquiryId).get();
      if (enquirySnap.exists) {
        const enq = enquirySnap.data() || {};
        const refField = enq.reference;
        if (Array.isArray(refField)) {
          const joined = refField.map((r) => String(r).trim()).filter(Boolean).join(', ');
          if (joined) return joined;
        } else if (typeof refField === 'string' && refField.trim()) {
          return refField.trim();
        }
      }
    } catch (err) {
      console.warn(`  ! enquiry ${enquiryId} lookup failed:`, err.message);
    }
  }
  const doctor = sale.referenceDoctor || {};
  return String(doctor.name || '').trim();
}

async function postOne(payload, base, secret) {
  const res = await fetch(`${base}/api/ingest/crm-sale`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json().catch(() => ({}));
}

async function processBatch(batch, base, secret, stats) {
  await Promise.all(
    batch.map(async ({ id, payload }) => {
      try {
        const result = await postOne(payload, base, secret);
        stats.ok++;
        if (result.action === 'created') stats.created++;
        else if (result.action === 'updated') stats.updated++;
      } catch (err) {
        stats.failed++;
        console.error(`  x sale ${id} failed:`, err.message);
      }
    }),
  );
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  const base = (process.env.LIFECYCLE_APP_URL || '').replace(/\/+$/, '');
  const secret = (process.env.LIFECYCLE_WEBHOOK_SECRET || '').trim();
  if (!base) throw new Error('LIFECYCLE_APP_URL not set');
  if (!secret) throw new Error('LIFECYCLE_WEBHOOK_SECRET not set');

  console.log('Backfilling CRM sales -> lifecycle');
  console.log(`  target: ${base}`);

  const snap = await db.collection('sales').get();
  console.log(`  fetched ${snap.size} total sale docs`);

  const stats = { ok: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  let batch = [];

  for (const doc of snap.docs) {
    const sale = doc.data() || {};
    if (sale.cancelled === true) {
      stats.skipped++;
      continue;
    }
    const customerName = String(sale.patientName || '').trim();
    const phone = String(sale.phone || '').trim();
    const saleDate = toYmd(sale.saleDate);
    if (!customerName || !phone || !saleDate) {
      stats.skipped++;
      continue;
    }
    const reference = await resolveReference(db, sale);
    const payload = {
      crmSaleId: doc.id,
      customerName,
      phone,
      saleDate,
      address: String(sale.address || '').trim() || undefined,
      reference: reference || undefined,
      centerId: String(sale.centerId || '').trim() || undefined,
      notes: String(sale.notes || '').trim() || undefined,
      cancelled: false,
    };
    batch.push({ id: doc.id, payload });
    if (batch.length >= CONCURRENCY) {
      await processBatch(batch, base, secret, stats);
      batch = [];
      process.stdout.write(
        `  progress: ok=${stats.ok} created=${stats.created} updated=${stats.updated} failed=${stats.failed} skipped=${stats.skipped}\r`,
      );
    }
  }
  if (batch.length) await processBatch(batch, base, secret, stats);

  console.log('\nDone.');
  console.log(`  ok=${stats.ok}  created=${stats.created}  updated=${stats.updated}  skipped=${stats.skipped}  failed=${stats.failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
