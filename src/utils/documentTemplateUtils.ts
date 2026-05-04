export type ManagedDocumentType =
  | 'invoice'
  | 'booking_receipt'
  | 'trial_receipt'
  | 'payment_acknowledgment'
  | 'salary_slip';

export type TemplateImage = {
  placeholder: string;
  url: string;
};

export type TemplatePlaceholderSection = {
  title: string;
  tokens: string[];
};

const baseHtmlShell = (title: string, accent: string, body: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #f3f4f6;
      font-family: Arial, sans-serif;
      color: #1f2937;
    }
    .doc {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
      border-radius: 18px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 3px solid ${accent};
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .logo {
      max-height: 72px;
      max-width: 180px;
      object-fit: contain;
      margin-bottom: 12px;
    }
    .eyebrow {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: ${accent};
      font-weight: 700;
      margin-bottom: 6px;
    }
    .title {
      font-size: 30px;
      font-weight: 700;
      margin: 0;
    }
    .muted {
      color: #6b7280;
      line-height: 1.6;
    }
    .meta {
      text-align: right;
      min-width: 220px;
    }
    .meta-row {
      margin-bottom: 8px;
      font-size: 14px;
    }
    .meta-label {
      color: #6b7280;
      margin-right: 6px;
    }
    .section {
      margin-top: 24px;
    }
    .section-title {
      margin: 0 0 12px;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${accent};
    }
    .card {
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 18px;
      background: #ffffff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 18px;
    }
    .field-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      white-space: pre-wrap;
    }
    .hero {
      border-radius: 16px;
      padding: 18px 20px;
      margin-top: 24px;
      background: ${accent}15;
      border: 1px solid ${accent}40;
    }
    .hero-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: ${accent};
      margin-bottom: 6px;
      font-weight: 700;
    }
    .hero-value {
      font-size: 28px;
      font-weight: 800;
      color: ${accent};
    }
    .footer {
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 13px;
      line-height: 1.7;
      white-space: pre-wrap;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .doc {
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="doc">
    ${body}
  </div>
</body>
</html>`;

const invoiceSample = baseHtmlShell(
  'Invoice Template',
  '#2563eb',
  `
  <div class="header">
    <div>
      <img src="{{LOGO_PLACEHOLDER}}" alt="Logo" class="logo" />
      <div class="eyebrow">Invoice</div>
      <h1 class="title">{{COMPANY_NAME}}</h1>
      <div class="muted">{{COMPANY_ADDRESS}}</div>
      <div class="muted">Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}</div>
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Invoice #</span><strong>{{INVOICE_NUMBER}}</strong></div>
      <div class="meta-row"><span class="meta-label">Date</span>{{INVOICE_DATE}}</div>
      <div class="meta-row"><span class="meta-label">Due</span>{{DUE_DATE}}</div>
      <div class="meta-row"><span class="meta-label">Payment Mode</span>{{PAYMENT_MODE}}</div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Bill To</h2>
    <div class="card grid">
      <div><div class="field-label">Customer Name</div><div class="field-value">{{CUSTOMER_NAME}}</div></div>
      <div><div class="field-label">Phone</div><div class="field-value">{{CUSTOMER_PHONE}}</div></div>
      <div><div class="field-label">Address</div><div class="field-value">{{CUSTOMER_ADDRESS}}</div></div>
      <div><div class="field-label">Email</div><div class="field-value">{{CUSTOMER_EMAIL}}</div></div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Items</h2>
    <div class="card">{{ITEMS_PLACEHOLDER}}</div>
  </div>
  <div class="hero">
    <div class="hero-label">Total</div>
    <div class="hero-value">{{TOTAL}}</div>
  </div>
  <div class="footer">Terms: {{TERMS_TEXT}}</div>
`
);

const bookingReceiptSample = baseHtmlShell(
  'Booking Receipt Template',
  '#2563eb',
  `
  <div class="header">
    <div>
      <img src="{{LOGO_PLACEHOLDER}}" alt="Logo" class="logo" />
      <div class="eyebrow">Booking Receipt</div>
      <h1 class="title">{{COMPANY_NAME}}</h1>
      <div class="muted">{{COMPANY_ADDRESS}}</div>
      <div class="muted">Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}</div>
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Receipt #</span><strong>{{RECEIPT_NUMBER}}</strong></div>
      <div class="meta-row"><span class="meta-label">Receipt Date</span>{{RECEIPT_DATE}}</div>
      <div class="meta-row"><span class="meta-label">Booking Date</span>{{BOOKING_DATE}}</div>
      <div class="meta-row"><span class="meta-label">Center</span>{{CENTER_NAME}}</div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Patient Details</h2>
    <div class="card grid">
      <div><div class="field-label">Patient Name</div><div class="field-value">{{PATIENT_NAME}}</div></div>
      <div><div class="field-label">Phone</div><div class="field-value">{{PATIENT_PHONE}}</div></div>
      <div><div class="field-label">Email</div><div class="field-value">{{PATIENT_EMAIL}}</div></div>
      <div><div class="field-label">Address</div><div class="field-value">{{PATIENT_ADDRESS}}</div></div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Booking Details</h2>
    <div class="card grid">
      <div><div class="field-label">Device Booked</div><div class="field-value">{{DEVICE_NAME}}</div></div>
      <div><div class="field-label">MRP</div><div class="field-value">{{MRP}}</div></div>
      <div><div class="field-label">Selling Price</div><div class="field-value">{{SELLING_PRICE}}</div></div>
      <div><div class="field-label">Quantity</div><div class="field-value">{{QUANTITY}}</div></div>
      <div><div class="field-label">Payment Mode</div><div class="field-value">{{PAYMENT_MODE}}</div></div>
      <div><div class="field-label">Visit Date</div><div class="field-value">{{VISIT_DATE}}</div></div>
    </div>
  </div>
  <div class="hero">
    <div class="hero-label">Advance Received</div>
    <div class="hero-value">{{ADVANCE_AMOUNT}}</div>
  </div>
  <div class="section">
    <div class="card">
      <div class="field-label">Balance Amount</div>
      <div class="field-value">{{BALANCE_AMOUNT}}</div>
    </div>
  </div>
  <div class="footer">Terms: {{TERMS_TEXT}}&#10;&#10;{{FOOTER_TEXT}}</div>
