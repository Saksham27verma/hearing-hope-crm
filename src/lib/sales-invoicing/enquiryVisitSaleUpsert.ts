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
import {
  enquiryVisitSaleDateToTimestamp,
  parseEnquiryVisitSaleDate,
} from '@/lib/sales-invoicing/enquiryVisitSaleTimestamp';
import {
  chooseCanonicalSaleRecord,
  dedupeEnquiryVisitSales,
  findSalesForEnquiryVisitMirror,
} from '@/lib/sales-invoicing/enquiryVisitSaleDedupe';
import {
  readExchangeFieldsFromVisit,
  readVisitSaleTotals,
  saleGrandTotalFromVisit,
  saleRecordMatchesVisitMirror,
  toIstCalendarDateKey,
  visitInvoiceNumberFromVisit,
  visitLinkedSaleIdFromVisit,
} from '@/lib/sales-invoicing/enquiryVisitSaleMirror';
import type { SaleRecord } from '@/lib/sales-invoicing/types';
import { syncEnquiryVisitSaleLinkFromSale } from '@/lib/sales-invoicing/enquiryVisitInvoiceSync';
import { notifyLifecycleSaleSync } from '@/lib/lifecycle/notifyLifecycleSaleSync';
import { isSaleCancelled, normalizeEnquiryVisitIndex } from '@/lib/sales-invoicing/saleCancelled';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import {
  collectVisitSaleClaims,
  isInvoiceOwnedByAnotherVisit,
  isSaleOwnedByAnotherVisit,
} from '@/lib/sales-invoicing/visitSaleClaims';

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

function visitMedicalServices(visit: Record<string, unknown>): string[] {
  return Array.isArray(visit.medicalServices)
    ? visit.medicalServices.map((s) => String(s))
    : [];
}

/** True sale flags only — generic `hearing_aid` medical service is not a sale. */
export function isExplicitEnquirySaleVisit(visit: Record<string, unknown> | undefined | null): boolean {
  if (!visit) return false;
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const services = visitMedicalServices(visit);
  return Boolean(
    visit.hearingAidSale ||
      visit.purchaseFromTrial ||
      details?.purchaseFromTrial ||
      visit.hearingAidStatus === 'sold' ||
      details?.hearingAidStatus === 'sold' ||
      services.includes('hearing_aid_sale'),
  );
}

export function isInvoicableEnquirySaleVisit(visit: Record<string, unknown> | undefined | null): boolean {
  if (!visit) return false;
  if (isExplicitEnquirySaleVisit(visit)) return true;
  // Already invoiced: keep updating the existing row in place (never mint a new number).
  return Boolean(visitInvoiceNumberFromVisit(visit) || visitLinkedSaleIdFromVisit(visit));
}

export type UpsertEnquiryVisitSaleArgs = {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  visit: Record<string, unknown>;
  /** Pass the same `visits` array being saved so other visits' invoices are recognised and left alone. */
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
  skipped?: boolean;
  /** The visit carried another visit's invoice #; callers should drop it from the saved visit. */
  foreignInvoiceDropped?: boolean;
};

/**
 * Create: visit purchaseDate/visitDate. Update: keep existing saleDate unless that visit date changed.
 * Returns null when creating and the visit has no usable date (caller should skip invoicing).
 */
export function resolveSaleDateForUpsert(
  visit: Record<string, unknown>,
  existingSale: Record<string, unknown> | undefined,
): ReturnType<typeof enquiryVisitSaleDateToTimestamp> | null {
  const raw = visit.purchaseDate || visit.visitDate;
  const parsedNew = parseEnquiryVisitSaleDate(raw);
  const existing = existingSale?.saleDate;
  const parsedExisting = parseEnquiryVisitSaleDate(existing);

  if (parsedExisting) {
    if (!parsedNew) {
      return existing as ReturnType<typeof enquiryVisitSaleDateToTimestamp>;
    }
    const oldKey = toIstCalendarDateKey(parsedExisting);
    const newKey = toIstCalendarDateKey(parsedNew);
    if (oldKey && newKey && oldKey === newKey) {
      return existing as ReturnType<typeof enquiryVisitSaleDateToTimestamp>;
    }
    return enquiryVisitSaleDateToTimestamp(raw);
  }

  if (parsedNew) return enquiryVisitSaleDateToTimestamp(raw);
  return null;
}

export function stripVisitInvoiceLink(visit: Record<string, unknown>): Record<string, unknown> {
  const next = { ...visit };
  delete next.invoiceNumber;
  delete next.salesInvoiceNumber;
  delete next.linkedSaleId;
  const had = next.hearingAidDetails as Record<string, unknown> | undefined;
  if (had && typeof had === 'object') {
    const nextHad = { ...had };
    delete nextHad.invoiceNumber;
    delete nextHad.linkedSaleId;
    next.hearingAidDetails = nextHad;
  }
  return next;
}

/**
 * One `sales` document per enquiry visit — update in place, never add a second invoice on re-save.
 */
