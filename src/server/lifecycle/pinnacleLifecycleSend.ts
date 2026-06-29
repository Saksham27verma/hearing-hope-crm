import { pinnacleConfig, postToPinnacle } from '@/server/invoices/pinnacleSend';
import { normalizePhoneForWhatsApp } from '@/server/invoices/whatsappInvoiceRecord';

const TEMPLATE_ENV_MAP: Record<string, string> = {
  service_1yr: 'PINNACLE_LIFECYCLE_TEMPLATE_SERVICE',
  upgrade_2yr: 'PINNACLE_LIFECYCLE_TEMPLATE_UPGRADE',
  general_followup: 'PINNACLE_LIFECYCLE_TEMPLATE_GENERAL',
};

export function resolveLifecycleTemplateName(templateKey: string): string {
  const key = String(templateKey || '').trim();
  const envName = TEMPLATE_ENV_MAP[key];
  if (envName) {
    const v = (process.env[envName] || '').trim();
    if (v) return v;
  }
  return key;
}

export function buildLifecyclePinnaclePayload(params: {
  to: string;
  templateName: string;
  bodyParams: string[];
}) {
  const { templateLanguage } = pinnacleConfig();
  const parameters = params.bodyParams.map((text) => ({ type: 'text' as const, text: String(text || ' ') }));
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.to,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: templateLanguage },
      components: parameters.length
        ? [{ type: 'body', parameters }]
        : [],
    },
  };
}

export async function sendLifecycleWhatsApp(params: {
  phone: string;
  templateKey: string;
  bodyParams: string[];
}): Promise<{ ok: true; response: unknown } | { ok: false; error: string }> {
  try {
    const to = normalizePhoneForWhatsApp(params.phone);
    if (!to || to.length < 10) {
      return { ok: false, error: 'Invalid phone number' };
    }
    const templateName = resolveLifecycleTemplateName(params.templateKey);
    const payload = buildLifecyclePinnaclePayload({
      to,
      templateName,
      bodyParams: params.bodyParams,
    });
    const response = await postToPinnacle(payload);
    return { ok: true, response };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Pinnacle send failed' };
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
