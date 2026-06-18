import {
  collection,
  deleteField,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

/** Copy enquiry-level invoice remarks onto every linked `sales` doc (enquiry invoices). */
export async function syncInvoiceRemarksToLinkedSales(
  db: Firestore,
  enquiryId: string,
  invoiceRemarks: unknown,
): Promise<number> {
  const trimmedId = String(enquiryId || '').trim();
  if (!trimmedId) return 0;

  const remarks = String(invoiceRemarks || '').trim();
  const snap = await getDocs(query(collection(db, 'sales'), where('enquiryId', '==', trimmedId)));
  if (snap.empty) return 0;

  const batch = writeBatch(db);
  snap.docs.forEach((saleDoc) => {
    batch.update(saleDoc.ref, {
      invoiceRemarks: remarks || deleteField(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return snap.size;
}

export function buildInvoiceRemarksByEnquiryId(
  enquiryDocs: Array<{ id: string; data: () => Record<string, unknown> }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  enquiryDocs.forEach((docSnap) => {
    const data = docSnap.data();
    const remarks = String(data.invoiceRemarks || data.remarksInInvoice || '').trim();
    if (remarks) out[docSnap.id] = remarks;
  });
  return out;
}

/** Merge enquiry remarks onto a sale-shaped payload before invoice PDF rendering. */
export function mergeEnquiryInvoiceRemarksOntoSale(
  sale: Record<string, unknown>,
  remarksByEnquiryId: Record<string, string>,
): Record<string, unknown> {
  const existing = String(sale.invoiceRemarks || '').trim();
  if (existing) return sale;
  const enquiryId = String(sale.enquiryId || '').trim();
  if (!enquiryId) return sale;
  const fromEnquiry = remarksByEnquiryId[enquiryId];
  if (!fromEnquiry) return sale;
  return { ...sale, invoiceRemarks: fromEnquiry };
}
