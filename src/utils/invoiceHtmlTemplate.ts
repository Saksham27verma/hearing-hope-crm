import type { InvoiceData } from '@/components/invoices/InvoiceTemplate';

export function formatInvoiceCurrency(amount: number) {
  const n = Math.round(Number(amount) || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

type InvoiceLineItem = InvoiceData['items'][number] & {
  discountPercent?: number;
  sellingPrice?: number;
  unitPrice?: number;
  hsnCode?: string;
  /** Total GST for the row (qty applied), whole rupees — matches CRM enquiry lines. */
  taxLineAmount?: number;
  /** Inclusive line total (qty applied), whole rupees — matches CRM `finalAmount` × qty. */
  inclusiveLineAmount?: number;
};

/** GST and line total aligned to CRM: whole rupees, inclusive total is source of truth when provided. */
function lineGstAndTotalForHtmlRow(
  item: InvoiceLineItem,
  invoiceData: InvoiceData
): { linePreTax: number; gstAmount: number; lineTotal: number } {
  const quantity = item.quantity || 1;
  const unitSelling = Number(item.rate) || Number(item.sellingPrice) || 0;
  const linePreTax = Math.round(unitSelling * quantity);
  const gstPercent =
    typeof item.gstPercent === 'number' && !Number.isNaN(item.gstPercent)
      ? item.gstPercent
      : Number((invoiceData as { taxRate?: number }).taxRate) || 0;

  const inclusiveKnown =
    item.inclusiveLineAmount != null && !Number.isNaN(Number(item.inclusiveLineAmount));
  const inclusive = inclusiveKnown ? Math.round(Number(item.inclusiveLineAmount)) : null;

  let gstAmount =
    item.taxLineAmount != null && !Number.isNaN(Number(item.taxLineAmount))
      ? Math.round(Number(item.taxLineAmount))
      : Math.round((linePreTax * gstPercent) / 100);

  let lineTotal = inclusive ?? linePreTax + gstAmount;

  if (inclusive != null) {
    gstAmount = Math.max(0, inclusive - linePreTax);
    lineTotal = inclusive;
  } else {
    const drift = lineTotal - (linePreTax + gstAmount);
    if (drift !== 0 && Math.abs(drift) <= 1) {
      gstAmount += drift;
      lineTotal = linePreTax + gstAmount;
    }
  }

  return { linePreTax, gstAmount, lineTotal };
}

/**
 * Discount % for display in HTML tables. Never use `discount` (rupees) as a percentage —
 * when discountPercent is 0, `item.discountPercent || item.discount` wrongly treated rupees as %.
 */
export function lineItemDiscountPercent(item: InvoiceLineItem): number {
  if (typeof item.discountPercent === 'number' && !Number.isNaN(item.discountPercent)) {
    return Math.max(0, Math.min(100, Math.round(item.discountPercent)));
  }
  const unitSelling = Number(item.rate) || Number(item.sellingPrice) || 0;
  const mrp = Number(item.mrp) > 0 ? Number(item.mrp) : unitSelling;
  if (mrp <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((mrp - unitSelling) / mrp) * 100)));
}

