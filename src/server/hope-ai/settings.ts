import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import type { HopeAIModelSettings } from './types';

const SETTINGS_COLLECTION = 'hopeAiSettings';
const SETTINGS_DOC = 'config';

const DEFAULT_PROVIDER = (process.env.HOPE_AI_PROVIDER || 'groq').toLowerCase() === 'openrouter' ? 'openrouter' : 'groq';
const DEFAULT_MODELS: Record<'groq' | 'openrouter', string> = {
  groq: process.env.HOPE_AI_GROQ_MODEL || 'llama-3.1-8b-instant',
  openrouter: process.env.HOPE_AI_OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
};

export async function getHopeAISettings(): Promise<HopeAIModelSettings> {
  const snap = await adminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get();
  const saved = snap.exists ? (snap.data() as Partial<HopeAIModelSettings>) : {};
  const provider = saved.provider === 'openrouter' ? 'openrouter' : DEFAULT_PROVIDER;

  return {
    provider,
    model: saved.model || DEFAULT_MODELS[provider],
    temperature: typeof saved.temperature === 'number' ? saved.temperature : 0.2,
  };
}

export async function updateHopeAISettings(settings: Partial<HopeAIModelSettings>, updatedBy: string) {
  const current = await getHopeAISettings();
  const next: HopeAIModelSettings = {
    provider: settings.provider || current.provider,
    model: settings.model || current.model,
    temperature: typeof settings.temperature === 'number' ? settings.temperature : current.temperature,
  };

  await adminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).set(
    {
      ...next,
      updatedBy,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return next;
}
