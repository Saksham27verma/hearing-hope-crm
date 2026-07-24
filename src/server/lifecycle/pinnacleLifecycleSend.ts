import { buildPinnaclePayload, pinnacleConfig, postToPinnacle } from '@/server/invoices/pinnacleSend';
import { normalizePhoneForWhatsApp } from '@/server/invoices/whatsappInvoiceRecord';
import {
  headerImageParameter,
  resolveLifecycleHeaderMedia,
} from '@/server/lifecycle/lifecycleHeaderMedia';
import { ensureLifecycleReminderPdfUrl } from '@/server/lifecycle/ensureLifecycleReminderPdfUrl';

const TEMPLATE_ENV_MAP: Record<string, string> = {
  service_6mo: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE_6MO',
  service_1yr: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE',
  upgrade_2yr: 'PINNACLE_LIFECYCLE_TEMPLATE_UPGRADE',
  general_followup: 'PINNACLE_LIFECYCLE_TEMPLATE_GENERAL',
};

/** Preferred Pinnacle names + common aliases (env overrides preferred first). */
const TEMPLATE_CANDIDATES: Record<string, string[]> = {
  service_6mo: ['service_reminder_6mo', 'service_6mo'],
  service_1yr: ['service_reminder_1yr', 'service_1yr'],
  upgrade_2yr: [
    'upgrade_offer_2yr',
    'upgrade_reminder_2yr',
    'service_reminder_2yr',
    'upgrade_2yr',
  ],
  general_followup: [
    'general_followup',
    'general_follow_up',
    'followup_general',
    'general_follow-up',
  ],
};

export function resolveLifecycleTemplateName(templateKey: string): string {
  return resolveLifecycleTemplateCandidates(templateKey)[0] || String(templateKey || '').trim();
}

export function resolveLifecycleTemplateCandidates(templateKey: string): string[] {
  const key = String(templateKey || '').trim();
  const out: string[] = [];
  const envName = TEMPLATE_ENV_MAP[key];
  if (envName) {
    const v = (process.env[envName] || '').trim();
    if (v) out.push(v);
  }
  for (const name of TEMPLATE_CANDIDATES[key] || []) {
    if (!out.includes(name)) out.push(name);
  }
  if (!out.includes(key) && key) out.push(key);
  return out;
}

/**
 * Delivery mode:
 * - document (default): same proven path as Sales & Invoicing — utility DOCUMENT template + Firebase PDF
 * - image: Meta IMAGE-header templates (service_reminder_6mo etc.). Often accepted then not delivered if MARKETING.
 */
function lifecycleDeliveryMode(): 'document' | 'image' {
  const mode = (process.env.PINNACLE_LIFECYCLE_DELIVERY_MODE || 'document').trim().toLowerCase();
  return mode === 'image' ? 'image' : 'document';
}

export async function buildLifecyclePinnaclePayload(params: {
  to: string;
  templateName: string;
  bodyParams: string[];
  languageCode?: string;
}) {
  const { templateLanguage } = pinnacleConfig();
  const languageCode = (params.languageCode || templateLanguage || 'en').trim();
  const headerMedia = await resolveLifecycleHeaderMedia();

  const components: Array<Record<string, unknown>> = [
    {
      type: 'header',
      parameters: [headerImageParameter(headerMedia)],
    },
  ];

  if (params.bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: params.bodyParams.map((text) => ({
        type: 'text' as const,
        text: String(text || ' '),
      })),
    });
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: languageCode },
      components,
    },
  };
}

function isTemplateNotFoundError(message: string): boolean {
  return (
    message.includes('132001') ||
    message.includes('template not found') ||
    message.includes('does not exist in the translation')
  );
}

/**
 * Proven delivery path (same as invoice WhatsApp button).
 * Attaches a service-reminder PDF via the configured utility DOCUMENT template.
 */
async function sendLifecycleWhatsAppAsDocument(params: {
  phone: string;
  templateKey: string;
  customerName: string;
  externalSaleId?: string;
}): Promise<
  | { ok: true; response: unknown; messageId: string; templateName: string; to: string }
  | { ok: false; error: string }