`
);

const trialReceiptSample = baseHtmlShell(
  'Trial Receipt Template',
  '#f59e0b',
  `
  <div class="header">
    <div>
      <img src="{{LOGO_PLACEHOLDER}}" alt="Logo" class="logo" />
      <div class="eyebrow">Trial Receipt</div>
      <h1 class="title">{{COMPANY_NAME}}</h1>
      <div class="muted">{{COMPANY_ADDRESS}}</div>
      <div class="muted">Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}</div>
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Receipt #</span><strong>{{RECEIPT_NUMBER}}</strong></div>
      <div class="meta-row"><span class="meta-label">Receipt Date</span>{{RECEIPT_DATE}}</div>
      <div class="meta-row"><span class="meta-label">Trial Start</span>{{TRIAL_START_DATE}}</div>
      <div class="meta-row"><span class="meta-label">Trial End</span>{{TRIAL_END_DATE}}</div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Patient Details</h2>
    <div class="card grid">
      <div><div class="field-label">Patient Name</div><div class="field-value">{{PATIENT_NAME}}</div></div>
      <div><div class="field-label">Phone</div><div class="field-value">{{PATIENT_PHONE}}</div></div>
      <div><div class="field-label">Email</div><div class="field-value">{{PATIENT_EMAIL}}</div></div>
      <div><div class="field-label">Address</div><div class="field-value">{{PATIENT_ADDRESS}}</div></div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Trial Details</h2>
    <div class="card grid">
      <div><div class="field-label">Device Used</div><div class="field-value">{{DEVICE_USED}}</div></div>
      <div><div class="field-label">Trial Type</div><div class="field-value">{{TRIAL_TYPE}}</div></div>
      <div><div class="field-label">Duration</div><div class="field-value">{{TRIAL_DURATION_DAYS}}</div></div>
      <div><div class="field-label">Serial Number</div><div class="field-value">{{SERIAL_NUMBER}}</div></div>
      <div><div class="field-label">Ear</div><div class="field-value">{{WHICH_EAR}}</div></div>
      <div><div class="field-label">Security deposit</div><div class="field-value">{{SECURITY_DEPOSIT_AMOUNT}}</div></div>
      <div><div class="field-label">Center</div><div class="field-value">{{CENTER_NAME}}</div></div>
    </div>
  </div>
  <div class="footer">Terms: {{TERMS_TEXT}}&#10;&#10;{{FOOTER_TEXT}}</div>
