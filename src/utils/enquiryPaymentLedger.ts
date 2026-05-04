/**
 * Normalized payment lines for enquiry profile UI and payment acknowledgment PDF.
 * Matches Firestore shape: prefer `paymentRecords` merged by `id` with legacy `payments`; if no records, use legacy only.
 */

export type EnquiryPaymentLedgerLine = {
  id: string;
  label: string;
  amount: number;
  date?: string;
  mode?: string;
  actorName: string;
  referenceNumber?: string;
  remarks?: string;
};

type EnquiryLike = Record<string, unknown>;

function actorFromPayment(payment: Record<string, unknown>): string {
  return String(
    payment.createdByName ||
      payment.updatedByName ||
      payment.createdByEmail ||
      payment.updatedByEmail ||
      payment.createdByUid ||
      payment.updatedByUid ||
      ''
  ).trim();
}

function paymentDateString(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  return s.slice(0, 10);
}

function parseSortKey(dateRaw: unknown, fallbackIndex: number): number {
  const s = dateRaw != null ? String(dateRaw).trim().slice(0, 10) : '';
  if (!s) return fallbackIndex;
  const t = new Date(`${s}T12:00:00`).getTime();
  return Number.isFinite(t) ? t : fallbackIndex;
}

function labelFromLegacyPaymentFor(paymentFor: string): string | undefined {
  switch (paymentFor) {
    case 'hearing_test':
      return 'Test';
    case 'ent_service':
      return 'ENT service';
    case 'booking_advance':
      return 'Booking';
    case 'hearing_aid':
      return 'Hearing Aid';
    case 'accessory':
    case 'accessories':
      return 'Accessory';
    case 'trial_home_security_deposit':
      return 'Trial security deposit';
    case 'trial_home_security_deposit_refund':
      return 'Trial security deposit refund';
    case 'programming':
      return 'Programming';
    case 'full_payment':
      return 'Full Payment';
    case 'partial_payment':
      return 'Partial Payment';
    case 'other':
      return 'Other';
    default:
      return undefined;
  }
}

function labelFromPaymentType(paymentType: string, row: Record<string, unknown>): string {
  const pt = paymentType.trim();
  const rc = String(row.receiptCategory || '').toLowerCase();

  switch (pt) {
    case 'hearing_aid_test':
      return 'Test';
    case 'ent_service':
      return 'ENT service';
    case 'hearing_aid_booking':
      return rc === 'booking' ? 'Booking (staff collection)' : 'Booking';
    case 'hearing_aid_sale':
      return rc === 'invoice' ? 'Sale (staff collection)' : 'Sale';
    case 'staff_trial_request':
      if (rc === 'trial') return 'Trial (staff collection)';
      return 'Trial (staff request)';
    case 'programming':
      return 'Programming';
    case 'accessory':
      return 'Accessory';
    case 'other':
      return 'Other';
    default:
      if (pt) return pt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return 'Payment';
  }
}

function resolveLabel(payment: Record<string, unknown>, legacy?: Record<string, unknown>): string {
  const legacyFor = legacy && String(legacy.paymentFor || '').trim();
  if (legacyFor) {
    const fromFor = labelFromLegacyPaymentFor(legacyFor);
    if (fromFor) return fromFor;
  }
  return labelFromPaymentType(String(payment.paymentType || ''), payment);
}

/**
 * Returns payment ledger lines for an enquiry document (same semantics as enquiry detail Payments list).
 */
export function getEnquiryPaymentLedgerLines(enquiry: EnquiryLike | null | undefined): EnquiryPaymentLedgerLine[] {
  if (!enquiry || typeof enquiry !== 'object') return [];

  const legacyPayments = Array.isArray(enquiry.payments)
    ? (enquiry.payments as Record<string, unknown>[])
    : [];
  const legacyById = new Map<string, Record<string, unknown>>(
    legacyPayments.map((p) => [String(p?.id ?? ''), p])
  );

  const paymentRecords = Array.isArray(enquiry.paymentRecords)
    ? (enquiry.paymentRecords as Record<string, unknown>[])
    : [];

  const rawRows: EnquiryPaymentLedgerLine[] = [];

  if (paymentRecords.length > 0) {
    paymentRecords.forEach((payment, idx) => {
      const id = String(payment.id ?? `idx-${idx}`);
      const legacy = payment.id != null ? legacyById.get(String(payment.id)) : undefined;
      const referenceNumber = String(
        payment.referenceNumber ?? legacy?.referenceNumber ?? ''
      ).trim();
      const remarks = String(payment.remarks ?? legacy?.remarks ?? '').trim();
      const modeRaw = payment.paymentMethod ?? legacy?.paymentMode;
      const mode = String(modeRaw ?? '').trim() || undefined;
      const dateRaw = payment.paymentDate ?? legacy?.paymentDate;
      rawRows.push({
        id,
        label: resolveLabel(payment, legacy),
        amount: Number(payment.amount || 0),
        date: paymentDateString(dateRaw),
        mode,
        actorName: actorFromPayment(payment) || (legacy ? actorFromPayment(legacy) : ''),
        ...(referenceNumber ? { referenceNumber } : {}),
        ...(remarks ? { remarks } : {}),
      });
    });
  } else {
    legacyPayments.forEach((payment, idx) => {
      const id = String(payment.id ?? `idx-${idx}`);
      const referenceNumber = String(payment.referenceNumber ?? '').trim();
      const remarks = String(payment.remarks ?? '').trim();
      const mode = String(payment.paymentMode ?? '').trim() || undefined;
      const pf = String(payment.paymentFor || '').trim();
      rawRows.push({
        id,
        label:
          labelFromLegacyPaymentFor(pf) ??
          labelFromPaymentType(String(payment.paymentType || ''), payment),
        amount: Number(payment.amount || 0),
        date: paymentDateString(payment.paymentDate),
        mode,
        actorName: actorFromPayment(payment),
        ...(referenceNumber ? { referenceNumber } : {}),
        ...(remarks ? { remarks } : {}),
      });
    });
  }

  return rawRows
    .map((row, i) => ({ row, i, key: parseSortKey(row.date, i) }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key;
      return String(a.row.id).localeCompare(String(b.row.id));
    })
    .map(({ row }) => row);
}

export function sumEnquiryPaymentLedgerAmounts(lines: EnquiryPaymentLedgerLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}
