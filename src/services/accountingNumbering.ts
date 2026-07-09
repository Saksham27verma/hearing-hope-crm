import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  DEFAULT_ACCOUNTING_NUMBER_SETTINGS,
  type AccountingNumberSettings,
} from '@/lib/accounting/types';

const MAX_SEQ = 999999;

export function accountingSettingsDocRef(db: Firestore, companyId: string) {
  return doc(db, 'accountingSettings', companyId);
}

function normalize(raw: Record<string, unknown> | undefined): AccountingNumberSettings {
  const d = DEFAULT_ACCOUNTING_NUMBER_SETTINGS;
  if (!raw) return { ...d };
  return {
    prefix: typeof raw.prefix === 'string' ? raw.prefix : d.prefix,
    suffix: typeof raw.suffix === 'string' ? raw.suffix : d.suffix,
    padding: Math.max(1, Math.min(10, Number(raw.padding) || d.padding)),
    nextNumber: Math.max(1, Math.min(MAX_SEQ, Number(raw.nextNumber) || d.nextNumber)),
  };
}

export function formatAccountingInvoiceNumber(
  settings: AccountingNumberSettings,
  n: number,
): string {
  const seq = String(Math.max(1, Math.min(MAX_SEQ, Math.floor(n)))).padStart(
    settings.padding,
    '0',
  );
  return `${settings.prefix}${seq}${settings.suffix}`;
}

export async function loadAccountingNumberSettings(
  db: Firestore,
  companyId: string,
): Promise<AccountingNumberSettings> {
  const ref = accountingSettingsDocRef(db, companyId);
  const snap = await getDoc(ref);
  return normalize(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined);
}

export async function saveAccountingNumberSettings(
  db: Firestore,
  companyId: string,
  partial: Partial<AccountingNumberSettings>,
): Promise<AccountingNumberSettings> {
  const current = await loadAccountingNumberSettings(db, companyId);
  const merged = normalize({ ...current, ...partial } as Record<string, unknown>);
  const ref = accountingSettingsDocRef(db, companyId);
  await setDoc(
    ref,
    {
      prefix: merged.prefix,
      suffix: merged.suffix,
      padding: merged.padding,
      nextNumber: merged.nextNumber,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return merged;
}

export async function peekNextAccountingInvoiceNumber(
  db: Firestore,
  companyId: string,
): Promise<string> {
  const s = await loadAccountingNumberSettings(db, companyId);
  return formatAccountingInvoiceNumber(s, s.nextNumber);
}

export async function loadCompanyInvoiceTemplate(
  db: Firestore,
  companyId: string,
): Promise<string | null> {
  const ref = accountingSettingsDocRef(db, companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const t = (snap.data() as Record<string, unknown>).invoiceTemplateHtml;
  return typeof t === 'string' && t.trim().length > 0 ? t : null;
}

export async function saveCompanyInvoiceTemplate(
  db: Firestore,
  companyId: string,
  templateHtml: string | null,
): Promise<void> {
  const ref = accountingSettingsDocRef(db, companyId);
  await setDoc(
    ref,
    {
      invoiceTemplateHtml: templateHtml && templateHtml.trim().length > 0 ? templateHtml : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function allocateNextAccountingInvoiceNumber(
  db: Firestore,
  companyId: string,
): Promise<string> {
  const ref = accountingSettingsDocRef(db, companyId);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const settings = normalize(
      snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
    );
    const n = settings.nextNumber;
    const formatted = formatAccountingInvoiceNumber(settings, n);
    transaction.set(
      ref,
      {
        prefix: settings.prefix,
        suffix: settings.suffix,
        padding: settings.padding,
        nextNumber: n + 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return formatted;
  });
}
