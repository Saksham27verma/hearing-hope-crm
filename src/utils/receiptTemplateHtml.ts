import type { BookingReceiptData } from '@/components/receipts/BookingReceiptTemplate';
import type { TrialReceiptData } from '@/components/receipts/TrialReceiptTemplate';
import {
  ManagedDocumentType,
  replaceTemplateTokens,
  type TemplateImage,
} from '@/utils/documentTemplateUtils';
import type { PaymentAcknowledgmentData } from '@/utils/receiptDataBuilders';
import {
  defaultBookingFooter,
  defaultPaymentAcknowledgmentFooter,
  defaultPaymentAcknowledgmentTerms,
  defaultTrialFooter,
} from '@/utils/receiptDataBuilders';
import type { EnquiryPaymentLedgerLine } from '@/utils/enquiryPaymentLedger';

export type HtmlDocumentTemplate = {
  id?: string;
  templateType?: 'visual' | 'html';
  documentType?: ManagedDocumentType;
  htmlContent?: string;
  images?: TemplateImage[];
};

const LOGO_PLACEHOLDER_TOKEN = '{{LOGO_PLACEHOLDER}}';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatHtmlText(value?: string | number | null, multiline = false) {
  if (value == null || value === '') return '';
  const text = escapeHtml(String(value));
  return multiline ? text.replace(/\n/g, '<br/>') : text;
}

export function formatCurrencyForTemplate(amount?: number) {
  return typeof amount === 'number' && !Number.isNaN(amount)
    ? `Rs. ${amount.toLocaleString('en-IN')}`
    : '';
}

/**
 * Ensures logo token resolves when the Firestore template has no uploaded logo.
 * Pass `publicOrigin` (e.g. https://app.example.com) for server/Puppeteer; omit or empty for relative `/images/...` (browser).
 */
export function mergeTemplateImagesWithDefaultLogo(
  images: TemplateImage[] | undefined,
  publicOrigin?: string
): TemplateImage[] {
  const list = [...(images ?? [])];
  const hasLogo = list.some(
    (im) => im.placeholder === LOGO_PLACEHOLDER_TOKEN && String(im.url ?? '').trim() !== ''
  );
  if (!hasLogo) {
    const url =
      publicOrigin && publicOrigin.trim()
        ? `${publicOrigin.replace(/\/$/, '')}/images/logohope.svg`
        : '/images/logohope.svg';
    list.push({ placeholder: LOGO_PLACEHOLDER_TOKEN, url });
  }
  return list;
}

export type BuildReceiptHtmlOptions = {
  footerText?: string;
  /** Set when generating PDF server-side so logo URL is absolute. */
  logoPublicOrigin?: string;
};

