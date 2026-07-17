export function pinnacleConfig() {
  const phoneId = (process.env.PINNACLE_PHONE_ID || '').trim();
  const apiKey = (process.env.PINNACLE_API_KEY || '').trim();
  const templateName = (
    process.env.PINNACLE_TEMPLATE_NAME || 'invoice_from_crm_testing_template'
  ).trim();
  const templateLanguage = (process.env.PINNACLE_TEMPLATE_LANGUAGE || 'en').trim();
  if (!phoneId || !apiKey) {
    throw new Error('Pinnacle WhatsApp is not configured (PINNACLE_PHONE_ID / PINNACLE_API_KEY).');
  }
  return { phoneId, apiKey, templateName, templateLanguage };
}

export function buildPinnaclePayload(params: {
  to: string;
  pdfUrl: string;
  invoiceNumber: string;
  customerName: string;
}) {
  const { templateName, templateLanguage } = pinnacleConfig();
  const filename = `Invoice_${params.invoiceNumber || 'document'}.pdf`.replace(/[^\w.-]+/g, '_');
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: {
                link: params.pdfUrl,
                filename,
              },
            },
          ],
        },
        {
          type: 'body',
          parameters: [{ type: 'text', text: params.customerName || 'Customer' }],
        },
      ],
    },
  };
}

export async function postToPinnacle(body: Record<string, unknown>) {
  const { phoneId, apiKey } = pinnacleConfig();
  const url = `https://partnersv1.pinbot.ai/v3/${phoneId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify(body),
  });

  let responseJson: unknown = null;
  const text = await res.text();
  try {
    responseJson = text ? JSON.parse(text) : null;
  } catch {
    responseJson = { raw: text };
  }

  if (!res.ok) {
    const root =
      typeof responseJson === 'object' && responseJson ? (responseJson as Record<string, unknown>) : null;
    const errObj =
      root?.error && typeof root.error === 'object'
        ? (root.error as Record<string, unknown>)
        : root;
    const code = errObj?.code;
    const detail = errObj ? JSON.stringify(errObj) : text || res.statusText;
    const detailStr = String(root?.message || detail);

    // Prefer the template name from the request body when available
    const requestedName =
      typeof body.template === 'object' && body.template
        ? String((body.template as Record<string, unknown>).name || '')
        : '';
    const requestedLang =
      typeof body.template === 'object' &&
      body.template &&
      typeof (body.template as Record<string, unknown>).language === 'object'
        ? String(
            ((body.template as Record<string, unknown>).language as Record<string, unknown>)?.code ||
              '',
          )
        : '';

    if (code === 132001 || detailStr.includes('132001') || detailStr.includes('does not exist in the translation')) {
      const { templateLanguage } = pinnacleConfig();
      const name = requestedName || 'unknown';
      const lang = requestedLang || templateLanguage;
      throw new Error(
        `WhatsApp template not found: name="${name}" language="${lang}". ` +
          'Use the exact approved name from the Pinnacle dashboard in PINNACLE_LIFECYCLE_TEMPLATE_* (not PINNACLE_TEMPLATE_NAME / invoice template).',
      );
    }

    if (
      code === 132012 ||
      detailStr.includes('132012') ||
      detailStr.includes('Format mismatch, expected IMAGE')
    ) {
      throw new Error(
        `Template "${requestedName || 'unknown'}" requires an IMAGE header. ` +
          'Set PINNACLE_LIFECYCLE_HEADER_IMAGE_URL in CRM .env.local to a public https:// JPG/PNG URL, then restart CRM.',
      );
    }

    throw new Error(`Pinnacle API error (${res.status}): ${detail}`);
  }

  return responseJson;
}
