import { v4 as uuidv4 } from 'uuid';
import {
  buildCatalogHearingAidProductLine,
  sumHearingAidVisitTotalsFromProducts,
  type CatalogProductDoc,
} from '@/server/staffEnquiryCatalogHelpers';

const TZ = 'Asia/Kolkata';

function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const nested = removeUndefined(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) out[key] = nested;
    } else {
      out[key] = value;
    }
  }
  return out as Partial<T>;
}

export function formatDateYmdInIST(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function parseStartToDate(start: unknown): Date | null {
  if (start == null) return null;
  if (typeof start === 'string') {
    const d = new Date(start);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof start === 'object' && start !== null) {
    const o = start as { toDate?: () => Date; seconds?: number };
    if (typeof o.toDate === 'function') return o.toDate();
    if (typeof o.seconds === 'number') return new Date(o.seconds * 1000);
  }
  return null;
}

function formatTimeFromStart(start: unknown): string {
  const d = parseStartToDate(start);
  if (!d) return '10:00';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Booking: one or more catalog devices. */
export type StaffBookingLine = {
  catalogProductId: string;
  hearingAidPrice: number;
  bookingSellingPrice: number;
  bookingQuantity: number;
};

export type StaffBookingDetails = {
  whichEar: 'left' | 'right' | 'both';
  /** Normalized list — always ≥1 after parse. */
  items: StaffBookingLine[];
  /** Convenience mirrors of first item (legacy / summaries). */
  hearingAidPrice: number;
  bookingSellingPrice: number;
  bookingQuantity: number;
};

/**
 * Trial: `trialLocationType` maps to visit `trialHearingAidType` (`in_office` | `home`) like CRM "Trial Type".
 * Device fields mirror `applyCatalogHearingAidSelection` using `trialProduct`.
 */
export type StaffTrialDetails = {
  trialLocationType: 'in_office' | 'home';
  whichEar: 'left' | 'right' | 'both';
  hearingAidPrice: number;
  /** Optional second device (max 2 total) — same visit. */
  secondCatalogProductId?: string;
  secondHearingAidPrice?: number;
  secondTrialSerialNumber?: string;
  trialDuration: number;
  trialStartDate: string;
  trialEndDate: string;
  trialSerialNumber: string;
  trialHomeSecurityDepositAmount: number;
  trialNotes: string;
};

export type StaffSaleProductLine = {
  productId: string;
  name: string;
  company?: string;
  serialNumber: string;
  mrp: number;
  /** Pre-tax unit selling price (same as CRM enquiry form — source of truth). */
  sellingPrice: number;
  discountPercent: number;
  gstPercent: number;
  quantity: number;
  warranty?: string;
};

export type StaffSaleDetails = {
  whichEar: 'left' | 'right' | 'both';
  /** One or more inventory lines (serials). Legacy clients sent a single flat object — normalized to one line in parseSaleDetails. */
  products: StaffSaleProductLine[];
};

const roundInrRupee = (n: number) => Math.round(Number(n) || 0);

/** Max 2 decimal places for discount % — matches SimplifiedEnquiryForm. */
const roundDiscountPercent = (value: number) =>
  Math.round(Math.max(0, Math.min(100, Number(value) || 0)) * 100) / 100;

/**
 * Mirrors CRM enquiry hearing-aid line math: selling price is pre-tax; discount from MRP vs selling;
 * GST on selling amount.
 */
function buildHearingAidProductFromSaleLine(line: StaffSaleProductLine, saleDate: string) {
  const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
  const mrp = roundInrRupee(line.mrp);
  let sellingPreTax = roundInrRupee(line.sellingPrice);
  if (mrp > 0 && sellingPreTax > mrp) sellingPreTax = mrp;
  const discountAmount = roundInrRupee(Math.max(0, mrp - sellingPreTax));
  const discountPercent = mrp > 0 ? roundDiscountPercent((discountAmount / mrp) * 100) : 0;
  const gstPercent = Math.max(0, Number(line.gstPercent) || 0);
  const gstAmount = gstPercent > 0 ? roundInrRupee((sellingPreTax * gstPercent) / 100) : 0;
  const finalAmount = roundInrRupee(sellingPreTax + gstAmount);
  const warranty = String(line.warranty ?? '').trim();

  return {
    id: uuidv4(),
    inventoryId: '',
    productId: line.productId,
    name: line.name,
    serialNumber: line.serialNumber,
    unit: 'piece' as const,
    quantity: qty,
    saleDate,
    mrp,
    dealerPrice: 0,
    sellingPrice: sellingPreTax,
    discountPercent,
    discountAmount,
    gstPercent,
    gstAmount,
    finalAmount,
    gstApplicable: gstPercent > 0,
    gstType: 'IGST' as const,
    warranty,
    company: line.company || '',
    location: '',
  };
}

function mapVisitToVisitSchedule(visit: Record<string, unknown>): Record<string, unknown> {
  const htFiltered = Array.isArray(visit.hearingTestEntries)
    ? (visit.hearingTestEntries as { testType?: string; price?: number; id?: string }[]).filter((e) =>
        String(e.testType || '').trim()
      )
    : [];
  const htSum = htFiltered.reduce((s, e) => s + Math.max(0, Number(e.price) || 0), 0);
  const testTypesLine = htFiltered.length
    ? htFiltered.map((e) => String(e.testType).trim()).join(', ')
    : String(visit.testType || '').trim() || null;

  const hearingTestDetails: Record<string, unknown> = removeUndefined({
    testType: testTypesLine,
    testDoneBy: visit.testDoneBy || null,
    testResults: visit.testResults || null,
    recommendations: visit.recommendations || null,
    testPrice: htFiltered.length > 0 ? htSum : visit.testPrice || null,
  });

  if (htFiltered.length > 0) {
    hearingTestDetails.hearingTestEntries = htFiltered.map((e) => ({
      id: e.id,
      testType: String(e.testType).trim(),
      price: Math.max(0, Number(e.price) || 0),
    }));
  }

  const entFiltered = Array.isArray(visit.entProcedureEntries)
    ? (visit.entProcedureEntries as { procedureType?: string; price?: number; id?: string }[]).filter((e) =>
        String(e.procedureType || '').trim()
      )
    : [];
  const entSum = entFiltered.reduce((s, e) => s + Math.max(0, Number(e.price) || 0), 0);
  const proceduresLine = entFiltered.length
    ? entFiltered.map((e) => String(e.procedureType).trim()).join(', ')
    : null;

  const entServiceDetails: Record<string, unknown> = removeUndefined({
    procedureTypesLine: proceduresLine,
    doneBy: visit.entProcedureDoneBy || null,
    totalPrice: entFiltered.length > 0 ? entSum : visit.entServicePrice || null,
  });

  if (entFiltered.length > 0) {
    entServiceDetails.entProcedureEntries = entFiltered.map((e) => ({
      id: e.id,
      procedureType: String(e.procedureType).trim(),
      price: Math.max(0, Number(e.price) || 0),
    }));
  }

  return removeUndefined({
    id: visit.id,
    visitType: visit.visitType,
    visitDate: visit.visitDate,
    visitTime: visit.visitTime,
    notes: visit.visitNotes,
    linkedAppointmentId: visit.linkedAppointmentId || null,
    gpsLocation: visit.gpsLocation || null,
    complianceFormData: visit.complianceFormData || null,
    staffVisitFeedback: visit.staffVisitFeedback || null,
    telecallerVerified: visit.telecallerVerified ?? null,
    createdByUid: visit.createdByUid || null,
    createdByName: visit.createdByName || null,
    medicalServices: [
      ...(visit.hearingTest ? ['hearing_test'] : []),
      ...(visit.hearingAidTrial ? ['hearing_aid_trial'] : []),
      ...(visit.hearingAidBooked ? ['hearing_aid_booked'] : []),
      ...(visit.hearingAidSale ? ['hearing_aid_sale'] : []),
      ...(visit.salesReturn ? ['sales_return'] : []),
      ...(visit.accessory ? ['accessory'] : []),
      ...(visit.programming ? ['programming'] : []),
      ...(visit.repair ? ['repair'] : []),
      ...(visit.counselling ? ['counselling'] : []),
      ...(visit.entService ? ['ent_service'] : []),
    ],
    hearingTestDetails,
    entServiceDetails: removeUndefined(entServiceDetails),
    hearingAidDetails: removeUndefined({
      hearingAidProductId: visit.hearingAidProductId,
      hearingAidSuggested: visit.hearingAidType,
      whoSold: visit.hearingAidBrand,
      quotation: visit.hearingAidModel,
      bookingAmount: visit.hearingAidPrice,
      trialPeriod: visit.warranty,
      whichEar: visit.whichEar,
      hearingAidStatus: visit.hearingAidStatus,
      saleDate: visit.purchaseDate || '',
      hearingAidGivenForTrial: visit.trialGiven,
      products: visit.products,
      grossMRP: visit.grossMRP,
      grossSalesBeforeTax: visit.grossSalesBeforeTax,
      taxAmount: visit.taxAmount,
      salesAfterTax: visit.salesAfterTax,
      totalDiscountPercent: visit.totalDiscountPercent,
      hearingAidJourneyId: visit.hearingAidJourneyId,
      previousVisitId: visit.previousVisitId,
      nextVisitId: visit.nextVisitId,
      journeyStage: visit.journeyStage,
      trialGiven: visit.trialGiven,
      trialDuration: visit.trialDuration,
      trialStartDate: visit.trialStartDate,
      trialEndDate: visit.trialEndDate,
      trialHearingAidBrand: visit.trialHearingAidBrand,
      trialHearingAidModel: visit.trialHearingAidModel,
      trialHearingAidType: visit.trialHearingAidType,
      trialSerialNumber: visit.trialSerialNumber,
      trialHomeSecurityDepositAmount: visit.trialHomeSecurityDepositAmount,
      trialNotes: visit.trialNotes,
      trialResult: visit.trialResult,
      bookingFromTrial: visit.bookingFromTrial,
      bookingAdvanceAmount: visit.bookingAdvanceAmount,
      bookingDate: visit.bookingDate,
      bookingFromVisitId: visit.bookingFromVisitId,
      bookingSellingPrice: visit.bookingSellingPrice,
      bookingQuantity: visit.bookingQuantity,
      purchaseFromTrial: visit.purchaseFromTrial,
      purchaseDate: visit.purchaseDate,
      purchaseFromVisitId: visit.purchaseFromVisitId,
    }),
  });
}

function defaultVisitShell(appointment: Record<string, unknown>): Record<string, unknown> {
  const visitType = appointment.type === 'home' ? 'home' : 'center';
  const today = formatDateYmdInIST(new Date());
  const visitTime = formatTimeFromStart(appointment.start);
  return {
    id: `visit-${Date.now()}-${uuidv4().slice(0, 8)}`,
    visitDate: today,
    visitTime,
    visitType,
    visitNotes: 'Updated from staff app (appointment-linked visit / receipt request).',
    linkedAppointmentId: '',
    hearingTest: false,
    hearingAidTrial: false,
    hearingAidBooked: false,
    hearingAidSale: false,
    salesReturn: false,
    accessory: false,
    programming: false,
    repair: false,
    counselling: false,
    entService: false,
    entProcedureEntries: [],
    entProcedureDoneBy: '',
    entServicePrice: 0,
    testType: '',
    hearingTestEntries: [],
    testDoneBy: '',
    testResults: '',
    recommendations: '',
    testPrice: 0,
    hearingAidProductId: '',
    hearingAidType: '',
    hearingAidBrand: '',
    hearingAidModel: '',
    hearingAidPrice: 0,
    warranty: '',
    whichEar: 'both',
    hearingAidStatus: 'booked',
    hearingAidJourneyId: '',
    previousVisitId: '',
    nextVisitId: '',
    journeyStage: 'initial',
    trialGiven: false,
    trialDuration: 7,
    trialStartDate: '',
    trialEndDate: '',
    trialHearingAidBrand: '',
    trialHearingAidModel: '',
    trialHearingAidType: '',
    trialSerialNumber: '',
    trialHomeSecurityDepositAmount: 0,
    trialNotes: '',
    trialResult: 'ongoing',
    bookingFromTrial: false,
    bookingAdvanceAmount: 0,
    bookingDate: '',
    bookingFromVisitId: '',
    bookingSellingPrice: 0,
    bookingQuantity: 1,
    purchaseFromTrial: false,
    purchaseDate: '',
    purchaseFromVisitId: '',
    exchangePriorVisitIndex: '',
    exchangeCreditAmount: 0,
    salesReturnItems: [],
    returnSerialNumber: '',
    returnReason: '',
    returnCondition: 'good',
    returnPenaltyAmount: 0,
    returnRefundAmount: 0,
    returnOriginalSaleDate: '',
    returnOriginalSaleVisitId: '',
    returnNotes: '',
    accessoryName: '',
    accessoryDetails: '',
    accessoryFOC: false,
    accessoryAmount: 0,
    accessoryQuantity: 1,
    programmingReason: '',
    hearingAidPurchaseDate: '',
    hearingAidName: '',
    underWarranty: false,
    programmingAmount: 0,
    programmingDoneBy: '',
    products: [],
    grossMRP: 0,
    grossSalesBeforeTax: 0,
    taxAmount: 0,
    salesAfterTax: 0,
    totalDiscountPercent: 0,
  };
}

function findStaffVisitIndexByAppointment(
  visits: Record<string, unknown>[],
  appointmentId: string
): number {
  const id = String(appointmentId || '').trim();
  if (!id) return -1;
  return visits.findIndex((v) => String(v?.linkedAppointmentId || '').trim() === id);
}

function appendVisitNote(visit: Record<string, unknown>, line: string) {
  const next = String(line || '').trim();
  if (!next) return;
  const prev = String(visit.visitNotes || '').trim();
  if (!prev) {
    visit.visitNotes = next;
    return;
  }
  if (prev.includes(next)) return;
  visit.visitNotes = `${prev}\n\n${next}`;
}

/**
 * One enquiry visit per staff appointment — services, compliance, and payment merge into the same row.
 */
function getOrCreateStaffAppointmentVisit(
  visitsRaw: Record<string, unknown>[],
  appointment: Record<string, unknown>,
  appointmentId: string,
  noteSeed: string
): { visit: Record<string, unknown>; index: number } {
  const idx = findStaffVisitIndexByAppointment(visitsRaw, appointmentId);
  if (idx >= 0) {
    const visit = { ...(visitsRaw[idx] as Record<string, unknown>) };
    visit.linkedAppointmentId = appointmentId;
    return { visit, index: idx };
  }
  const visit = {
    ...(defaultVisitShell(appointment) as Record<string, unknown>),
    linkedAppointmentId: appointmentId,
    visitNotes: noteSeed,
  };
  return { visit, index: -1 };
}

function commitStaffAppointmentVisit(
  visitsRaw: Record<string, unknown>[],
  index: number,
  visit: Record<string, unknown>
) {
  const cleaned = removeUndefined(visit) as Record<string, unknown>;
  if (index >= 0) visitsRaw[index] = cleaned;
  else visitsRaw.push(cleaned);
}

/** Non-payment visit logging from staff mobile / PWA — hearing test, accessory, programming, counselling. */
export type StaffVisitServicesHearingTest = {
  hearingTestEntries: { id: string; testType: string; price: number }[];
  testDoneBy?: string;
  testResults?: string;
  recommendations?: string;
};

export type StaffVisitServicesAccessory = {
  accessoryName: string;
  accessoryDetails?: string;
  accessoryFOC?: boolean;
  accessoryAmount?: number;
  accessoryQuantity?: number;
};

export type StaffVisitServicesProgramming = {
  programmingReason?: string;
  programmingAmount?: number;
  programmingDoneBy?: string;
  hearingAidPurchaseDate?: string;
  hearingAidName?: string;
  underWarranty?: boolean;
  /** CRM visit `warranty` string */
  warranty?: string;
};

export type StaffVisitServicesCounselling = {
  notes?: string;
};

export type StaffVisitServicesPayload = {
  hearingTest?: StaffVisitServicesHearingTest;
  accessory?: StaffVisitServicesAccessory;
  programming?: StaffVisitServicesProgramming;
  counselling?: StaffVisitServicesCounselling;
};

function sumHearingTestEntryPricesFromEntries(
  entries: { testType?: string; price?: number }[],
  fallbackTestPrice: number
): number {
  const filtered = entries.filter((e) => String(e.testType || '').trim());
  if (filtered.length === 0) return Math.max(0, Number(fallbackTestPrice) || 0);
  return filtered.reduce((s, e) => s + Math.max(0, Number(e.price) || 0), 0);
}

/**
 * Upserts services onto the appointment-linked visit (does not create a separate visit row).
 * Does not modify financialSummary or payments.
 */
export function mergeStaffVisitServicesIntoEnquiry(args: {
  enquiry: Record<string, unknown>;
  appointment: Record<string, unknown>;
  appointmentId: string;
  services: StaffVisitServicesPayload;
  staffUid?: string;
  staffName?: string;
}): { visits: Record<string, unknown>[]; visitSchedules: Record<string, unknown>[]; financialSummary: Record<string, unknown> } {
  const { enquiry, appointment, appointmentId, services } = args;
  const visitsRaw = Array.isArray(enquiry.visits) ? [...(enquiry.visits as Record<string, unknown>[])] : [];

  const baseNote = `Staff app — appointment ${appointmentId} — visit services logged.`;
  const { visit: v, index } = getOrCreateStaffAppointmentVisit(
    visitsRaw,
    appointment,
    appointmentId,
    baseNote
  );
  appendVisitNote(v, baseNote);

  if (args.staffUid && !v.createdByUid) v.createdByUid = args.staffUid;
  if (args.staffName) {
    if (!v.createdByName) v.createdByName = args.staffName;
    v.updatedByName = args.staffName;
  }
  if (args.staffUid) v.updatedByUid = args.staffUid;

  if (services.hearingTest) {
    const ht = services.hearingTest;
    const entries = (ht.hearingTestEntries || []).map((e) => ({
      id: String(e.id || '').trim() || uuidv4(),
      testType: String(e.testType || '').trim(),
      price: Math.max(0, Number(e.price) || 0),
    }));
    const filtered = entries.filter((e) => e.testType);
    const testTypeLine = filtered.map((e) => e.testType).join(', ');
    const testPrice = sumHearingTestEntryPricesFromEntries(filtered, 0);

    Object.assign(v, {
      hearingTest: true,
      hearingTestEntries: filtered,
      testType: testTypeLine,
      testPrice,
      testDoneBy: String(ht.testDoneBy || '').trim(),
      testResults: String(ht.testResults || '').trim(),
      recommendations: String(ht.recommendations || '').trim(),
    });
  }

  if (services.accessory) {
    const a = services.accessory;
    Object.assign(v, {
      accessory: true,
      accessoryName: String(a.accessoryName || '').trim(),
      accessoryDetails: String(a.accessoryDetails || '').trim(),
      accessoryFOC: Boolean(a.accessoryFOC),
      accessoryAmount: Math.max(0, Number(a.accessoryAmount) || 0),
      accessoryQuantity: Math.max(1, Math.floor(Number(a.accessoryQuantity) || 1)),
    });
  }

  if (services.programming) {
    const p = services.programming;
    Object.assign(v, {
      programming: true,
      programmingReason: String(p.programmingReason || '').trim(),
      programmingAmount: Math.max(0, Number(p.programmingAmount) || 0),
      programmingDoneBy: String(p.programmingDoneBy || '').trim(),
      hearingAidPurchaseDate: String(p.hearingAidPurchaseDate || '').trim(),
      hearingAidName: String(p.hearingAidName || '').trim(),
      underWarranty: Boolean(p.underWarranty),
      warranty: String(p.warranty || '').trim(),
    });
  }

  if (services.counselling) {
    const c = services.counselling;
    const n = String(c.notes || '').trim();
    Object.assign(v, {
      counselling: true,
      ...(n ? { counsellingNotes: n } : {}),
    });
    if (n) appendVisitNote(v, `Counselling: ${n}`);
  }

  commitStaffAppointmentVisit(visitsRaw, index, v);

  const visitSchedules = visitsRaw.map((visit) => mapVisitToVisitSchedule(visit));

  const fs = (enquiry.financialSummary as Record<string, unknown>) || {};
  const financialSummary = { ...fs };

  return { visits: visitsRaw, visitSchedules, financialSummary };
}

export type StaffComplianceSnapshot = {
  gpsLocation: {
    lat: number;
    lng: number;
    accuracy?: number | null;
    capturedAt: string;
  };
  complianceFormData: {
    wearingIdUniformBag: boolean;
    sharedPersonalContact: boolean;
    focHomeVisitsCommitted: number;
    freeBatteryBoxesCommitted: boolean;
    freeBatteryBoxesQty?: number | null;
    explainedAccessoriesCharges: boolean;
    explainedWarranty: boolean;
    connectedWithTelecaller: true;
  };
  feedback?: string;
};

/** Persist home-visit checkout (GPS + checklist + feedback) onto the patient visit. */
export function mergeStaffComplianceIntoEnquiry(args: {
  enquiry: Record<string, unknown>;
  appointment: Record<string, unknown>;
  appointmentId: string;
  compliance: StaffComplianceSnapshot;
  staffUid?: string;
  staffName?: string;
}): { visits: Record<string, unknown>[]; visitSchedules: Record<string, unknown>[] } {
  const visitsRaw = Array.isArray(args.enquiry.visits)
    ? [...(args.enquiry.visits as Record<string, unknown>[])]
    : [];
  const note = `Staff app — appointment ${args.appointmentId} — home visit checkout completed.`;
  const { visit: v, index } = getOrCreateStaffAppointmentVisit(
    visitsRaw,
    args.appointment,
    args.appointmentId,
    note
  );
  appendVisitNote(v, note);

  const feedback = String(args.compliance.feedback || '').trim();
  Object.assign(v, {
    gpsLocation: args.compliance.gpsLocation,
    complianceFormData: args.compliance.complianceFormData,
    telecallerVerified: true,
    ...(feedback ? { staffVisitFeedback: feedback } : {}),
  });

  if (args.staffUid && !v.createdByUid) v.createdByUid = args.staffUid;
  if (args.staffName) {
    if (!v.createdByName) v.createdByName = args.staffName;
    v.updatedByName = args.staffName;
  }
  if (args.staffUid) v.updatedByUid = args.staffUid;

  commitStaffAppointmentVisit(visitsRaw, index, v);
  const visitSchedules = visitsRaw.map((visit) => mapVisitToVisitSchedule(visit));
  return { visits: visitsRaw, visitSchedules };
}

export function mergeStaffSubmissionIntoEnquiry(args: {
  enquiry: Record<string, unknown>;
  appointment: Record<string, unknown>;
  /** Firestore appointment doc id — links all staff checkout pieces to one visit. */
  appointmentId: string;
  receiptType: 'trial' | 'booking' | 'invoice';
  amount: number;
  booking?: StaffBookingDetails;
  bookingProduct?: CatalogProductDoc;
  /** All catalog docs for booking.items (includes bookingProduct). */
  bookingProducts?: CatalogProductDoc[];
  trial?: StaffTrialDetails;
  trialProduct?: CatalogProductDoc;
  secondTrialProduct?: CatalogProductDoc;
  sale?: StaffSaleDetails;
  /** CRM sale visit: `hearingAidBrand` is "Who Sold" (staff), not device manufacturer. */
  whoSoldName: string;
  saleDeviceType?: string;
  staffUid?: string;
  staffName?: string;
}): { visits: Record<string, unknown>[]; visitSchedules: Record<string, unknown>[]; financialSummary: Record<string, unknown> } {
  const enquiry = args.enquiry;
  const todayYmd = formatDateYmdInIST(new Date());
  const visitsRaw = Array.isArray(enquiry.visits) ? [...(enquiry.visits as Record<string, unknown>[])] : [];

  const paymentNote = `Staff app — appointment ${args.appointmentId} — ${args.receiptType} (payment logged).`;
  const { visit: v, index } = getOrCreateStaffAppointmentVisit(
    visitsRaw,
    args.appointment,
    args.appointmentId,
    paymentNote
  );
  appendVisitNote(v, paymentNote);

  if (args.staffUid && !v.createdByUid) v.createdByUid = args.staffUid;
  if (args.staffName) {
    if (!v.createdByName) v.createdByName = args.staffName;
    v.updatedByName = args.staffName;
  }
  if (args.staffUid) v.updatedByUid = args.staffUid;

  if (args.receiptType === 'booking' && args.booking && args.bookingProduct) {
    const b = args.booking;
    const byId = new Map<string, CatalogProductDoc>();
    for (const p of args.bookingProducts || []) {
      if (p?.id) byId.set(p.id, p);
    }
    byId.set(args.bookingProduct.id, args.bookingProduct);

    const lines = (b.items?.length ? b.items : [
      {
        catalogProductId: args.bookingProduct.id,
        hearingAidPrice: b.hearingAidPrice,
        bookingSellingPrice: b.bookingSellingPrice,
        bookingQuantity: b.bookingQuantity,
      },
    ]) as Array<{
      catalogProductId: string;
      hearingAidPrice: number;
      bookingSellingPrice: number;
      bookingQuantity: number;
    }>;

    const products = [];
    for (const item of lines) {
      const p = byId.get(item.catalogProductId);
      if (!p) continue;
      products.push(
        buildCatalogHearingAidProductLine({
          product: p,
          saleDateYmd: todayYmd,
          mrpPerUnit: item.hearingAidPrice,
          quantity: item.bookingQuantity,
        })
      );
    }
    if (products.length === 0) {
      const p = args.bookingProduct;
      products.push(
        buildCatalogHearingAidProductLine({
          product: p,
          saleDateYmd: todayYmd,
          mrpPerUnit: b.hearingAidPrice,
          quantity: b.bookingQuantity,
        })
      );
    }
    const totals = sumHearingAidVisitTotalsFromProducts(products);
    const first = lines[0];
    const p0 = byId.get(first.catalogProductId) || args.bookingProduct;
    const modelLabel =
      products.length > 1
        ? products.map((x) => String((x as { name?: string }).name || '').trim()).filter(Boolean).join(' + ')
        : (p0.name || '').trim();

    Object.assign(v, {
      hearingAidBooked: true,
      hearingAidProductId: p0.id,
      hearingAidBrand: (p0.company || '').trim(),
      hearingAidModel: modelLabel,
      hearingAidType: (p0.type || '').trim(),
      whichEar: b.whichEar,
      hearingAidPrice: Number(first.hearingAidPrice) || 0,
      bookingSellingPrice: Number(first.bookingSellingPrice) || 0,
      bookingQuantity: Math.max(1, Math.floor(Number(first.bookingQuantity) || 1)),
      bookingAdvanceAmount: args.amount,
      bookingDate: todayYmd,
      bookingFromTrial: false,
      hearingAidStatus: 'booked',
      journeyStage: 'booking',
      products,
      grossMRP: totals.grossMRP,
      grossSalesBeforeTax: totals.grossSalesBeforeTax,
      taxAmount: totals.taxAmount,
      salesAfterTax: totals.salesAfterTax,
    });
  }

  if (args.receiptType === 'trial' && args.trial && args.trialProduct) {
    const t = args.trial;
    const p = args.trialProduct;
    const p2 = args.secondTrialProduct;
    const line = buildCatalogHearingAidProductLine({
      product: p,
      saleDateYmd: todayYmd,
      mrpPerUnit: t.hearingAidPrice,
      quantity: 1,
    });
    const products = [line];
    if (p2 && t.secondCatalogProductId && t.secondCatalogProductId === p2.id) {
      const mrp2 =
        typeof t.secondHearingAidPrice === 'number' && Number.isFinite(t.secondHearingAidPrice) && t.secondHearingAidPrice >= 0
          ? t.secondHearingAidPrice
          : p2.mrp ?? 0;
      products.push(
        buildCatalogHearingAidProductLine({
          product: p2,
          saleDateYmd: todayYmd,
          mrpPerUnit: mrp2,
          quantity: 1,
        })
      );
    }
    const totals = sumHearingAidVisitTotalsFromProducts(products);

    const isHome = t.trialLocationType === 'home';
    const modelLabel =
      products.length > 1 && p2 ? `${(p.name || '').trim()} + ${(p2.name || '').trim()}` : (p.name || '').trim();

    Object.assign(v, {
      hearingAidTrial: true,
      trialGiven: true,
      hearingAidProductId: p.id,
      ...(p2 && t.secondCatalogProductId ? { secondHearingAidProductId: p2.id } : {}),
      hearingAidBrand: (p.company || '').trim(),
      hearingAidModel: modelLabel,
      hearingAidType: (p.type || '').trim(),
      whichEar: t.whichEar,
      hearingAidPrice: Number(t.hearingAidPrice) || 0,
      trialHearingAidBrand: (p.company || '').trim(),
      trialHearingAidModel: modelLabel,
      trialHearingAidType: t.trialLocationType,
      trialDuration: isHome ? Math.max(0, Math.floor(Number(t.trialDuration) || 0)) : 0,
      trialStartDate: isHome ? String(t.trialStartDate || '').trim() : '',
      trialEndDate: isHome ? String(t.trialEndDate || '').trim() : '',
      trialSerialNumber: isHome ? String(t.trialSerialNumber || '').trim() : '',
      ...(isHome && p2 && t.secondTrialSerialNumber
        ? { secondTrialSerialNumber: String(t.secondTrialSerialNumber || '').trim() }
        : {}),
      trialHomeSecurityDepositAmount: isHome ? Number(t.trialHomeSecurityDepositAmount) || 0 : 0,
      trialNotes: String(t.trialNotes || '').trim(),
      trialResult: 'ongoing',
      journeyStage: 'trial',
      hearingAidStatus: 'trial_given',
      products,
      grossMRP: totals.grossMRP,
      grossSalesBeforeTax: totals.grossSalesBeforeTax,
      taxAmount: totals.taxAmount,
      salesAfterTax: totals.salesAfterTax,
    });
  }

  if (args.receiptType === 'invoice' && args.sale) {
    const lines = args.sale.products;
    const whichEar = args.sale.whichEar;
    const saleDate = todayYmd;
    const productRows = lines.map((line) => buildHearingAidProductFromSaleLine(line, saleDate));
    const totals = sumHearingAidVisitTotalsFromProducts(productRows);
    const first = lines[0];
    const modelLabel =
      lines.length <= 1 ? first.name : `${first.name} (+${lines.length - 1} more)`;

    Object.assign(v, {
      hearingAidSale: true,
      hearingAidBrand: args.whoSoldName.trim(),
      hearingAidModel: modelLabel,
      hearingAidType: (args.saleDeviceType || '').trim(),
      hearingAidProductId: first.productId,
      whichEar,
      trialSerialNumber: first.serialNumber,
      products: productRows,
      grossMRP: totals.grossMRP,
      grossSalesBeforeTax: totals.grossSalesBeforeTax,
      taxAmount: totals.taxAmount,
      salesAfterTax: totals.salesAfterTax,
      purchaseDate: saleDate,
      purchaseFromTrial: false,
      journeyStage: 'sale',
      hearingAidStatus: 'sold',
    });
  }

  commitStaffAppointmentVisit(visitsRaw, index, v);

  const visitSchedules = visitsRaw.map((visit) => mapVisitToVisitSchedule(visit));

  const fs = (enquiry.financialSummary as Record<string, unknown>) || {};
  const totalDue = Number(fs.totalDue ?? 0);
  const prevPaid = Number(fs.totalPaid || 0);
  const nextPaid = prevPaid + args.amount;
  const nextOutstanding = Math.max(0, totalDue - nextPaid);

  const financialSummary = {
    ...fs,
    totalPaid: nextPaid,
    outstanding: nextOutstanding,
    paymentStatus: nextOutstanding <= 0 ? 'fully_paid' : 'pending',
  };

  return { visits: visitsRaw, visitSchedules, financialSummary };
}