export function buildBookingReceiptHtmlString(
  template: HtmlDocumentTemplate,
  data: BookingReceiptData,
  opts?: BuildReceiptHtmlOptions
) {
  const footerText = opts?.footerText ?? defaultBookingFooter;
  const images = mergeTemplateImagesWithDefaultLogo(template.images, opts?.logoPublicOrigin);
  const qty = Number(data.quantity) || 1;
  const unitSelling = Number(data.sellingPrice) || 0;
  const totalAgreed = unitSelling * qty;
  return replaceTemplateTokens(
    template.htmlContent || '',
    {
      COMPANY_NAME: formatHtmlText(data.companyName),
      COMPANY_ADDRESS: formatHtmlText(data.companyAddress, true),
      COMPANY_PHONE: formatHtmlText(data.companyPhone),
      COMPANY_EMAIL: formatHtmlText(data.companyEmail),
      RECEIPT_NUMBER: formatHtmlText(data.receiptNumber),
      RECEIPT_DATE: formatHtmlText(data.receiptDate),
      PATIENT_NAME: formatHtmlText(data.patientName),
      PATIENT_PHONE: formatHtmlText(data.patientPhone),
      PATIENT_EMAIL: formatHtmlText(data.patientEmail),
      PATIENT_ADDRESS: formatHtmlText(data.patientAddress, true),
      BOOKING_DATE: formatHtmlText(data.bookingDate),
      DEVICE_NAME: formatHtmlText(
        data.deviceName || [data.deviceBrand, data.deviceModel].filter(Boolean).join(' ').trim()
      ),
      DEVICE_BRAND: formatHtmlText(data.deviceBrand),
      DEVICE_MODEL: formatHtmlText(data.deviceModel),
      MRP: formatHtmlText(formatCurrencyForTemplate(data.mrp)),
      SELLING_PRICE: formatHtmlText(formatCurrencyForTemplate(data.sellingPrice)),
      TOTAL_AGREED_VALUE: formatHtmlText(formatCurrencyForTemplate(totalAgreed)),
      QUANTITY: formatHtmlText(data.quantity),
      ADVANCE_AMOUNT: formatHtmlText(formatCurrencyForTemplate(data.advanceAmount)),
      BALANCE_AMOUNT: formatHtmlText(formatCurrencyForTemplate(data.balanceAmount)),
      PAYMENT_MODE: formatHtmlText(data.paymentMode),
      CENTER_NAME: formatHtmlText(data.centerName),
      VISIT_DATE: formatHtmlText(data.visitDate),
      TERMS_TEXT: formatHtmlText(data.terms, true),
      FOOTER_TEXT: formatHtmlText(footerText, true),
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    images
  );
}

function buildPaymentsTableHtmlString(lines: EnquiryPaymentLedgerLine[]): string {
  if (lines.length === 0) {
    return '<p style="margin:0;color:#6b7280;font-size:14px">No payment entries.</p>';
  }
  const accent = '#A80000';
  const head = `<thead><tr style="border-bottom:2px solid ${accent};text-align:left;color:${accent};font-weight:700">
<th style="padding:10px 8px">Date</th>
<th style="padding:10px 8px">Particulars</th>
<th style="padding:10px 8px;text-align:right">Amount</th>
<th style="padding:10px 8px">Mode</th>
<th style="padding:10px 8px">Reference</th>
<th style="padding:10px 8px">Remarks</th>
</tr></thead>`;
  const rows = lines
    .map((line) => {
      const date = formatHtmlText(line.date || '—');
      const label = formatHtmlText(line.label);
      const amount = formatHtmlText(formatCurrencyForTemplate(line.amount));
      const mode = formatHtmlText(line.mode ? String(line.mode) : '—');
      const ref = formatHtmlText(line.referenceNumber || '—');
      const remarks = line.remarks ? formatHtmlText(line.remarks, true) : '—';
      return `<tr style="border-bottom:1px solid #EDF2F7;vertical-align:top">
<td style="padding:10px 8px;white-space:nowrap">${date}</td>
<td style="padding:10px 8px">${label}</td>
<td style="padding:10px 8px;text-align:right;font-weight:600">${amount}</td>
<td style="padding:10px 8px">${mode}</td>
<td style="padding:10px 8px;word-break:break-word">${ref}</td>
<td style="padding:10px 8px;font-size:12px;color:#4A5568">${remarks}</td>
</tr>`;
    })
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:13px;color:#1A202C">${head}<tbody>${rows}</tbody></table>`;
}

export function buildPaymentAcknowledgmentHtmlString(
  template: HtmlDocumentTemplate,
  data: PaymentAcknowledgmentData,
  opts?: BuildReceiptHtmlOptions
) {
  const footerText = opts?.footerText ?? data.footer ?? defaultPaymentAcknowledgmentFooter;
  const termsBody = data.terms ?? defaultPaymentAcknowledgmentTerms;
  const images = mergeTemplateImagesWithDefaultLogo(template.images, opts?.logoPublicOrigin);
  const paymentsTable = buildPaymentsTableHtmlString(data.lines);
  return replaceTemplateTokens(
    template.htmlContent || '',
    {
      COMPANY_NAME: formatHtmlText(data.companyName),
      COMPANY_ADDRESS: formatHtmlText(data.companyAddress, true),
      COMPANY_PHONE: formatHtmlText(data.companyPhone),
      COMPANY_EMAIL: formatHtmlText(data.companyEmail),
      DOCUMENT_TITLE: formatHtmlText(data.documentTitle),
      DOCUMENT_NUMBER: formatHtmlText(data.documentNumber),
      STATEMENT_DATE: formatHtmlText(data.statementDate),
      PATIENT_NAME: formatHtmlText(data.patientName),
      PATIENT_PHONE: formatHtmlText(data.patientPhone),
      PATIENT_EMAIL: formatHtmlText(data.patientEmail),
      PATIENT_ADDRESS: formatHtmlText(data.patientAddress, true),
      CENTER_NAME: formatHtmlText(data.centerName),
      LINE_COUNT: formatHtmlText(String(data.lineCount)),
      TOTAL_PAID: formatHtmlText(formatCurrencyForTemplate(data.totalPaid)),
      PAYMENTS_TABLE_HTML: paymentsTable,
      TERMS_TEXT: formatHtmlText(termsBody, true),
      FOOTER_TEXT: formatHtmlText(footerText, true),
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    images
  );
}

export function buildTrialReceiptHtmlString(
  template: HtmlDocumentTemplate,
  data: TrialReceiptData,
  opts?: BuildReceiptHtmlOptions
) {
  const footerText = opts?.footerText ?? defaultTrialFooter;
  const images = mergeTemplateImagesWithDefaultLogo(template.images, opts?.logoPublicOrigin);
  return replaceTemplateTokens(
    template.htmlContent || '',
    {
      COMPANY_NAME: formatHtmlText(data.companyName),
      COMPANY_ADDRESS: formatHtmlText(data.companyAddress, true),
      COMPANY_PHONE: formatHtmlText(data.companyPhone),
      COMPANY_EMAIL: formatHtmlText(data.companyEmail),
      RECEIPT_NUMBER: formatHtmlText(data.receiptNumber),
      RECEIPT_DATE: formatHtmlText(data.receiptDate),
      PATIENT_NAME: formatHtmlText(data.patientName),
      PATIENT_PHONE: formatHtmlText(data.patientPhone),
      PATIENT_EMAIL: formatHtmlText(data.patientEmail),
      PATIENT_ADDRESS: formatHtmlText(data.patientAddress, true),
      TRIAL_DATE: formatHtmlText(data.trialDate),
      TRIAL_START_DATE: formatHtmlText(data.trialStartDate),
      TRIAL_END_DATE: formatHtmlText(data.trialEndDate),
      TRIAL_DURATION_DAYS: formatHtmlText(
        data.trialDurationDays != null ? `${data.trialDurationDays} days` : ''
      ),
      DEVICE_USED: formatHtmlText(data.deviceUsed),
      TRIAL_TYPE: formatHtmlText(data.trialType),
      SERIAL_NUMBER: formatHtmlText(data.serialNumber),
      WHICH_EAR: formatHtmlText(data.whichEar),
      SECURITY_DEPOSIT_AMOUNT: formatHtmlText(formatCurrencyForTemplate(data.securityDepositAmount)),
      CENTER_NAME: formatHtmlText(data.centerName),
      VISIT_DATE: formatHtmlText(data.visitDate),
      TERMS_TEXT: formatHtmlText(data.terms, true),
      FOOTER_TEXT: formatHtmlText(footerText, true),
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    images
  );
}
