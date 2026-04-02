import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type SaleVisitProductUpdate =
  | { type: 'serial'; productId: string; serialNumber: string }
  | { type: 'quantity'; productId: string; quantity: number };

type MaterialInwardRestorePreview = {
  materialInwardDocId: string;
  productId: string;
  serialsToAdd: string[];
  quantityToAdd: number;
};

function getIsSaleVisit(visit: Record<string, unknown> | null | undefined): boolean {
  if (!visit) return false;
  return Boolean((visit as any).hearingAidSale || (visit as any).purchaseFromTrial || (visit as any).hearingAidStatus === 'sold');
}

function toNonEmptyString(v: unknown): string {
  const s = String(v ?? '').trim();
  return s;
}

function collectSaleProductsFromEnquiry(enquiry: Record<string, unknown>): SaleVisitProductUpdate[] {
  const visits = Array.isArray(enquiry.visits) ? (enquiry.visits as Record<string, unknown>[]) : Array.isArray(enquiry.visitSchedules) ? (enquiry.visitSchedules as Record<string, unknown>[]) : [];
  const updates: SaleVisitProductUpdate[] = [];

  visits.forEach((visit: Record<string, unknown>, idx: number) => {
    if (!getIsSaleVisit(visit)) return;
    const products = Array.isArray(visit.products) ? (visit.products as any[]) : [];
    if (!products.length) return;

    products.forEach((product: any) => {
      const productId = toNonEmptyString(product.productId ?? product.id);
      if (!productId) return;

      const serialNumber = toNonEmptyString(product.serialNumber ?? '');
      if (serialNumber) {
        updates.push({ type: 'serial', productId, serialNumber });
        return;
      }

      const quantity = Number(product.quantity ?? 0);
      if (Number.isFinite(quantity) && quantity > 0) {
        updates.push({ type: 'quantity', productId, quantity });
      }
    });
  });

  return updates;
}

function uniqueSerialUpdates(updates: SaleVisitProductUpdate[]): { serialsByProductId: Map<string, Set<string>>; quantitiesByProductId: Map<string, number> } {
  const serialsByProductId = new Map<string, Set<string>>();
  const quantitiesByProductId = new Map<string, number>();

  updates.forEach((u) => {
    if (u.type === 'serial') {
      if (!serialsByProductId.has(u.productId)) serialsByProductId.set(u.productId, new Set());
      serialsByProductId.get(u.productId)!.add(u.serialNumber);
    } else {
      quantitiesByProductId.set(u.productId, (quantitiesByProductId.get(u.productId) || 0) + u.quantity);
    }
  });

  return { serialsByProductId, quantitiesByProductId };
}

