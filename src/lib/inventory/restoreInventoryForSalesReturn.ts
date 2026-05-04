import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getHeadOfficeId } from '@/utils/centerUtils';
import type { SalesReturnRestoreRow } from '@/lib/enquiries/salesReturnVisitTargets';

function normalizeSerial(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

async function serialAlreadyInMaterialInward(db: Firestore, serial: string): Promise<boolean> {
  const want = normalizeSerial(serial);
  if (!want) return false;
  const snap = await getDocs(collection(db, 'materialInward'));
  for (const d of snap.docs) {
    const products = Array.isArray(d.data().products) ? d.data().products : [];
    for (const p of products) {
      const rec = p as { serialNumbers?: string[] };
      const sns = Array.isArray(rec.serialNumbers) ? rec.serialNumbers : [];
      for (const sn of sns) {
        const parts = String(sn || '')
          .split(/[,;|]+/)
          .map((x) => normalizeSerial(x))
          .filter(Boolean);
        if (parts.some((x) => x === want) || normalizeSerial(String(sn)) === want) return true;
      }
    }
  }
  return false;
}

/**
 * Append returned serial(s) to `materialInward` at the given center (or head office fallback).
 * Idempotent: skips if serial already appears in any materialInward line.
 */
export async function restoreInventoryForSalesReturnRows(
  db: Firestore,
  rows: SalesReturnRestoreRow[]
): Promise<{ restored: number; skipped: number; errors: string[] }> {
  let restored = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const centerId = String(row.soldFromCenterId || '').trim() || (await getHeadOfficeId());
    try {
      if (await serialAlreadyInMaterialInward(db, row.serialNumber)) {
        skipped += 1;
        continue;
      }

      const snap = await getDocs(collection(db, 'materialInward'));
      const atCenter = snap.docs.filter((d) => String(d.data().location || '').trim() === centerId);

      let updatedDocId: string | null = null;
      let updatedProducts: unknown[] | null = null;

      for (const d of atCenter) {
        const data = d.data();
        const products = Array.isArray(data.products) ? [...data.products] : [];
        let changed = false;
        for (let i = 0; i < products.length; i++) {
          const p = products[i] as Record<string, unknown>;
          if (String(p.productId || '') !== row.productId) continue;
          const sns = Array.isArray(p.serialNumbers) ? [...(p.serialNumbers as string[])] : [];
          if (!sns.includes(row.serialNumber)) {
            sns.push(row.serialNumber);
            products[i] = { ...p, serialNumbers: sns };
            changed = true;
            updatedDocId = d.id;
            updatedProducts = products;
            break;
          }
        }
        if (changed && updatedDocId) break;
      }

      if (updatedDocId && updatedProducts) {
        await updateDoc(doc(db, 'materialInward', updatedDocId), {
          products: updatedProducts,
          updatedAt: serverTimestamp(),
        });
        restored += 1;
        continue;
      }

      // Append new product row on most recent inward at this center
      const targetDoc = atCenter.sort(
        (a, b) => (b.data().receivedDate?.seconds || 0) - (a.data().receivedDate?.seconds || 0)
      )[0];

      if (targetDoc) {
        const data = targetDoc.data();
        const products = Array.isArray(data.products) ? [...data.products] : [];
        products.push({
          productId: row.productId,
          name: row.productName,
          type: 'Hearing Aid',
          serialNumbers: [row.serialNumber],
          quantity: 1,
          dealerPrice: 0,
          mrp: 0,
          discountPercent: 0,
          discountAmount: 0,
          finalPrice: 0,
          gstApplicable: false,
          remarks: 'CRM sales return (auto)',
        });
        await updateDoc(doc(db, 'materialInward', targetDoc.id), {
          products,
          updatedAt: serverTimestamp(),
        });
        restored += 1;
        continue;
      }

      const ho = await getHeadOfficeId();
      const challanNumber = `SR-AUTO-${Date.now().toString(36)}`;
      await addDoc(collection(db, 'materialInward'), {
        challanNumber,
        supplier: { id: 'sales-return', name: 'Sales Return' },
        company: '',
        location: centerId || ho,
        products: [
          {
            productId: row.productId,
            name: row.productName,
            type: 'Hearing Aid',
            serialNumbers: [row.serialNumber],
            quantity: 1,
            dealerPrice: 0,
            mrp: 0,
            discountPercent: 0,
            discountAmount: 0,
            finalPrice: 0,
            gstApplicable: false,
            remarks: 'CRM sales return (auto — no existing inward at center)',
          },
        ],
        totalAmount: 0,
        status: 'received',
        receivedDate: serverTimestamp(),
        notes: 'Auto-created on enquiry sales return',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      restored += 1;
    } catch (e) {
      errors.push(
        `${row.serialNumber}: ${e instanceof Error ? e.message : 'unknown error'}`
      );
    }
  }

  return { restored, skipped, errors };
}
