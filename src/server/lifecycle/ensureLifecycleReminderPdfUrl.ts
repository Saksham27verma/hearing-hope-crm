import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { adminStorageBucket } from '@/server/firebaseAdmin';

const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const REMINDER_COPY: Record<
  string,
  { title: string; filename: string; body: string }
> = {
  service_6mo: {
    title: '6-Month Service Reminder',
    filename: 'Service_Reminder_6mo.pdf',
    body: 'Your Hearing Hope device is due for a 6-month service checkup. Please call Hearing Hope to book your appointment.',
  },
  service_1yr: {
    title: '1-Year Service Reminder',
    filename: 'Service_Reminder_1yr.pdf',
    body: 'Your Hearing Hope device is due for annual servicing. Please call Hearing Hope to schedule your appointment.',
  },
  upgrade_2yr: {
    title: '2-Year Upgrade Offer',
    filename: 'Upgrade_Offer_2yr.pdf',
    body: 'It has been about 2 years since your purchase. Hearing Hope has upgrade and trade-in options available. Reply or call us to learn more.',
  },
  general_followup: {
    title: 'Hearing Hope Follow-up',
    filename: 'HearingHope_Followup.pdf',
    body: 'This is Hearing Hope following up regarding your purchase. How can we help you today? Please call or reply on WhatsApp.',
  },
};

function reminderMeta(templateKey: string) {
  return (
    REMINDER_COPY[templateKey] || {
      title: 'Hearing Hope Reminder',
      filename: 'HearingHope_Reminder.pdf',
      body: 'Please contact Hearing Hope for assistance with your device.',
    }
  );
}

function toPdfSafe(text: string): string {
  return text
    .replace(/\u20b9/g, 'Rs.')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

/**
 * Builds a short service-reminder PDF and uploads it to Firebase Storage
 * (same pattern as invoice WhatsApp PDFs that already deliver via Pinnacle).
 */
export async function ensureLifecycleReminderPdfUrl(params: {
  templateKey: string;
  customerName: string;
  phone: string;
  externalSaleId?: string;
}): Promise<{ pdfUrl: string; filename: string; title: string }> {
  const meta = reminderMeta(params.templateKey);
  const customerName = toPdfSafe((params.customerName || 'Customer').trim() || 'Customer');

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const maxWidth = width - 112;
  let y = height - 72;

  const draw = (text: string, size: number, bold = false) => {
    page.drawText(toPdfSafe(text), {
      x: 56,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.1, 0.15, 0.16),
    });
    y -= size + 10;
  };

  const drawWrapped = (text: string, size: number) => {
    const words = toPdfSafe(text).split(/\s+/);
    let line = '';
    const useFont = font;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (useFont.widthOfTextAtSize(next, size) > maxWidth) {
        if (line) draw(line, size);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) draw(line, size);
  };

  draw('Hearing Hope', 18, true);
  draw(meta.title, 14, true);
  y -= 8;
  draw(`Customer: ${customerName}`, 11);
  if (params.phone) draw(`Phone: ${toPdfSafe(params.phone)}`, 11);
  y -= 12;
  drawWrapped(meta.body, 11);
  y -= 16;
  draw('Please call Hearing Hope to book an appointment.', 11);
  draw('Thank you.', 11);

  const bytes = await pdf.save();
  const buffer = Buffer.from(bytes);

  const safeId = (params.externalSaleId || 'manual').replace(/[^\w.-]+/g, '_').slice(0, 80);
  const objectPath = `lifecycle-whatsapp/${safeId}/${meta.filename}`;
  const bucket = adminStorageBucket();
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'public, max-age=3600' },
    resumable: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });

  return { pdfUrl: signedUrl, filename: meta.filename, title: meta.title };
}
