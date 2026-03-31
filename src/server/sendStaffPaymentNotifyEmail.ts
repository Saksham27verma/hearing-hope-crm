import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

function getSmtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !portRaw) return null;
  const port = Number(portRaw) || 587;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export type StaffPaymentEmailPayload = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  pdfBuffer: Buffer;
  pdfFileName: string;
};

export async function sendStaffPaymentNotifyEmail(payload: StaffPaymentEmailPayload): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    throw new Error('SMTP not configured (SMTP_HOST / SMTP_PORT)');
  }

  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'noreply@localhost';

  await transport.sendMail({
    from,
    to: payload.to.join(', '),
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    attachments: [
      {
        filename: payload.pdfFileName,
        content: payload.pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

export function parseNotifyEmails(): string[] {
  const raw = process.env.STAFF_PAYMENT_NOTIFY_EMAILS?.trim() || '';
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
