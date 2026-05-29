import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  deleteField,
  type Firestore,
} from 'firebase/firestore';
import { resolveEnquirySaleInvoiceNumber } from '@/lib/sales-invoicing/enquiryInvoiceNumber';
import { enquiryVisitSaleDateToTimestamp } from '@/lib/sales-invoicing/enquiryVisitSaleTimestamp';
import {
  chooseCanonicalSaleRecord,
  dedupeEnquiryVisitSales,
  findSalesForEnquiryVisitMirror,
} from '@/lib/sales-invoicing/enquiryVisitSaleDedupe';
import {
  readExchangeFieldsFromVisit,
  saleGrandTotalFromVisit,
  saleRecordMatchesVisitMirror,
  visitInvoiceNumberFromVisit,
} from '@/lib/sales-invoicing/enquiryVisitSaleMirror';
import { syncEnquiryVisitInvoiceNumberFromSale } from '@/lib/sales-invoicing/enquiryVisitInvoiceSync';
import { normalizeEnquiryVisitIndex } from '@/lib/sales-invoicing/saleCancelled';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

export { normalizeEnquiryVisitIndex } from '@/lib/sales-invoicing/saleCancelled';

/** "Who sold" on enquiry sale visits — stored as `hearingAidBrand` / `hearingAidDetails.whoSold`. */
export function resolveSalespersonFromEnquiryVisit(
  visit: Record<string, unknown>,
): { id: string; name: string } {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const name = String(
    details?.whoSold ?? visit.whoSold ?? visit.whoSoldName ?? visit.hearingAidBrand ?? '',
  ).trim();
  const id = String(visit.salespersonId ?? details?.salespersonId ?? '').trim();
  return { id, name };
}

export function isInvoicableEnquirySaleVisit(visit: Record<string, unknown> | undefined | null): boolean {
  if (!visit) return false;
  return Boolean(
    visit.hearingAidSale || visit.purchaseFromTrial || visit.hearingAidStatus === 'sold',
  );
}

