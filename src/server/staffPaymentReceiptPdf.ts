import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type StaffPaymentReceiptPdfInput = {
  receiptLabel: string;
  patientName: string;
  amount: number;
  paymentMode: string;
  receiptType: string;
  appointmentId: string;
  enquiryId: string;
  staffId: string;
  staffName: string;
  createdAtIso: string;
  /** Extra lines (device model, serial, etc.) */
  detailLines?: string[];
};

/**
 * Minimal server-only PDF for admin email attachment — not the full CRM booking/trial templates.
 */
export async function buildStaffPaymentReceiptPdfBuffer(input: StaffPaymentReceiptPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 780;
  const line = (text: string, opts?: { size?: number; bold?: boolean }) => {
    const size = opts?.size ?? 10;
    const bold = opts?.bold ?? false;
    page.drawText(text, {
      x: 48,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.15, 0.15, 0.18),
      maxWidth: 500,
    });
    y -= size + (opts?.bold ? 10 : 6);
  };

  line('Hope Hearing — Staff payment request', { size: 16, bold: true });
  y -= 6;
  line('Pending admin verification. Not valid as a final tax invoice.', { size: 9 });
  y -= 14;

  line(`Document: ${input.receiptLabel}`, { bold: true });
  line(`Patient: ${input.patientName}`);
  line(`Amount: ₹${input.amount.toFixed(2)}`);
  line(`Payment mode: ${input.paymentMode}`);
  line(`Receipt type: ${input.receiptType}`);
  y -= 8;
  line(`Appointment ID: ${input.appointmentId}`);
  line(`Enquiry ID: ${input.enquiryId}`);
  line(`Submitted by (staff): ${input.staffName} (${input.staffId})`);
  line(`Submitted at: ${input.createdAtIso} (Asia/Kolkata context)`);
  if (input.detailLines?.length) {
    y -= 8;
    line('Details:', { bold: true });
    for (const row of input.detailLines.slice(0, 24)) {
      line(row, { size: 9 });
    }
  }
  y -= 16;
  line(
    'This PDF was generated for internal verification only. Do not forward to the patient until approved in CRM.',
    { size: 9 }
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