`
);

const paymentAcknowledgmentSample = baseHtmlShell(
  'Payment Acknowledgment Template',
  '#0f766e',
  `
  <div class="header">
    <div>
      <img src="{{LOGO_PLACEHOLDER}}" alt="Logo" class="logo" />
      <div class="eyebrow">{{DOCUMENT_TITLE}}</div>
      <h1 class="title">{{COMPANY_NAME}}</h1>
      <div class="muted">{{COMPANY_ADDRESS}}</div>
      <div class="muted">Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}</div>
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Document #</span><strong>{{DOCUMENT_NUMBER}}</strong></div>
      <div class="meta-row"><span class="meta-label">Statement date</span>{{STATEMENT_DATE}}</div>
      <div class="meta-row"><span class="meta-label">Center</span>{{CENTER_NAME}}</div>
      <div class="meta-row"><span class="meta-label">Entries</span>{{LINE_COUNT}}</div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Customer</h2>
    <div class="card grid">
      <div><div class="field-label">Name</div><div class="field-value">{{PATIENT_NAME}}</div></div>
      <div><div class="field-label">Phone</div><div class="field-value">{{PATIENT_PHONE}}</div></div>
      <div><div class="field-label">Email</div><div class="field-value">{{PATIENT_EMAIL}}</div></div>
      <div><div class="field-label">Address</div><div class="field-value">{{PATIENT_ADDRESS}}</div></div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Payment history</h2>
    <div class="card">{{PAYMENTS_TABLE_HTML}}</div>
  </div>
  <div class="hero">
    <div class="hero-label">Total received (per ledger)</div>
    <div class="hero-value">{{TOTAL_PAID}}</div>
  </div>
  <div class="footer">{{TERMS_TEXT}}&#10;&#10;{{FOOTER_TEXT}}</div>
`
);

const salarySlipSample = baseHtmlShell(
  'Salary Slip Template',
  '#1d4ed8',
  `
  <div class="header">
    <div>
      <img src="{{LOGO_PLACEHOLDER}}" alt="Logo" class="logo" />
      <div class="eyebrow">Salary Slip</div>
      <h1 class="title">{{COMPANY_NAME}}</h1>
      <div class="muted">{{COMPANY_ADDRESS}}</div>
      <div class="muted">Phone: {{COMPANY_PHONE}} | Email: {{COMPANY_EMAIL}}</div>
    </div>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Month</span><strong>{{SALARY_MONTH}}</strong></div>
      <div class="meta-row"><span class="meta-label">Employee ID</span>{{EMPLOYEE_ID}}</div>
      <div class="meta-row"><span class="meta-label">Status</span>{{PAYMENT_STATUS}}</div>
      <div class="meta-row"><span class="meta-label">Paid Date</span>{{PAID_DATE}}</div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Employee Details</h2>
    <div class="card grid">
      <div><div class="field-label">Employee Name</div><div class="field-value">{{EMPLOYEE_NAME}}</div></div>
      <div><div class="field-label">Designation</div><div class="field-value">{{DESIGNATION}}</div></div>
      <div><div class="field-label">Department</div><div class="field-value">{{DEPARTMENT}}</div></div>
      <div><div class="field-label">Date of Joining</div><div class="field-value">{{DATE_OF_JOINING}}</div></div>
      <div><div class="field-label">Phone</div><div class="field-value">{{EMPLOYEE_PHONE}}</div></div>
      <div><div class="field-label">Email</div><div class="field-value">{{EMPLOYEE_EMAIL}}</div></div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Earnings</h2>
    <div class="card grid">
      <div><div class="field-label">Basic Salary</div><div class="field-value">{{BASIC_SALARY}}</div></div>
      <div><div class="field-label">HRA</div><div class="field-value">{{HRA}}</div></div>
      <div><div class="field-label">Travel Allowance</div><div class="field-value">{{TRAVEL_ALLOWANCE}}</div></div>
      <div><div class="field-label">Incentives</div><div class="field-value">{{INCENTIVES}}</div></div>
      <div><div class="field-label">Total Earnings</div><div class="field-value">{{TOTAL_EARNINGS}}</div></div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">Deductions</h2>
    <div class="card grid">
      <div><div class="field-label">Festival Advance</div><div class="field-value">{{FESTIVAL_ADVANCE}}</div></div>
      <div><div class="field-label">General Advance</div><div class="field-value">{{GENERAL_ADVANCE}}</div></div>
      <div><div class="field-label">Other Deductions</div><div class="field-value">{{DEDUCTIONS}}</div></div>
      <div><div class="field-label">Total Deductions</div><div class="field-value">{{TOTAL_DEDUCTIONS}}</div></div>
    </div>
  </div>
  <div class="hero">
    <div class="hero-label">Net Salary</div>
    <div class="hero-value">{{NET_SALARY}}</div>
  </div>
  <div class="footer">Remarks: {{REMARKS}}</div>