> {
  try {
    const to = normalizePhoneForWhatsApp(params.phone);
    if (!to || to.length < 10) {
      return { ok: false, error: 'Invalid phone number' };
    }

    const { templateName } = pinnacleConfig();
    const { pdfUrl } = await ensureLifecycleReminderPdfUrl({
      templateKey: params.templateKey,
      customerName: params.customerName,
      phone: to,
      externalSaleId: params.externalSaleId,
    });

    const payload = buildPinnaclePayload({
      to,
      pdfUrl,
      invoiceNumber: `SVC_${params.templateKey || 'reminder'}`,
      customerName: params.customerName || 'Customer',
    });

    const response = await postToPinnacle(payload);
    const messageId = extractMessageId(response);
    if (!messageId) {
      return {
        ok: false,
        error: `Pinnacle returned no message id: ${JSON.stringify(response).slice(0, 300)}`,
      };
    }

    return {
      ok: true,
      response,
      messageId,
      templateName: `${templateName}+${params.templateKey}`,
      to,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Pinnacle document send failed',
    };
  }
}

async function sendLifecycleWhatsAppAsImage(params: {
  phone: string;
  templateKey: string;
  bodyParams?: string[];
}): Promise<
  | { ok: true; response: unknown; messageId: string; templateName: string; to: string }
  | { ok: false; error: string }
> {
  const candidates = resolveLifecycleTemplateCandidates(params.templateKey);
  const bodyParams = Array.isArray(params.bodyParams) ? params.bodyParams : [];
  try {
    const to = normalizePhoneForWhatsApp(params.phone);
    if (!to || to.length < 10) {
      return { ok: false, error: 'Invalid phone number' };
    }

    pinnacleConfig();
    const { templateLanguage } = pinnacleConfig();
    const languages = Array.from(
      new Set([templateLanguage, 'en', 'en_US'].map((x) => String(x || '').trim()).filter(Boolean)),
    );

    let lastError = '';
    let lastName = candidates[0] || params.templateKey;

    for (const templateName of candidates) {
      lastName = templateName;
      for (const languageCode of languages) {
        try {
          const payload = await buildLifecyclePinnaclePayload({
            to,
            templateName,
            bodyParams,
            languageCode,
          });
          const response = await postToPinnacle(payload);
          const messageId = extractMessageId(response);
          if (!messageId) {
            throw new Error(
              `Pinnacle returned HTTP success but no message id: ${JSON.stringify(response).slice(0, 300)}`,
            );
          }
          return { ok: true, response, messageId, templateName, to };
        } catch (e) {
          lastError = e instanceof Error ? e.message : 'Pinnacle send failed';
          if (!isTemplateNotFoundError(lastError)) {
            return {
              ok: false,
              error: `${lastError} (key=${params.templateKey}, pinnacleName=${templateName})`,
            };
          }
        }
      }
    }

    return {
      ok: false,
      error: `${lastError} (key=${params.templateKey}, tried=${candidates.join(', ') || lastName})`,
    };
  } catch (e) {
    const base = e instanceof Error ? e.message : 'Pinnacle send failed';
    return {
      ok: false,
      error: `${base} (key=${params.templateKey}, pinnacleName=${candidates[0] || params.templateKey})`,
    };
  }
}

export async function sendLifecycleWhatsApp(params: {
  phone: string;
  templateKey: string;
  bodyParams?: string[];
  customerName?: string;
  externalSaleId?: string;
}): Promise<
  | { ok: true; response: unknown; messageId: string; templateName: string; to: string }
  | { ok: false; error: string }
> {
  if (lifecycleDeliveryMode() === 'image') {
    return sendLifecycleWhatsAppAsImage(params);
  }

  // Default: document/utility path that matches working Sales & Invoicing delivery.
  return sendLifecycleWhatsAppAsDocument({
    phone: params.phone,
    templateKey: params.templateKey,
    customerName: params.customerName || 'Customer',
    externalSaleId: params.externalSaleId,
  });
}

export function extractMessageId(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') return undefined;
  const r = response as Record<string, unknown>;
  const messages = r.messages;
  if (Array.isArray(messages) && messages[0] && typeof messages[0] === 'object') {
    const id = (messages[0] as Record<string, unknown>).id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}