async function restoreInventoryFromSaleVisits({
  db,
  updates,
  apply,
}: {
  db: Firestore;
  updates: SaleVisitProductUpdate[];
  apply: boolean;
}): Promise<{
  updatedMaterialInwardDocs: number;
  restoredSerials: number;
  restoredQuantityLines: number;
  restoredQuantityTotal: number;
  materialInwardRestorePreview: MaterialInwardRestorePreview[];
}> {
  const { serialsByProductId, quantitiesByProductId } = uniqueSerialUpdates(updates);
  if (serialsByProductId.size === 0 && quantitiesByProductId.size === 0) {
    return {
      updatedMaterialInwardDocs: 0,
      restoredSerials: 0,
      restoredQuantityLines: 0,
      restoredQuantityTotal: 0,
      materialInwardRestorePreview: [],
    };
  }

  const materialSnap = await db.collection('materialInward').get();
  let updatedMaterialInwardDocs = 0;
  let restoredSerials = 0;
  let restoredQuantityLines = 0;
  let restoredQuantityTotal = 0;

  // Remaining items to restore, so each serial/quantity is added only once.
  const remainingSerialsByProductId = new Map<string, Set<string>>();
  serialsByProductId.forEach((set, pid) => remainingSerialsByProductId.set(pid, new Set(Array.from(set))));

  const remainingQuantityByProductId = new Map<string, number>(quantitiesByProductId);

  const materialInwardRestorePreview: MaterialInwardRestorePreview[] = [];

  // Build in-memory updated products arrays so we can batch write once per doc.
  const docUpdates = new Map<string, any[]>();

  materialSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const products = Array.isArray((data as any).products) ? ((data as any).products as any[]) : [];
    if (!products.length) return;

    let changed = false;
    const newProducts = products.map((p) => {
      const productId = toNonEmptyString(p.productId ?? p.id);
      if (!productId) return p;

      const serialSet = remainingSerialsByProductId.get(productId);
      if (serialSet && serialSet.size > 0) {
        const existingSerials: string[] = Array.isArray(p.serialNumbers)
          ? (p.serialNumbers as string[]).map((sn) => String(sn).trim()).filter(Boolean)
          : p.serialNumber
            ? [toNonEmptyString(p.serialNumber)]
            : [];

        const existingSet = new Set(existingSerials);
        const toAdd: string[] = [];
        serialSet.forEach((sn) => {
          if (!existingSet.has(sn)) toAdd.push(sn);
        });

        if (toAdd.length > 0) {
          const merged = [...existingSerials, ...toAdd];
          restoredSerials += toAdd.length;
          changed = true;

          // Normalize to `serialNumbers` representation.
          // Mark these serials as restored so they won't be added again to other materialInward docs.
          toAdd.forEach((sn) => serialSet.delete(sn));

          materialInwardRestorePreview.push({
            materialInwardDocId: docSnap.id,
            productId,
            serialsToAdd: [...toAdd],
            quantityToAdd: 0,
          });
          return {
            ...p,
            serialNumbers: merged,
            serialNumber: undefined,
          };
        }
      }

      const qtyToAdd = remainingQuantityByProductId.get(productId);
      if (qtyToAdd && qtyToAdd > 0) {
        const q = Number(p.quantity ?? 0);
        if (Number.isFinite(q)) {
          // Add the remaining quantity only once (to the first matching batch line we encounter).
          const nextQ = q + qtyToAdd;
          restoredQuantityLines += 1;
          restoredQuantityTotal += qtyToAdd;
          changed = true;
          remainingQuantityByProductId.set(productId, 0);

          materialInwardRestorePreview.push({
            materialInwardDocId: docSnap.id,
            productId,
            serialsToAdd: [],
            quantityToAdd: qtyToAdd,
          });
          return { ...p, quantity: nextQ };
        }
      }

      return p;
    });

    if (changed) {
      docUpdates.set(docSnap.id, newProducts);
    }
  });

  // Safety: if we didn't find any doc to update (e.g., materialInward missing productId),
  // we can't recreate history reliably here.
  if (docUpdates.size === 0) {
    return {
      updatedMaterialInwardDocs: 0,
      restoredSerials,
      restoredQuantityLines,
      restoredQuantityTotal,
      materialInwardRestorePreview: [],
    };
  }

  // Dry-run: do not write anything; just return what would be updated.
  if (!apply) {
    return {
      updatedMaterialInwardDocs: docUpdates.size,
      restoredSerials,
      restoredQuantityLines,
      restoredQuantityTotal,
      materialInwardRestorePreview,
    };
  }

  const updatesArray = Array.from(docUpdates.entries());
  for (let i = 0; i < updatesArray.length; i += 450) {
    const chunk = updatesArray.slice(i, i + 450);
    const batch = db.batch();
    chunk.forEach(([docId, newProducts]) => {
      batch.update(db.collection('materialInward').doc(docId), {
        products: newProducts,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    updatedMaterialInwardDocs += chunk.length;
  }

  return {
    updatedMaterialInwardDocs,
    restoredSerials,
    restoredQuantityLines,
    restoredQuantityTotal,
    materialInwardRestorePreview,
  };
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden: user profile not found in `users` collection', 403);
    assertAdmin(requester);

    const body = (await req.json().catch(() => null)) as { enquiryId?: string; dryRun?: boolean } | null;
    const enquiryId = toNonEmptyString(body?.enquiryId);
    const dryRun = Boolean(body?.dryRun);
    if (!enquiryId) return jsonError('enquiryId is required', 400);

    const db = adminDb();
    const enquirySnap = await db.collection('enquiries').doc(enquiryId).get();
    if (!enquirySnap.exists) return jsonError('Enquiry not found', 404);

    const enquiry = enquirySnap.data() as Record<string, unknown>;

    // 1) Restore inventory for sale visits
    const saleProductsUpdates = collectSaleProductsFromEnquiry(enquiry);
    const restoreResult = await restoreInventoryFromSaleVisits({
      db,
      updates: saleProductsUpdates,
      apply: !dryRun,
    });

    // 2) Delete linked sales docs (Sales & Invoicing relies on this collection)
    const salesSnap = await db.collection('sales').where('enquiryId', '==', enquiryId).get();
    const salesDocs = salesSnap.docs;

    const salesPreview = salesDocs.slice(0, 20).map((d) => {
      const s = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        invoiceNumber: String(s.invoiceNumber ?? ''),
        enquiryVisitIndex: s.enquiryVisitIndex,
      };
    });

    if (dryRun) {
      // 3) Compute visitor count (dry-run only)
      const visitorsSnap1 = await db.collection('visitors').where('enquiryId', '==', enquiryId).get();
      const visitorsSnap2 = await db.collection('visitors').where('relatedEnquiryId', '==', enquiryId).get().catch(() => null);
      const visitorsDocs = [...visitorsSnap1.docs, ...(visitorsSnap2?.docs || [])];
      const seen = new Set<string>();
      const uniqueVisitorsCount = visitorsDocs.filter((d) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      }).length;

      return NextResponse.json({
        ok: true,
        dryRun: true,
        restoreResult,
        deletedSalesCount: salesDocs.length,
        salesPreview,
        deletedVisitorsCount: uniqueVisitorsCount,
        deletedEnquiryId: enquiryId,
      });
    }

    for (let i = 0; i < salesDocs.length; i += 450) {
      const chunk = salesDocs.slice(i, i + 450);
      const batch = db.batch();
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 3) Delete linked visitor records
    const visitorsSnap1 = await db.collection('visitors').where('enquiryId', '==', enquiryId).get();
    const visitorsSnap2 = await db.collection('visitors').where('relatedEnquiryId', '==', enquiryId).get().catch(() => null);
    const visitorsDocs = [...visitorsSnap1.docs, ...(visitorsSnap2?.docs || [])];

    // De-dup by doc id
    const seen = new Set<string>();
    const uniqueVisitors = visitorsDocs.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
    for (let i = 0; i < uniqueVisitors.length; i += 450) {
      const chunk = uniqueVisitors.slice(i, i + 450);
      const batch = db.batch();
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 4) Delete enquiry last (so we still have the visits data for restoration)
    await db.collection('enquiries').doc(enquiryId).delete();

    return NextResponse.json({
      ok: true,
      dryRun: false,
      restored: restoreResult,
      deletedSalesCount: salesDocs.length,
      deletedVisitorsCount: uniqueVisitors.length,
      deletedEnquiryId: enquiryId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to purge enquiry with inventory rollback';
    console.error('purge-enquiry-with-inventory error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}

