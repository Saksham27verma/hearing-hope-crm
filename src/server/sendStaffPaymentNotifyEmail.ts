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

/** True when the server has minimum SMTP env (actual send may still fail on bad credentials). */
export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST?.trim() && process.env.SMTP_PORT?.trim());
}

/** Plain email without attachment — used for Settings "test" and diagnostics. */
export async function sendSimpleSmtpMail(payload: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    throw new Error(
      'SMTP is not configured on this server. Add SMTP_HOST and SMTP_PORT (and usually SMTP_USER, SMTP_PASS, SMTP_FROM) to the environment where Next.js runs — e.g. Vercel → Project → Settings → Environment Variables, then redeploy. Local dev: add them to .env.local and restart npm run dev.'
    );
  }
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'noreply@localhost';
  await transport.sendMail({
    from,
    to: payload.to.join(', '),
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? `<pre style="font-family:sans-serif">${payload.text}</pre>`,
  });
}

export type StaffPaymentEmailPayload = {
  to: string[];
  subject: string;
  text: string;
  html: string;
  /** Optional — omit for in-office trial notifications which are recorded without a receipt PDF. */
  pdfBuffer?: Buffer;
  pdfFileName?: string;
};

export async function sendStaffPaymentNotifyEmail(payload: StaffPaymentEmailPayload): Promise<void> {
  const transport = getSmtpTransport();
  if (!transport) {
    throw new Error(
      'SMTP not configured: set SMTP_HOST and SMTP_PORT on the server (see Settings → Staff payment test email for help).'
    );
  }

  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'noreply@localhost';

  const hasAttachment = Boolean(payload.pdfBuffer && payload.pdfFileName);

  await transport.sendMail({
    from,
    to: payload.to.join(', '),
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    ...(hasAttachment
      ? {
          attachments: [
            {
              filename: payload.pdfFileName!,
              content: payload.pdfBuffer!,
              contentType: 'application/pdf',
            },
          ],
        }
      : {}),
  });
}

export { parseNotifyEmailsFromEnv as parseNotifyEmails, getStaffPaymentNotifyEmailList } from './staffPaymentNotifyEmails';
