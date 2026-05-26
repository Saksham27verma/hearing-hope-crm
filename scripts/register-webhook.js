/**
 * One-off: register your CRM webhook URL with Pinnacle (Pinbot) setwebhook API.
 *
 * Usage (from hearing-hope-crm folder):
 *   node scripts/register-webhook.js
 *
 * Config (pick one):
 *   A) Set values in CONFIG below, or
 *   B) Add to .env.local (recommended):
 *        PINNACLE_PHONE_ID=...
 *        PINNACLE_API_KEY=...
 *        PINNACLE_WEBHOOK_URL=https://your-crm.vercel.app/api/webhook/whatsapp
 *        PINNACLE_WEBHOOK_HEADER_SECRET=your-secret-string
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// --- Option A: fill these in if you prefer not to use .env.local ---
const CONFIG = {
  phoneNumberId: '1082976528239170', // e.g. "123456789012345" — same as PINNACLE_PHONE_ID
  apiKey: '98794b62-5419-11f1-894a-02c8a5e042bd', // WABA API key — same as PINNACLE_API_KEY
  webhookUrl: 'https://hearing-hope-crm.vercel.app/api/webhook/whatsapp', // e.g. "https://your-crm.vercel.app/api/webhook/whatsapp"
  /** Sent as request header `x-pinnacle-secret` on each inbound webhook from Pinnacle */
  headerSecret: '0166c7e9f8119c99c87390b9068630d0', // pick a long random string; store the same value server-side if you validate it
};

function pick(...values) {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

async function main() {
  const phoneNumberId = pick(
    CONFIG.phoneNumberId,
    process.env.PINNACLE_PHONE_ID,
  );
  const apiKey = pick(CONFIG.apiKey, process.env.PINNACLE_API_KEY);
  const webhookUrl = pick(
    CONFIG.webhookUrl,
    process.env.PINNACLE_WEBHOOK_URL,
    process.env.NEXT_PUBLIC_APP_URL
      ? `${String(process.env.NEXT_PUBLIC_APP_URL).replace(/\/$/, '')}/api/webhook/whatsapp`
      : '',
  );
  const headerSecret = pick(
    CONFIG.headerSecret,
    process.env.PINNACLE_WEBHOOK_HEADER_SECRET,
    process.env.PINNACLE_WEBHOOK_VERIFY_TOKEN,
  );

  const missing = [];
  if (!phoneNumberId) missing.push('phoneNumberId (PINNACLE_PHONE_ID)');
  if (!apiKey) missing.push('apiKey (PINNACLE_API_KEY)');
  if (!webhookUrl) missing.push('webhookUrl (PINNACLE_WEBHOOK_URL or NEXT_PUBLIC_APP_URL)');
  if (!headerSecret) missing.push('headerSecret (PINNACLE_WEBHOOK_HEADER_SECRET)');

  if (missing.length) {
    console.error('Missing required values:\n  - ' + missing.join('\n  - '));
    console.error('\nEdit CONFIG in scripts/register-webhook.js or set them in .env.local');
    process.exit(1);
  }

  const url = `https://partnersv1.pinbot.ai/v3/${phoneNumberId}/setwebhook`;
  const body = {
    webhook_url: webhookUrl,
    headers: {
      'x-pinnacle-secret': headerSecret,
    },
  };

  console.log('Registering Pinnacle webhook…');
  console.log('  POST', url);
  console.log('  webhook_url:', webhookUrl);
  console.log('  headers.x-pinnacle-secret:', '(set, not printed)');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error('Failed:', res.status, res.statusText);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  console.log('Success:', res.status);
  console.log(JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
