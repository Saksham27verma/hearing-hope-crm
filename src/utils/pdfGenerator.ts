import { pdf } from '@react-pdf/renderer';
import InvoiceTemplate, { InvoiceData } from '@/components/invoices/InvoiceTemplate';

function formatInvoiceDateLabel(value: unknown): string {
  if (value == null) return new Date().toLocaleDateString('en-IN');
  const v = value as any;
  if (typeof v?.toDate === 'function') return v.toDate().toLocaleDateString('en-IN');
  if (v?.seconds != null) return new Date(v.seconds * 1000).toLocaleDateString('en-IN');
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('en-IN') : d.toLocaleDateString('en-IN');
  }
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  return new Date().toLocaleDateString('en-IN');
}

/** Map enquiry + visit into the shape expected by `convertSaleToInvoiceData` / invoice PDF. */
export function enquiryVisitToInvoiceSalePayload(enquiry: any, visit: any) {
  const visitKey = visit?.id ?? visit?.visitDate ?? visit?.purchaseDate ?? 'sale';
  return {
    products: visit?.products || [],
    gstAmount: Number(visit?.taxAmount) || 0,
    totalAmount: Number(visit?.salesAfterTax) || 0,
    patientName: enquiry?.name || 'Patient',
    phone: enquiry?.phone || '',
    email: enquiry?.email || '',
    address: enquiry?.address || '',
    saleDate: visit?.purchaseDate || visit?.visitDate || visit?.date || new Date().toISOString().slice(0, 10),
    invoiceNumber: `INV-${String(enquiry?.id || 'enquiry').slice(0, 8)}-${String(visitKey).slice(0, 24)}`,
    notes: visit?.saleNotes || visit?.notes || '',
  };
}

export async function openEnquirySaleInvoicePDF(enquiry: any, visit: any): Promise<void> {
  return openInvoicePDF(enquiryVisitToInvoiceSalePayload(enquiry, visit));
}

export async function downloadEnquirySaleInvoicePDF(
  enquiry: any,
  visit: any,
  filename?: string
): Promise<void> {
  const payload = enquiryVisitToInvoiceSalePayload(enquiry, visit);
  const safeName = (filename || `invoice-${payload.invoiceNumber}.pdf`).replace(/[^\w.-]+/g, '-');
  return downloadInvoicePDF(payload, safeName);
}

// Function to convert sale data to invoice data format
export const convertSaleToInvoiceData = (sale: any): InvoiceData => {
  // Calculate totals
  const subtotal = sale.products?.reduce((sum: number, product: any) => {
    return sum + (product.sellingPrice || product.finalAmount || 0) * (product.quantity || 1);
  }, 0) || 0;

  const totalGST = sale.gstAmount || 0;
  const totalDiscount = sale.products?.reduce((sum: number, product: any) => {
    const mrp = product.mrp || 0;
    const sellingPrice = product.sellingPrice || product.finalAmount || 0;
    const discount = (mrp - sellingPrice) * (product.quantity || 1);
    return sum + (discount > 0 ? discount : 0);
  }, 0) || 0;

  const grandTotal = sale.totalAmount || subtotal + totalGST;

  // Format items
  const items = sale.products?.map((product: any, index: number) => ({
    id: product.id || `item-${index}`,
    name: product.name || 'Unknown Product',
    description: product.type || '',
    serialNumber: product.serialNumber || '',
    quantity: product.quantity || 1,
    rate: product.sellingPrice || product.finalAmount || 0,
    mrp: product.mrp || 0,
    discount: product.discount || 0,
    gstPercent: product.gstPercent || sale.gstPercentage || 0,
    amount: (product.sellingPrice || product.finalAmount || 0) * (product.quantity || 1),
  })) || [];

  // Generate invoice number if not present
  const invoiceNumber = sale.invoiceNumber || `INV-${Date.now()}`;

  const invoiceDate = formatInvoiceDateLabel(sale.saleDate);

  return {
    // Company Information (you can customize these)
    companyName: 'Hope Hearing Solutions',
    companyAddress: 'Your Company Address\nCity, State - PIN Code',
    companyPhone: '+91 XXXXX XXXXX',
    companyEmail: 'info@hopehearing.com',
    companyGST: 'GST Number Here',
    
    // Invoice Details
    invoiceNumber,
    invoiceDate,
    
    // Customer Information
    customerName: sale.patientName || 'Walk-in Customer',
    customerAddress: sale.address || '',
    customerPhone: sale.phone || '',
    customerEmail: sale.email || '',
    
    // Items
    items,
    
    // Totals
    subtotal,
    totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
    totalGST: totalGST > 0 ? totalGST : undefined,
    grandTotal,
    
    // Additional Information
    referenceDoctor: sale.referenceDoctor?.name || '',
    salesperson: sale.salesperson?.name || '',
    branch: sale.branch || '',
    paymentMethod: sale.paymentMethod || '',
    notes: sale.notes || '',
    terms: getDefaultTermsAndConditions(),
  };
};

