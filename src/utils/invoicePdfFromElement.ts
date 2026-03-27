import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface InvoicePdfSettings {
  format: 'A4' | 'Letter' | 'A5';
  orientation: 'portrait' | 'landscape';
  quality: number;
  margin: number;
  includeBackground: boolean;
  watermark: string;
}

export const DEFAULT_INVOICE_PDF_SETTINGS: InvoicePdfSettings = {
  format: 'A4',
  orientation: 'portrait',
  quality: 1.0,
  margin: 10,
  includeBackground: true,
  watermark: '',
};

export async function createInvoicePdfBlobFromElement(
  element: HTMLElement | null,
  invoiceNumber: string,
  pdfSettings: InvoicePdfSettings = DEFAULT_INVOICE_PDF_SETTINGS
): Promise<{ blob: Blob; fileName: string }> {
  if (!element) {
    throw new Error('Invoice preview is not ready yet.');
  }

  const canvas = await html2canvas(element, {
    scale: pdfSettings.quality,
    useCORS: true,
    allowTaint: true,
    backgroundColor: pdfSettings.includeBackground ? '#ffffff' : null,
    width: element.scrollWidth,
    height: element.scrollHeight,
  });

  const imgWidth = pdfSettings.format === 'A4' ? 210 : pdfSettings.format === 'Letter' ? 216 : 148;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation: pdfSettings.orientation,
    unit: 'mm',
    format: pdfSettings.format.toLowerCase() as 'a4' | 'letter' | 'a5',
  });

  if (pdfSettings.watermark) {
    pdf.setTextColor(200, 200, 200);
    pdf.setFontSize(50);
    pdf.text(pdfSettings.watermark, imgWidth / 2, imgHeight / 2, {
      angle: 45,
      align: 'center',
    });
  }

  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(
    imgData,
    'PNG',
    pdfSettings.margin,
    pdfSettings.margin,
    imgWidth - pdfSettings.margin * 2,
    imgHeight - pdfSettings.margin * 2
  );

  const fileName = `invoice-${invoiceNumber}.pdf`;
  const blob = pdf.output('blob');
  return { blob, fileName };
}

export function openPdfBlobPrintDialog(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  setTimeout(() => {
    try {
      w?.focus();
      w?.print();
    } catch {
      /* ignore */
    }
  }, 500);
}

/** Open generated invoice PDF in a new tab (preview) without triggering print. */
export function openPdfBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.replace(/[^\w.-]+/g, '-');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