`
);

export const DOCUMENT_TEMPLATE_META: Record<ManagedDocumentType, {
  label: string;
  color: 'primary' | 'warning' | 'secondary';
  sampleHtml: string;
  placeholderSections: TemplatePlaceholderSection[];
}> = {
  invoice: {
    label: 'Invoice',
    color: 'secondary',
    sampleHtml: invoiceSample,
    placeholderSections: [
      { title: 'Company', tokens: ['{{COMPANY_NAME}}', '{{COMPANY_ADDRESS}}', '{{COMPANY_PHONE}}', '{{COMPANY_EMAIL}}'] },
      { title: 'Customer', tokens: ['{{CUSTOMER_NAME}}', '{{CUSTOMER_ADDRESS}}', '{{CUSTOMER_PHONE}}', '{{CUSTOMER_EMAIL}}', '{{CUSTOMER_GSTIN}}'] },
      { title: 'Invoice', tokens: ['{{INVOICE_NUMBER}}', '{{INVOICE_DATE}}', '{{DUE_DATE}}', '{{PAYMENT_MODE}}'] },
      { title: 'Amounts', tokens: ['{{SUBTOTAL}}', '{{TAX_RATE}}', '{{TAX_AMOUNT}}', '{{TOTAL}}', '{{TERMS_TEXT}}'] },
      { title: 'Items', tokens: ['{{ITEMS_PLACEHOLDER}}'] },
      { title: 'Images', tokens: ['{{LOGO_PLACEHOLDER}}', '{{SIGNATURE_PLACEHOLDER}}'] },
    ],
  },
  booking_receipt: {
    label: 'Booking Receipt',
    color: 'primary',
    sampleHtml: bookingReceiptSample,
    placeholderSections: [
      { title: 'Company', tokens: ['{{COMPANY_NAME}}', '{{COMPANY_ADDRESS}}', '{{COMPANY_PHONE}}', '{{COMPANY_EMAIL}}'] },
      { title: 'Receipt', tokens: ['{{RECEIPT_NUMBER}}', '{{RECEIPT_DATE}}', '{{BOOKING_DATE}}', '{{VISIT_DATE}}', '{{CENTER_NAME}}'] },
      { title: 'Patient', tokens: ['{{PATIENT_NAME}}', '{{PATIENT_PHONE}}', '{{PATIENT_EMAIL}}', '{{PATIENT_ADDRESS}}'] },
      { title: 'Booking Details', tokens: ['{{DEVICE_NAME}}', '{{DEVICE_BRAND}}', '{{DEVICE_MODEL}}', '{{MRP}}', '{{SELLING_PRICE}}', '{{TOTAL_AGREED_VALUE}}', '{{QUANTITY}}', '{{ADVANCE_AMOUNT}}', '{{BALANCE_AMOUNT}}', '{{PAYMENT_MODE}}'] },
      { title: 'Copy', tokens: ['{{TERMS_TEXT}}', '{{FOOTER_TEXT}}'] },
      { title: 'Images', tokens: ['{{LOGO_PLACEHOLDER}}', '{{SIGNATURE_PLACEHOLDER}}'] },
    ],
  },
  trial_receipt: {
    label: 'Trial Receipt',
    color: 'warning',
    sampleHtml: trialReceiptSample,
    placeholderSections: [
      { title: 'Company', tokens: ['{{COMPANY_NAME}}', '{{COMPANY_ADDRESS}}', '{{COMPANY_PHONE}}', '{{COMPANY_EMAIL}}'] },
      { title: 'Receipt', tokens: ['{{RECEIPT_NUMBER}}', '{{RECEIPT_DATE}}', '{{TRIAL_DATE}}', '{{TRIAL_START_DATE}}', '{{TRIAL_END_DATE}}', '{{CENTER_NAME}}'] },
      { title: 'Patient', tokens: ['{{PATIENT_NAME}}', '{{PATIENT_PHONE}}', '{{PATIENT_EMAIL}}', '{{PATIENT_ADDRESS}}'] },
      {
        title: 'Trial Details',
        tokens: [
          '{{DEVICE_USED}}',
          '{{TRIAL_TYPE}}',
          '{{TRIAL_DURATION_DAYS}}',
          '{{SERIAL_NUMBER}}',
          '{{WHICH_EAR}}',
          '{{SECURITY_DEPOSIT_AMOUNT}}',
        ],
      },
      { title: 'Copy', tokens: ['{{TERMS_TEXT}}', '{{FOOTER_TEXT}}'] },
      { title: 'Images', tokens: ['{{LOGO_PLACEHOLDER}}', '{{SIGNATURE_PLACEHOLDER}}'] },
    ],
  },
  payment_acknowledgment: {
    label: 'Payment acknowledgment',
    color: 'primary',
    sampleHtml: paymentAcknowledgmentSample,
    placeholderSections: [
      { title: 'Company', tokens: ['{{COMPANY_NAME}}', '{{COMPANY_ADDRESS}}', '{{COMPANY_PHONE}}', '{{COMPANY_EMAIL}}'] },
      {
        title: 'Document',
        tokens: [
          '{{DOCUMENT_TITLE}}',
          '{{DOCUMENT_NUMBER}}',
          '{{STATEMENT_DATE}}',
          '{{CENTER_NAME}}',
          '{{LINE_COUNT}}',
          '{{TOTAL_PAID}}',
        ],
      },
      { title: 'Customer', tokens: ['{{PATIENT_NAME}}', '{{PATIENT_PHONE}}', '{{PATIENT_EMAIL}}', '{{PATIENT_ADDRESS}}'] },
      { title: 'Ledger', tokens: ['{{PAYMENTS_TABLE_HTML}}'] },
      { title: 'Copy', tokens: ['{{TERMS_TEXT}}', '{{FOOTER_TEXT}}'] },
      { title: 'Images', tokens: ['{{LOGO_PLACEHOLDER}}', '{{SIGNATURE_PLACEHOLDER}}'] },
    ],
  },
  salary_slip: {
    label: 'Salary Slip',
    color: 'secondary',
    sampleHtml: salarySlipSample,
    placeholderSections: [
      { title: 'Company', tokens: ['{{COMPANY_NAME}}', '{{COMPANY_ADDRESS}}', '{{COMPANY_PHONE}}', '{{COMPANY_EMAIL}}'] },
      { title: 'Slip Header', tokens: ['{{SALARY_MONTH}}', '{{EMPLOYEE_ID}}', '{{PAYMENT_STATUS}}', '{{PAID_DATE}}'] },
      {
        title: 'Employee',
        tokens: ['{{EMPLOYEE_NAME}}', '{{DESIGNATION}}', '{{DEPARTMENT}}', '{{DATE_OF_JOINING}}', '{{EMPLOYEE_PHONE}}', '{{EMPLOYEE_EMAIL}}'],
      },
      {
        title: 'Earnings & Deductions',
        tokens: [
          '{{BASIC_SALARY}}',
          '{{HRA}}',
          '{{TRAVEL_ALLOWANCE}}',
          '{{INCENTIVES}}',
          '{{TOTAL_EARNINGS}}',
          '{{FESTIVAL_ADVANCE}}',
          '{{GENERAL_ADVANCE}}',
          '{{DEDUCTIONS}}',
          '{{TOTAL_DEDUCTIONS}}',
          '{{NET_SALARY}}',
          '{{REMARKS}}',
        ],
      },
      { title: 'Images', tokens: ['{{LOGO_PLACEHOLDER}}', '{{SIGNATURE_PLACEHOLDER}}'] },
    ],
  },
};

export const getDocumentTypeLabel = (documentType: ManagedDocumentType) =>
  DOCUMENT_TEMPLATE_META[documentType].label;

export const extractHtmlBody = (html: string) => {
  const styleBlocks = Array.from(html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi))
    .map((match) => match[0])
    .join('\n');
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = match?.[1] ?? html;
  return `${styleBlocks}${content}`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const replaceTemplateTokens = (
  html: string,
  replacements: Record<string, string>,
  images: TemplateImage[] = []
) => {
  let processed = extractHtmlBody(html);

  images.forEach((image) => {
    processed = processed.replace(new RegExp(escapeRegExp(image.placeholder), 'g'), image.url);
  });

  Object.entries(replacements).forEach(([key, value]) => {
    processed = processed.replace(new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'g'), value ?? '');
  });

  return processed;
};

export const getTemplatePreviewHtml = (
  documentType: ManagedDocumentType,
  html: string,
  images: TemplateImage[] = []
) => {
  const previewReplacements: Record<ManagedDocumentType, Record<string, string>> = {
    invoice: {
      COMPANY_NAME: 'Hope Hearing Solutions',
      COMPANY_ADDRESS: '123 Hearing Street<br/>New Delhi - 110001',
      COMPANY_PHONE: '+91 98765 43210',
      COMPANY_EMAIL: 'care@hopehearing.com',
      CUSTOMER_NAME: 'Rohan Sharma',
      CUSTOMER_ADDRESS: '14 Green Avenue, Delhi',
      CUSTOMER_PHONE: '+91 91234 56789',
      CUSTOMER_EMAIL: 'rohan@example.com',
      CUSTOMER_GSTIN: '07ABCDE1234F1Z5',
      INVOICE_NUMBER: 'INV-2026-001',
      INVOICE_DATE: '16/03/2026',
      DUE_DATE: '23/03/2026',
      PAYMENT_MODE: 'UPI',
      SUBTOTAL: 'Rs. 52,000',
      TAX_RATE: '18',
      TAX_AMOUNT: 'Rs. 9,360',
      TOTAL: 'Rs. 61,360',
      TERMS_TEXT: 'Payment due within 7 days.',
      ITEMS_PLACEHOLDER: '<div style="line-height:1.8"><strong>Motion Charge&Go</strong> x 1 - Rs. 61,360</div>',
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    booking_receipt: {
      COMPANY_NAME: 'Hope Hearing Solutions',
      COMPANY_ADDRESS: '123 Hearing Street<br/>New Delhi - 110001',
      COMPANY_PHONE: '+91 98765 43210',
      COMPANY_EMAIL: 'care@hopehearing.com',
      RECEIPT_NUMBER: 'BR-2026-001',
      RECEIPT_DATE: '16/03/2026',
      BOOKING_DATE: '16/03/2026',
      VISIT_DATE: '16/03/2026',
      CENTER_NAME: 'Main Center',
      PATIENT_NAME: 'Rohan Sharma',
      PATIENT_PHONE: '+91 91234 56789',
      PATIENT_EMAIL: 'rohan@example.com',
      PATIENT_ADDRESS: '14 Green Avenue, Delhi',
      DEVICE_NAME: 'Signia Motion Charge&Go 3AX',
      DEVICE_BRAND: 'Signia',
      DEVICE_MODEL: 'Motion Charge&Go 3AX',
      MRP: 'Rs. 78,000',
      SELLING_PRICE: 'Rs. 65,000',
      TOTAL_AGREED_VALUE: 'Rs. 65,000',
      QUANTITY: '1',
      ADVANCE_AMOUNT: 'Rs. 10,000',
      BALANCE_AMOUNT: 'Rs. 55,000',
      PAYMENT_MODE: 'Cash',
      TERMS_TEXT: 'Advance payment received against booking.',
      FOOTER_TEXT: 'Please keep this receipt for future reference.',
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    trial_receipt: {
      COMPANY_NAME: 'Hope Hearing Solutions',
      COMPANY_ADDRESS: '123 Hearing Street<br/>New Delhi - 110001',
      COMPANY_PHONE: '+91 98765 43210',
      COMPANY_EMAIL: 'care@hopehearing.com',
      RECEIPT_NUMBER: 'TR-2026-001',
      RECEIPT_DATE: '16/03/2026',
      TRIAL_DATE: '16/03/2026',
      TRIAL_START_DATE: '16/03/2026',
      TRIAL_END_DATE: '23/03/2026',
      TRIAL_DURATION_DAYS: '7 days',
      CENTER_NAME: 'Main Center',
      PATIENT_NAME: 'Rohan Sharma',
      PATIENT_PHONE: '+91 91234 56789',
      PATIENT_EMAIL: 'rohan@example.com',
      PATIENT_ADDRESS: '14 Green Avenue, Delhi',
      DEVICE_USED: 'Signia Styletto AX',
      TRIAL_TYPE: 'Home Trial',
      SERIAL_NUMBER: 'SN-HT-2045',
      WHICH_EAR: 'Right',
      SECURITY_DEPOSIT_AMOUNT: 'Rs. 5,000',
      TERMS_TEXT: 'Return the device by the end date in good condition.',
      FOOTER_TEXT: 'Damage or loss may attract charges.',
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    payment_acknowledgment: {
      COMPANY_NAME: 'Hope Hearing Solutions',
      COMPANY_ADDRESS: '123 Hearing Street<br/>New Delhi - 110001',
      COMPANY_PHONE: '+91 98765 43210',
      COMPANY_EMAIL: 'care@hopehearing.com',
      DOCUMENT_TITLE: 'Payment acknowledgment',
      DOCUMENT_NUMBER: 'PA-ENQ-2026-001',
      STATEMENT_DATE: '04/05/2026',
      CENTER_NAME: 'Main Center',
      LINE_COUNT: '3',
      PATIENT_NAME: 'Rohan Sharma',
      PATIENT_PHONE: '+91 91234 56789',
      PATIENT_EMAIL: 'rohan@example.com',
      PATIENT_ADDRESS: '14 Green Avenue, Delhi',
      TOTAL_PAID: 'Rs. 18,500',
      PAYMENTS_TABLE_HTML: `<table style="width:100%;border-collapse:collapse;font-size:13px">
