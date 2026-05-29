import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { syncEnquiryVisitSaleLinkFromSale } from '@/lib/sales-invoicing/enquiryVisitInvoiceSync';
import { normalizeEnquiryVisitIndex } from '@/lib/sales-invoicing/saleCancelled';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';

export async function restoreCancelledSale(args: {
  db: Firestore;
  saleId: string;
  actorUid?: string | null;
}): Promise<{ enquiryId?: string; visitIndex?: number; invoiceNumber?: string }> {
  const ref = doc(args.db, 'sales', args.saleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Sale not found');
  const data = snap.data() as Record<string, unknown>;
  const invoiceNumber = normalizeInvoiceNumberString(data.invoiceNumber);

  await updateDoc(ref, {
    cancelled: false,
    cancelledAt: deleteField(),
    cancelledByUid: deleteField(),
    cancelReason: deleteField(),
    supersededByExchangeVisitIndex: deleteField(),
    restoredAt: serverTimestamp(),
    restoredByUid: args.actorUid ?? null,
    updatedAt: serverTimestamp(),
  });

  const enquiryId = String(data.enquiryId || '').trim();
  const visitIndex =
    data.enquiryVisitIndex != null ? normalizeEnquiryVisitIndex(data.enquiryVisitIndex) : undefined;

  if (enquiryId && typeof visitIndex === 'number' && saleHasBillableInvoiceNumber(invoiceNumber)) {
    await syncEnquiryVisitSaleLinkFromSale({
      db: args.db,
      enquiryId,
      visitIndex,
      saleId: args.saleId,
      invoiceNumber,
    });
  }

  return { enquiryId: enquiryId || undefined, visitIndex, invoiceNumber };
}
