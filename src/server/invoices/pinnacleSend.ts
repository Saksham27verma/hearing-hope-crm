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

    if (code === 132001 || detailStr.includes('132001') || detailStr.includes('does not exist in the translation')) {
      const { templateName, templateLanguage } = pinnacleConfig();
      throw new Error(
        `WhatsApp template not found: name="${templateName}" language="${templateLanguage}". ` +
          'Set PINNACLE_TEMPLATE_NAME and PINNACLE_TEMPLATE_LANGUAGE to match your approved template.',
      );
    }

    throw new Error(`Pinnacle API error (${res.status}): ${detail}`);
  }

  return responseJson;
}