<thead><tr style="border-bottom:2px solid #0f766e;text-align:left;color:#0f766e">
<th style="padding:8px 6px">Date</th><th style="padding:8px 6px">Particulars</th><th style="padding:8px 6px;text-align:right">Amount</th><th style="padding:8px 6px">Mode</th><th style="padding:8px 6px">Reference</th></tr></thead>
<tbody>
<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:8px 6px">2026-03-10</td><td style="padding:8px 6px">Test</td><td style="padding:8px 6px;text-align:right">Rs. 500</td><td style="padding:8px 6px">UPI</td><td style="padding:8px 6px">—</td></tr>
<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:8px 6px">2026-03-16</td><td style="padding:8px 6px">Booking</td><td style="padding:8px 6px;text-align:right">Rs. 10,000</td><td style="padding:8px 6px">Cash</td><td style="padding:8px 6px">—</td></tr>
<tr><td style="padding:8px 6px">2026-04-01</td><td style="padding:8px 6px">Sale</td><td style="padding:8px 6px;text-align:right">Rs. 8,000</td><td style="padding:8px 6px">Card</td><td style="padding:8px 6px">UTR123</td></tr>
</tbody></table>`,
      TERMS_TEXT: 'This statement summarizes payments recorded in our system for the customer named above.',
      FOOTER_TEXT: 'For queries, contact the center with this document number.',
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    salary_slip: {
      COMPANY_NAME: 'Hope Hearing Solutions',
      COMPANY_ADDRESS: '123 Hearing Street<br/>New Delhi - 110001',
      COMPANY_PHONE: '+91 98765 43210',
      COMPANY_EMAIL: 'care@hopehearing.com',
      SALARY_MONTH: 'March 2026',
      EMPLOYEE_ID: 'HH-EMP-1001',
      PAYMENT_STATUS: 'Paid',
      PAID_DATE: '31/03/2026',
      EMPLOYEE_NAME: 'Rohan Sharma',
      DESIGNATION: 'Audiologist',
      DEPARTMENT: 'Clinical',
      DATE_OF_JOINING: '01/07/2024',
      EMPLOYEE_PHONE: '+91 91234 56789',
      EMPLOYEE_EMAIL: 'rohan@example.com',
      BASIC_SALARY: 'Rs. 35,000',
      HRA: 'Rs. 8,000',
      TRAVEL_ALLOWANCE: 'Rs. 2,000',
      INCENTIVES: 'Rs. 3,000',
      TOTAL_EARNINGS: 'Rs. 48,000',
      FESTIVAL_ADVANCE: 'Rs. 1,000',
      GENERAL_ADVANCE: 'Rs. 2,000',
      DEDUCTIONS: 'Rs. 1,000',
      TOTAL_DEDUCTIONS: 'Rs. 4,000',
      NET_SALARY: 'Rs. 44,000',
      REMARKS: 'Keep up the excellent performance.',
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
  };

  return replaceTemplateTokens(html, previewReplacements[documentType], images);
};
