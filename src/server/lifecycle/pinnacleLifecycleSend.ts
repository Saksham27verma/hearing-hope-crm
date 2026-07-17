import { pinnacleConfig, postToPinnacle } from '@/server/invoices/pinnacleSend';
import { normalizePhoneForWhatsApp } from '@/server/invoices/whatsappInvoiceRecord';

const TEMPLATE_ENV_MAP: Record<string, string> = {
  service_6mo: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE_6MO',
  service_1yr: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE',
  upgrade_2yr: 'PINNACLE_LIFECYCLE_TEMPLATE_UPGRADE',
  general_followup: 'PINNACLE_LIFECYCLE_TEMPLATE_GENERAL',
};

/** Exact Pinnacle template names (overridable via env). Never use the invoice template. */
const DEFAULT_TEMPLATE_NAMES: Record<string, string> = {
  service_6mo: 'service_reminder_6mo',
  service_1yr: 'service_reminder_1yr',
  upgrade_2yr: 'upgrade_offer_2yr',
  general_followup: 'general_followup',
};

export function resolveLifecycleTemplateName(templateKey: string): string {
  const key = String(templateKey || '').trim();
  const envName = TEMPLATE_ENV_MAP[key];
  if (envName) {
    const v = (process.env[envName] || '').trim();
    if (v) return v;
  }
  if (DEFAULT_TEMPLATE_NAMES[key]) return DEFAULT_TEMPLATE_NAMES[key];
  // 6-month can reuse the approved 1yr service template until a dedicated one is configured
  if (key === 'service_6mo') {
    const fallback =
      (process.env.PINNACLE_LIFECYCLE_TEMPLATE_SERVICE || '').trim() ||
      DEFAULT_TEMPLATE_NAMES.service_1yr;
    if (fallback) return fallback;
  }
  return key;
}

export function buildLifecyclePinnaclePayload(params: {
  to: string;
  templateName: string;
  bodyParams: string[];
}) {
  const { templateLanguage } = pinnacleConfig();
  const headerImageUrl = (process.env.PINNACLE_LIFECYCLE_HEADER_IMAGE_URL || '').trim();
  const components: Array<Record<string, unknown>> = [];

  if (headerImageUrl) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: headerImageUrl },
        },
      ],
    });
  }

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
      language: { code: templateLanguage },
      components,
    },
  };
}

export async function sendLifecycleWhatsApp(params: {
  phone: string;
  templateKey: string;
  bodyParams: string[];
}): Promise<{ ok: true; response: unknown } | { ok: false; error: string }> {
  const templateName = resolveLifecycleTemplateName(params.templateKey);
  try {
    const to = normalizePhoneForWhatsApp(params.phone);
    if (!to || to.length < 10) {
      return { ok: false, error: 'Invalid phone number' };
    }
    const payload = buildLifecyclePinnaclePayload({
      to,
      templateName,
      bodyParams: params.bodyParams,
    });
    const response = await postToPinnacle(payload);
    return { ok: true, response };
  } catch (e) {
    const base = e instanceof Error ? e.message : 'Pinnacle send failed';
    return {
      ok: false,
      error: `${base} (key=${params.templateKey}, pinnacleName=${templateName})`,
    };
  }
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
