/** Company / appearance overrides merged into PDF invoice data. */
export interface InvoiceConfig {
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyGST?: string;
  companyLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  showMRP?: boolean;
  showSerialNumbers?: boolean;
  showGST?: boolean;
  customTerms?: string;
  customFooter?: string;
}

/** Persisted in localStorage — applies to PDF view/download from this browser. */
export type InvoicePdfTemplateId = 'classic' | 'modern' | 'medical';

const KEY_TEMPLATE = 'hope_crm_invoice_pdf_template_v1';
const KEY_CONFIG = 'hope_crm_invoice_pdf_config_v1';

export const DEFAULT_INVOICE_PDF_CONFIG: InvoiceConfig = {
  companyName: 'Hope Hearing Solutions',
  companyAddress: 'Your Company Address\nCity, State - PIN Code',
  companyPhone: '+91 XXXXX XXXXX',
  companyEmail: 'info@hopehearing.com',
  companyGST: 'GST Number Here',
  primaryColor: '#F17336',
  secondaryColor: '#2563EB',
  showMRP: true,
  showSerialNumbers: true,
  showGST: true,
  customTerms: '',
  customFooter: '',
};

export const INVOICE_PDF_TEMPLATE_OPTIONS: {
  id: InvoicePdfTemplateId;
  label: string;
  description: string;
}[] = [
  {
    id: 'classic',
    label: 'Classic (detailed)',
    description: 'Full table: MRP, serial, GST% — best for accounting.',
  },
  {
    id: 'modern',
    label: 'Modern (compact)',
    description: 'Cleaner layout with product, serial, qty, rate, amount.',
  },
  {
    id: 'medical',
    label: 'Medical / patient',
    description: 'Same layout as Classic; use billing text below for clinic wording.',
  },
];

export function getInvoicePdfTemplate(): InvoicePdfTemplateId {
  if (typeof window === 'undefined') return 'classic';
  const v = localStorage.getItem(KEY_TEMPLATE);
  if (v === 'modern' || v === 'medical') return v;
  return 'classic';
}

export function setInvoicePdfTemplate(id: InvoicePdfTemplateId): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_TEMPLATE, id);
}

export function getInvoicePdfConfig(): InvoiceConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_INVOICE_PDF_CONFIG };
  try {
    const raw = localStorage.getItem(KEY_CONFIG);
    if (!raw) return { ...DEFAULT_INVOICE_PDF_CONFIG };
    const parsed = JSON.parse(raw) as Partial<InvoiceConfig>;
    return { ...DEFAULT_INVOICE_PDF_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_INVOICE_PDF_CONFIG };
  }
}

export function setInvoicePdfConfig(config: InvoiceConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY_CONFIG, JSON.stringify(config));
}

/** Maps UI template to react-pdf root (medical → classic PDF). */
export function resolveInvoicePdfRendererId(id: InvoicePdfTemplateId): 'classic' | 'modern' {
  return id === 'modern' ? 'modern' : 'classic';
}