export function processInvoiceHtmlTemplate(
  html: string,
  invoiceData: InvoiceData,
  customTemplate?: { images?: Array<{ placeholder: string; url: string }> } | null
): string {
  let processed = html;
  const formatCurrency = formatInvoiceCurrency;

  if (customTemplate?.images) {
    customTemplate.images.forEach((img) => {
      processed = processed.replace(new RegExp(img.placeholder, 'g'), img.url);
    });
  }

  processed = processed
    .replace(/\{\{COMPANY_NAME\}\}/g, invoiceData.companyName || '')
    .replace(/\{\{COMPANY_ADDRESS\}\}/g, (invoiceData.companyAddress || '').replace(/\n/g, '<br/>'))
    .replace(/\{\{COMPANY_PHONE\}\}/g, invoiceData.companyPhone || '')
    .replace(/\{\{COMPANY_EMAIL\}\}/g, invoiceData.companyEmail || '')
    .replace(/\{\{COMPANY_GSTIN\}\}/g, invoiceData.companyGST || 'N/A');

  processed = processed
    .replace(/\{\{CUSTOMER_NAME\}\}/g, invoiceData.customerName || '')
    .replace(/\{\{CUSTOMER_ADDRESS\}\}/g, invoiceData.customerAddress || '')
    .replace(/\{\{CUSTOMER_PHONE\}\}/g, invoiceData.customerPhone || '')
    .replace(/\{\{CUSTOMER_EMAIL\}\}/g, invoiceData.customerEmail || '')
    .replace(/\{\{CUSTOMER_GSTIN\}\}/g, (invoiceData as { customerGSTIN?: string }).customerGSTIN || invoiceData.customerGST || 'N/A')
    .replace(/\{\{INVOICE_NUMBER\}\}/g, invoiceData.invoiceNumber || '')
    .replace(/\{\{INVOICE_DATE\}\}/g, invoiceData.invoiceDate || new Date().toLocaleDateString('en-IN'))
    .replace(/\{\{DUE_DATE\}\}/g, invoiceData.dueDate || '')
    .replace(/\{\{PAYMENT_MODE\}\}/g, (invoiceData as { paymentMode?: string }).paymentMode || invoiceData.paymentMethod || 'Cash')
    .replace(/\{\{WARRANTY_PERIOD\}\}/g, (invoiceData as { warrantyPeriod?: string }).warrantyPeriod || '1 Year')
    .replace(/\{\{TRIAL_PERIOD\}\}/g, (invoiceData as { trialPeriod?: string }).trialPeriod || '7')
    .replace(/\{\{SUBTOTAL\}\}/g, formatCurrency(invoiceData.subtotal || 0))
    .replace(/\{\{TAX_RATE\}\}/g, String((invoiceData as { taxRate?: number }).taxRate || 0))
    .replace(
      /\{\{TAX_AMOUNT\}\}/g,
      formatCurrency((invoiceData as { taxAmount?: number }).taxAmount ?? invoiceData.totalGST ?? 0)
    )
    .replace(/\{\{TOTAL\}\}/g, formatCurrency((invoiceData as { total?: number }).total || invoiceData.grandTotal || 0))
    .replace(/\{\{TERMS_TEXT\}\}/g, (invoiceData.terms || '').replace(/\n/g, '<br/>'))
    .replace(/\{\{SALESPERSON\}\}/g, invoiceData.salesperson || '')
    .replace(/\{\{REFERENCE_DOCTOR\}\}/g, invoiceData.referenceDoctor || '');

  if (invoiceData.items && invoiceData.items.length > 0) {
    const isSixColumnInvoiceTemplate =
      /class=["']item-table["']/i.test(html) &&
      /Description\s*&(?:amp;)?\s*Specification/i.test(html) &&
      /<th[^>]*>\s*HSN\s*<\/th>/i.test(html) &&
      /<th[^>]*>\s*Qty\s*<\/th>/i.test(html) &&
      /<th[^>]*>\s*Price\s*<\/th>/i.test(html) &&
      /<th[^>]*>\s*GST\s*Amount\s*<\/th>/i.test(html) &&
      /<th[^>]*>\s*Total\s*Amount\s*<\/th>/i.test(html);
    const itemsHTML = invoiceData.items
      .map((raw, index) => {
        const item = raw as InvoiceLineItem;
        const quantity = item.quantity || 1;
        const unitSelling = Number(item.rate) || Number(item.sellingPrice) || 0;
        const mrpUnit = Number(item.mrp) > 0 ? Number(item.mrp) : unitSelling;
        const totalMRP = Math.round(mrpUnit * quantity);
        const discountPct = lineItemDiscountPercent(item);
        const { linePreTax: totalSellingPrice, gstAmount, lineTotal } = lineGstAndTotalForHtmlRow(
          item,
          invoiceData
        );
        const gstPercent =
          typeof item.gstPercent === 'number' && !Number.isNaN(item.gstPercent)
            ? item.gstPercent
            : Number((invoiceData as { taxRate?: number }).taxRate) || 0;
        const hsn = item.hsnCode || '9021';

        if (isSixColumnInvoiceTemplate) {
          return `
        <tr>
          <td>
            <div class="product-title">${index + 1}. ${item.name || item.description || ''}</div>
            <div class="product-meta">
              ${item.description ? `${item.description}<br/>` : ''}
              ${item.serialNumber ? `S/N: ${item.serialNumber}` : ''}
            </div>
          </td>
          <td>${hsn}</td>
          <td class="text-center">${quantity}</td>
          <td class="text-right">${formatCurrency(unitSelling)}</td>
          <td class="text-right">${formatCurrency(gstAmount)}</td>
          <td class="text-right">${formatCurrency(lineTotal)}</td>
        </tr>
        `;
        }

        return `
      <tr>
        <td style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:25px" valign="top"><b>${index + 1}</b></td>
        <td style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc"><b><font size="2">${item.name || item.description || ''}</font></b><br><pre wrap="soft" style="width:150px">${item.description || ''}</pre></td>
        <td valign="top" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:80px">${item.serialNumber || 'N/A'}</td>
        <td valign="top" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc">${hsn}</td>
        <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:80px">${formatCurrency(mrpUnit)}</td>
        <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:25px">${quantity}</td>
        <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:80px">${formatCurrency(totalMRP)}</td>
        <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc">${discountPct}%</td>
        <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:90px">${formatCurrency(totalSellingPrice)}</td>
        <td valign="top" align="right" style="border-right: 1px dotted gray;border-bottom:2px dotted #c0c6cc;width:27px">${gstPercent}%</td>
        <td valign="top" align="right" style="border-bottom:2px dotted #c0c6cc">${formatCurrency(gstAmount)}</td>
      </tr>
      `;
      })
      .join('');
    processed = processed.replace(/\{\{ITEMS_PLACEHOLDER\}\}/g, itemsHTML);
  }

  // Guardrail: remove accidental pasted Firebase Storage links from text nodes only.
  // Do not touch URLs used inside attributes (src/href), otherwise protected image tokens break.
  processed = processed
    .replace(/>\s*https:\/\/firebasestorage\.googleapis\.com\/[^<]*</g, '><')
    .replace(/>\s*alt=media&token=[^<\s]+\s*</g, '><');

  return processed;
}