export type UpsertEnquiryVisitSaleArgs = {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  visit: Record<string, unknown>;
  enquiry: Record<string, unknown>;
  actor: {
    uid?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  priorVisitInvoice?: unknown;
  onNewSale?: (saleId: string) => void;
};

export type UpsertEnquiryVisitSaleResult = {
  saleId: string;
  invoiceNumber: string;
  created: boolean;
  visitInvoicePatched: boolean;
  skippedUnchanged: boolean;
};

function salespersonMatchesSale(
  visit: Record<string, unknown>,
  sale: { salesperson?: { id?: string; name?: string } },
): boolean {
  const fromVisit = resolveSalespersonFromEnquiryVisit(visit);
  const fromSale = sale.salesperson || { id: '', name: '' };
  return (
    String(fromSale.id || '').trim() === fromVisit.id &&
    String(fromSale.name || '').trim() === fromVisit.name
  );
}

/**
 * One `sales` document per enquiry visit — update in place, never add a second invoice on re-save.
 */
export async function upsertSaleForEnquiryVisit(
  args: UpsertEnquiryVisitSaleArgs,
): Promise<UpsertEnquiryVisitSaleResult> {
  const visitIndex = normalizeEnquiryVisitIndex(args.visitIndex);
  const visit = args.visit;
  const data = args.enquiry;
  const products = Array.isArray(visit.products) ? visit.products : [];

  const saleDateRaw = visit.purchaseDate || visit.visitDate;
  const saleDate = enquiryVisitSaleDateToTimestamp(saleDateRaw);
  const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax) || 0;
  const gstAmount = Number(visit.taxAmount) || 0;
  const { exchangeCredit, exchangePriorVisitIndex } = readExchangeFieldsFromVisit(visit);
  const grandTotal = saleGrandTotalFromVisit(visit);
  const hasExchangeCredit = exchangeCredit > 0;
  const hasExchangePrior =
    typeof exchangePriorVisitIndex === 'number' && exchangePriorVisitIndex >= 0;

  const existingSales = await findSalesForEnquiryVisitMirror(
    args.db,
    args.enquiryId,
    visitIndex,
    visit,
    data,
  );
  const activeSales = existingSales.filter((s) => s.cancelled !== true && s.cancelled !== 'true');
  const canonical = chooseCanonicalSaleRecord(
    activeSales.length > 0 ? activeSales : existingSales,
  );

  const existingVisitInvoice = visitInvoiceNumberFromVisit(visit);
  const invoiceNumber = await resolveEnquirySaleInvoiceNumber({
    db: args.db,
    existingVisitInvoice,
    existingSalesInvoice: canonical?.invoiceNumber,
    priorVisitInvoice: args.priorVisitInvoice,
    currentSaleId: canonical?.id,
  });

  const salesperson = resolveSalespersonFromEnquiryVisit(visit);
  const existingData = canonical?.id
    ? existingSales.find((s) => s.id === canonical.id)
    : undefined;

  const visitInvoicePatched =
    visitInvoiceNumberFromVisit(visit) !== normalizeInvoiceNumberString(invoiceNumber);

  const needsIndexBackfill =
    Boolean(canonical?.id) &&
    normalizeEnquiryVisitIndex(canonical.enquiryVisitIndex) !== visitIndex;

  const mirrorUnchanged =
    Boolean(canonical?.id) &&
    saleRecordMatchesVisitMirror(canonical, visit, data, visitIndex) &&
    salespersonMatchesSale(visit, canonical) &&
    normalizeInvoiceNumberString(canonical.invoiceNumber) ===
      normalizeInvoiceNumberString(invoiceNumber) &&
    !needsIndexBackfill;

  if (mirrorUnchanged) {
    await dedupeEnquiryVisitSales(args.db, args.enquiryId, visitIndex, {
      actorUid: args.actor.uid,
      visit,
      enquiry: data,
    });
    if (saleHasBillableInvoiceNumber(invoiceNumber) && visitInvoicePatched) {
      await syncEnquiryVisitInvoiceNumberFromSale({
        db: args.db,
        enquiryId: args.enquiryId,
        visitIndex,
        invoiceNumber,
      });
    }
    return {
      saleId: canonical!.id!,
      invoiceNumber,
      created: false,
      visitInvoicePatched,
      skippedUnchanged: true,
    };
  }

  const basePayload: Record<string, unknown> = {
    invoiceNumber,
    patientName: data.name || 'Patient',
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    customerGstNumber: data.customerGstNumber || '',
    products,
    accessories: [],
    manualLineItems: [],
    referenceDoctor: { name: '' },
    salesperson,
    totalAmount: grossSalesBeforeTax,
    gstAmount,
    gstPercentage: 0,
    grandTotal,
    netProfit: 0,
    branch: '',
    centerId: visit.centerId || data.visitingCenter || data.center || '',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    notes: visit.visitNotes || '',
    saleDate,
    source: 'enquiry',
    enquiryId: args.enquiryId,
    enquiryVisitIndex: visitIndex,
    createdByUid: (existingData as { createdByUid?: string })?.createdByUid ?? args.actor.uid,
    createdByName: (existingData as { createdByName?: string })?.createdByName ?? args.actor.name ?? '',
    createdByEmail: (existingData as { createdByEmail?: string })?.createdByEmail ?? args.actor.email ?? '',
    createdByRole: (existingData as { createdByRole?: string })?.createdByRole ?? args.actor.role ?? '',
    updatedByUid: args.actor.uid,
    updatedByName: args.actor.name ?? '',
    updatedByEmail: args.actor.email ?? '',
    updatedByRole: args.actor.role ?? '',
    updatedAt: serverTimestamp(),
  };

  let saleId = canonical?.id ?? null;
  let created = false;

  if (saleId) {
    await updateDoc(doc(args.db, 'sales', saleId), {
      ...basePayload,
      exchangeCreditInr: hasExchangeCredit ? exchangeCredit : deleteField(),
      exchangePriorVisitIndex: hasExchangePrior ? exchangePriorVisitIndex : deleteField(),
    });
  } else {
    const newDocPayload: Record<string, unknown> = {
      ...basePayload,
      createdAt: serverTimestamp(),
    };
    if (hasExchangeCredit) newDocPayload.exchangeCreditInr = exchangeCredit;
    if (hasExchangePrior) newDocPayload.exchangePriorVisitIndex = exchangePriorVisitIndex;
    const saleRef = await addDoc(collection(args.db, 'sales'), newDocPayload);
    saleId = saleRef.id;
    created = true;
    args.onNewSale?.(saleId);
  }

  await dedupeEnquiryVisitSales(args.db, args.enquiryId, visitIndex, {
    actorUid: args.actor.uid,
    visit,
    enquiry: data,
  });

  if (saleHasBillableInvoiceNumber(invoiceNumber)) {
    await syncEnquiryVisitInvoiceNumberFromSale({
      db: args.db,
      enquiryId: args.enquiryId,
      visitIndex,
      invoiceNumber,
    });
  }

  return {
    saleId: saleId!,
    invoiceNumber,
    created,
    visitInvoicePatched,
    skippedUnchanged: false,
  };
}