// Default terms and conditions
const getDefaultTermsAndConditions = (): string => {
  return `1. Payment is due within 30 days of invoice date.
2. All sales are final unless otherwise specified.
3. Warranty terms apply as per manufacturer guidelines.
4. Please retain this invoice for warranty claims.
5. For any queries, please contact us within 7 days.`;
};

// Generate PDF blob from sale data
export const generateInvoicePDF = async (sale: any): Promise<Blob> => {
  const invoiceData = convertSaleToInvoiceData(sale);
  const doc = InvoiceTemplate({ data: invoiceData });
  const pdfBlob = await pdf(doc).toBlob();
  return pdfBlob;
};

// Download PDF invoice
export const downloadInvoicePDF = async (sale: any, filename?: string): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale);
    const url = URL.createObjectURL(pdfBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `invoice-${sale.invoiceNumber || Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF invoice');
  }
};

// Open PDF in new tab
export const openInvoicePDF = async (sale: any): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale);
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    
    // Clean up the URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Error opening PDF:', error);
    throw new Error('Failed to open PDF invoice');
  }
};

// Print PDF invoice
export const printInvoicePDF = async (sale: any): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale);
    const url = URL.createObjectURL(pdfBlob);
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    
    document.body.appendChild(iframe);
    
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    };
  } catch (error) {
    console.error('Error printing PDF:', error);
    throw new Error('Failed to print PDF invoice');
  }
};

// Email PDF invoice (you'll need to implement email service)
export const emailInvoicePDF = async (sale: any, emailAddress: string): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale);
    
    // Convert blob to base64 for email attachment
    const reader = new FileReader();
    reader.readAsDataURL(pdfBlob);
    
    return new Promise((resolve, reject) => {
      reader.onload = () => {
        const base64Data = reader.result as string;
        
        // Here you would integrate with your email service
        // For example, using EmailJS, SendGrid, or your backend API
        console.log('PDF ready for email:', {
          to: emailAddress,
          subject: `Invoice #${sale.invoiceNumber || 'INV-' + Date.now()}`,
          attachment: base64Data,
        });
        
        // TODO: Implement actual email sending
        resolve();
      };
      
      reader.onerror = () => reject(new Error('Failed to process PDF for email'));
    });
  } catch (error) {
    console.error('Error preparing PDF for email:', error);
    throw new Error('Failed to prepare PDF for email');
  }
};

// Batch generate multiple invoices
export const generateBatchInvoices = async (sales: any[]): Promise<Blob[]> => {
  const promises = sales.map(sale => generateInvoicePDF(sale));
  return Promise.all(promises);
};

// Custom invoice template configurations
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

// Generate PDF with custom configuration
export const generateCustomInvoicePDF = async (
  sale: any, 
  config: InvoiceConfig = {}
): Promise<Blob> => {
  const invoiceData = convertSaleToInvoiceData(sale);
  
  // Apply custom configuration
  if (config.companyName) invoiceData.companyName = config.companyName;
  if (config.companyAddress) invoiceData.companyAddress = config.companyAddress;
  if (config.companyPhone) invoiceData.companyPhone = config.companyPhone;
  if (config.companyEmail) invoiceData.companyEmail = config.companyEmail;
  if (config.companyGST) invoiceData.companyGST = config.companyGST;
  if (config.customTerms) invoiceData.terms = config.customTerms;
  
  const doc = InvoiceTemplate({ data: invoiceData });
  const pdfBlob = await pdf(doc).toBlob();
  return pdfBlob;
};
