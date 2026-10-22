import type { PatientPaymentLine, UnifiedInvoiceRow } from './types';
import {
  attributePaymentToVisit,
  enquiryVisitsForAttribution,
  isNonSalePaymentCategory,
  saleCycleVisitIndexFor,
} from '@/lib/enquiries/visitPaymentAttribution';

/**
 * Net amount still owed for a hearing-aid sale after trade-in / exchange credit.
 * Matches `sales` sync (`resync-enquiry-sales`, enquiry edit upsert): credit is capped at invoice grand total.
 */
export function netPayableAfterHearingAidExchange(visit: Record<string, unknown>): number {
  const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax) || 0;
  const gstAmount = Number(visit.taxAmount) || 0;
  const baseGrand = Number(visit.salesAfterTax) || grossSalesBeforeTax + gstAmount;
  const exchangeCredit = Math.min(
    Math.max(0, Number(visit.exchangeCreditAmount) || 0),
    baseGrand
  );
  return Math.max(0, Math.round(baseGrand - exchangeCredit));
}

/**
 * Normalize payments from an enquiry Firestore document (`paymentRecords` + legacy `payments`),
 * matching patient profile semantics (merge parallel `payments` row by id for staff-submitted ref/remarks).
 * Each line is attributed to a visit and to that visit's purchase cycle (see `visitPaymentAttribution`).
 */
export function extractPatientPaymentsFromEnquiryDoc(
  data: Record<string, unknown> | undefined | null
): PatientPaymentLine[] {
  if (!data || typeof data !== 'object') return [];

  const visits = enquiryVisitsForAttribution(data);
  const withVisit = (line: PatientPaymentLine, relatedVisitId: unknown): PatientPaymentLine => {
    if (visits.length === 0) return line;
    const { visitIndex } = attributePaymentToVisit(
      { relatedVisitId, date: line.date, category: line.category },
      visits,
    );
    return {
      ...line,
      visitIndex,
      saleCycleVisitIndex: saleCycleVisitIndexFor(visits, visitIndex),
    };
  };

  const legacyById = new Map<string, Record<string, unknown>>(
    (Array.isArray(data.payments) ? (data.payments as Record<string, unknown>[]) : []).map((p) => [
      String(p?.id ?? ''),
      p,
    ])
  );

  if (Array.isArray(data.paymentRecords) && (data.paymentRecords as unknown[]).length > 0) {
    return (data.paymentRecords as Record<string, unknown>[]).map((pr) => {
      const legacy = pr?.id != null ? legacyById.get(String(pr.id)) : undefined;
      const amount = Number(pr.amount || 0);
      const mode = String(pr.paymentMethod ?? legacy?.paymentMode ?? '').trim() || '—';
      const referenceNumber = String(pr.referenceNumber ?? legacy?.referenceNumber ?? '').trim();
      const remarks = String(pr.remarks ?? legacy?.remarks ?? '').trim();
      const dateRaw = pr.paymentDate ?? legacy?.paymentDate;
      const date =
        dateRaw != null && String(dateRaw).trim() ? String(dateRaw).trim().slice(0, 10) : undefined;
      const category = String(legacy?.paymentFor || pr.paymentType || '').trim();
      return withVisit(
        {
          amount,
          mode,
          ...(referenceNumber ? { referenceNumber } : {}),
          ...(remarks ? { remarks } : {}),
          ...(date ? { date } : {}),
          ...(category ? { category } : {}),
        },
        pr.relatedVisitId ?? legacy?.relatedVisitId,
      );
    });
  }

  if (Array.isArray(data.payments)) {
    return (data.payments as Record<string, unknown>[]).map((p) => {
      const amount = Number(p.amount || 0);
      const mode = String(p.paymentMode || '').trim() || '—';
      const referenceNumber = String(p.referenceNumber || '').trim();
      const remarks = String(p.remarks || '').trim();
      const dateRaw = p.paymentDate;
      const date =
        dateRaw != null && String(dateRaw).trim() ? String(dateRaw).trim().slice(0, 10) : undefined;
      const category = String(p.paymentFor || p.paymentType || '').trim();
      return withVisit(
        {
          amount,
          mode,
          ...(referenceNumber ? { referenceNumber } : {}),
          ...(remarks ? { remarks } : {}),
          ...(date ? { date } : {}),
          ...(category ? { category } : {}),
        },
        p.relatedVisitId,
      );
    });
  }

  return [];
}

/**
 * Payments that belong to the invoice for this sale visit: the visit's purchase cycle, minus
 * test / ENT / programming fees. A repeat customer's second invoice then shows only its own payments.
 * Falls back to every line when the enquiry's payments cannot be attributed to visits.
 */
export function patientPaymentsForSaleVisit(
  lines: PatientPaymentLine[],
  saleVisitIndex: unknown,
): PatientPaymentLine[] {
  const want = Math.floor(Number(saleVisitIndex));
  if (saleVisitIndex === null || saleVisitIndex === '' || !Number.isFinite(want) || want < 0) return lines;
  const attributed = lines.some((l) => typeof l.saleCycleVisitIndex === 'number');
  if (!attributed) return lines;
  return lines.filter(
    (l) => l.saleCycleVisitIndex === want && !isNonSalePaymentCategory(l.category),
  );
}

export function buildPatientPaymentsIndexFromEnquiryDocs(
  docs: { id: string; data: () => Record<string, unknown> | undefined }[]
): Record<string, PatientPaymentLine[]> {
  const out: Record<string, PatientPaymentLine[]> = {};
  for (const d of docs) {
    out[d.id] = extractPatientPaymentsFromEnquiryDoc(d.data() ?? {});
  }
  return out;
}

export function enrichUnifiedRowsWithPatientPayments(
  rows: UnifiedInvoiceRow[],
  byEnquiryId: Record<string, PatientPaymentLine[]>
): UnifiedInvoiceRow[] {
  return rows.map((r) => {
    const enqId =
      r.kind === 'saved' && r.savedSale?.enquiryId
        ? r.savedSale.enquiryId
        : r.kind === 'enquiry_pending' && r.derivedEnquiry?.enquiryId
          ? r.derivedEnquiry.enquiryId
          : null;
    if (!enqId) return r;
    const all = byEnquiryId[enqId];
    if (!all || all.length === 0) return r;
    const visitIndex =
      r.kind === 'saved' ? r.savedSale?.enquiryVisitIndex : r.derivedEnquiry?.visitIndex;
    const patientPayments = patientPaymentsForSaleVisit(all, visitIndex);
    if (patientPayments.length === 0) return r;
    return { ...r, patientPayments };
  });
}
