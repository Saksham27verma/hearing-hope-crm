import type { PatientPaymentLine, UnifiedInvoiceRow } from './types';

/**
 * Normalize payments from an enquiry Firestore document (`paymentRecords` + legacy `payments`),
 * matching patient profile semantics (merge parallel `payments` row by id for staff-submitted ref/remarks).
 */
export function extractPatientPaymentsFromEnquiryDoc(
  data: Record<string, unknown> | undefined | null
): PatientPaymentLine[] {
  if (!data || typeof data !== 'object') return [];

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
      return {
        amount,
        mode,
        ...(referenceNumber ? { referenceNumber } : {}),
        ...(remarks ? { remarks } : {}),
        ...(date ? { date } : {}),
      };
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
      return {
        amount,
        mode,
        ...(referenceNumber ? { referenceNumber } : {}),
        ...(remarks ? { remarks } : {}),
        ...(date ? { date } : {}),
      };
    });
  }

  return [];
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
    const patientPayments = byEnquiryId[enqId];
    if (!patientPayments || patientPayments.length === 0) return r;
    return { ...r, patientPayments };
  });
}