export async function upsertSaleForEnquiryVisit(
  args: UpsertEnquiryVisitSaleArgs,
): Promise<UpsertEnquiryVisitSaleResult> {
  const visitIndex = normalizeEnquiryVisitIndex(args.visitIndex);
  const data = args.enquiry;
  // An invoice # copied onto this visit from another visit (older data) is not this visit's invoice:
  // drop it so a new number is allocated instead of re-using / overwriting the other visit's sale.
  const claims = collectVisitSaleClaims(data.visits);
  const visitInvoiceIsForeign = isSaleOwnedByAnotherVisit(
    claims,
    { id: visitLinkedSaleIdFromVisit(args.visit), invoiceNumber: visitInvoiceNumberFromVisit(args.visit) },
    visitIndex,
  );
  const visit: Record<string, unknown> = visitInvoiceIsForeign
    ? stripVisitInvoiceLink(args.visit)
    : args.visit;
  const priorVisitInvoice = isInvoiceOwnedByAnotherVisit(claims, args.priorVisitInvoice, visitIndex)
    ? undefined
    : args.priorVisitInvoice;
  if (visitInvoiceIsForeign && !isExplicitEnquirySaleVisit(visit)) {
    // Only reached because of the copied invoice — not a sale visit, so nothing to invoice.
    return {
      saleId: '',
      invoiceNumber: '',
      created: false,
      visitInvoicePatched: false,
      skippedUnchanged: false,
      skipped: true,
      foreignInvoiceDropped: true,
    };
  }
  const products = Array.isArray(visit.products) ? visit.products : [];

  const totals = readVisitSaleTotals(visit);
  const grossSalesBeforeTax = totals.grossSalesBeforeTax;
  const gstAmount = totals.gstAmount;
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
    { priorVisitInvoice },
  );
  const activeSales = existingSales.filter((s) => !isSaleCancelled(s));
  const canonical = chooseCanonicalSaleRecord(activeSales);

  const existingVisitInvoice = visitInvoiceNumberFromVisit(visit);
  const invoiceNumber = await resolveEnquirySaleInvoiceNumber({
    db: args.db,
    existingVisitInvoice,
    existingSalesInvoice: canonical?.invoiceNumber,
    priorVisitInvoice,
    currentSaleId: canonical?.id,
  });

  const salesperson = resolveSalespersonFromEnquiryVisit(visit);
  const existingData = canonical?.id
    ? existingSales.find((s) => s.id === canonical.id)
    : undefined;

  const visitInvoicePatched =
    visitInvoiceNumberFromVisit(visit) !== normalizeInvoiceNumberString(invoiceNumber);

  const mirrorUnchanged =
    Boolean(canonical?.id) &&
    normalizeInvoiceNumberString(canonical.invoiceNumber) ===
      normalizeInvoiceNumberString(invoiceNumber) &&
    saleRecordMatchesVisitMirror(
      canonical as SaleRecord,
      visit,
      data,
      visitIndex,
    );

  if (mirrorUnchanged) {
    await dedupeEnquiryVisitSales(args.db, args.enquiryId, visitIndex, {
      actorUid: args.actor.uid,
      visit,
      enquiry: data,
      priorVisitInvoice,
    });
    await syncEnquiryVisitSaleLinkFromSale({
      db: args.db,
      enquiryId: args.enquiryId,
      visitIndex,
      saleId: canonical!.id!,
      invoiceNumber,
    });
    return {
      saleId: canonical!.id!,
      invoiceNumber,
      created: false,
      visitInvoicePatched,
      skippedUnchanged: true,
    };
  }

  const saleDate = resolveSaleDateForUpsert(
    visit,
    existingData as Record<string, unknown> | undefined,
  );

  if (!saleDate && !canonical?.id) {
    return {
      saleId: '',
      invoiceNumber: '',
      created: false,
      visitInvoicePatched: false,
      skippedUnchanged: false,
      skipped: true,
    };
  }

  const basePayload: Record<string, unknown> = {
    invoiceNumber,
    patientName: data.name || 'Patient',
    phone: data.phone || '',
    email: data.email || '',
    address: data.address || '',
    customerGstNumber: data.customerGstNumber || '',
    invoiceRemarks: String(data.invoiceRemarks || data.remarksInInvoice || '').trim(),
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
  if (saleDate) basePayload.saleDate = saleDate;

  let saleId = canonical?.id ?? null;
  let created = false;

  if (saleId) {
    await updateDoc(doc(args.db, 'sales', saleId), {
      ...basePayload,
      exchangeCreditInr: hasExchangeCredit ? exchangeCredit : deleteField(),
      exchangePriorVisitIndex: hasExchangePrior ? exchangePriorVisitIndex : deleteField(),
    });
    notifyLifecycleSaleSync(saleId);
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
    notifyLifecycleSaleSync(saleId);
  }

  await dedupeEnquiryVisitSales(args.db, args.enquiryId, visitIndex, {
    actorUid: args.actor.uid,
    visit,
    enquiry: data,
    priorVisitInvoice,
  });

  await syncEnquiryVisitSaleLinkFromSale({
    db: args.db,
    enquiryId: args.enquiryId,
    visitIndex,
    saleId: saleId!,
    invoiceNumber,
  });

  return {
    saleId: saleId!,
    invoiceNumber,
    created,
    visitInvoicePatched,
    skippedUnchanged: false,
  };
}
