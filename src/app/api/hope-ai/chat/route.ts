import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { requireHopeAIAuth } from '@/server/hope-ai/authz';
import { generateHopeAIAnswer } from '@/server/hope-ai/provider';
import { retrieveHopeAIContext } from '@/server/hope-ai/retrievers';
import { getHopeAISettings } from '@/server/hope-ai/settings';
import type { HopeAIChatRequest, HopeAIChatResponse, HopeAICitation, HopeAIChatMessage } from '@/server/hope-ai/types';

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error } satisfies HopeAIChatResponse, { status });
}

function buildFallbackAnswer(exactResults: string[], citations: HopeAICitation[] | undefined) {
  if (exactResults?.length) {
    const grouped = new Map<string, string[]>();

    for (const result of exactResults) {
      let domain = 'Other';
      if (result.includes('Current Stock') || result.includes('Received:')) domain = 'Products & Stock';
      else if (result.includes('Status=') && result.includes('Visits=')) domain = 'Enquiries';
      else if (result.includes('invoice') || result.includes('patient')) domain = 'Sales';
      else if (result.includes('material') || result.includes('transfer')) domain = 'Inventory';
      else if (result.includes('supplier')) domain = 'Purchases';

      if (!grouped.has(domain)) grouped.set(domain, []);
      grouped.get(domain)!.push(result);
    }

    const lines: string[] = [];
    grouped.forEach((results, domain) => {
      lines.push(`**${domain}:**`);
      results.slice(0, 8).forEach(r => lines.push(`- ${r}`));
    });

    return lines.join('\n');
  }

  if (citations?.length) {
    const lines = ['Here are the matching CRM records:'];
    citations.slice(0, 5).forEach(c => {
      lines.push(`- **${c.title}** (${c.domain}): ${c.snippet.slice(0, 150)}`);
    });
    return lines.join('\n');
  }

  return 'Hope AI could not find matching CRM data for that query. Try using a specific product name, patient name, invoice number, or serial number.';
}

const FILLER_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i',
  'in', 'is', 'it', 'me', 'of', 'on', 'or', 'that', 'the', 'their', 'this',
  'to', 'we', 'do', 'have', 'has', 'had', 'was', 'were', 'been', 'being',
  'what', 'when', 'where', 'which', 'who', 'with', 'you', 'all', 'any',
  'about', 'please', 'tell', 'need', 'give', 'show', 'get', 'can', 'will',
  'just', 'also', 'more', 'some', 'many', 'much', 'very', 'too', 'each',
  'them', 'those', 'these', 'there', 'here', 'details', 'detail', 'provide',
  'yes', 'no', 'ok', 'okay', 'sure', 'thanks', 'thank', 'not', 'available',
  'current', 'stock', 'units', 'unit', 'answer', 'question',
]);

function getMeaningfulTokens(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9.₹ ]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^\.+|\.+$/g, '').trim())
    .filter(w => w.length > 0 && !FILLER_WORDS.has(w.toLowerCase()));
}

function isVagueFollowUp(message: string): boolean {
  const tokens = getMeaningfulTokens(message);
  return tokens.length <= 2;
}

function buildRetrievalQuery(message: string, history: HopeAIChatMessage[]): string {
  if (!history.length) return message;

  if (!isVagueFollowUp(message)) return message;

  const recentUserMessages = history
    .filter(m => m.role === 'user')
    .slice(-2);

  const lastAssistantMessage = [...history]
    .reverse()
    .find(m => m.role === 'assistant');

  const contextTokens = new Set<string>();

  for (const msg of recentUserMessages) {
    for (const token of getMeaningfulTokens(msg.content)) {
      contextTokens.add(token);
    }
  }

  if (lastAssistantMessage) {
    const firstLine = lastAssistantMessage.content.split('\n')[0] || '';
    for (const token of getMeaningfulTokens(firstLine)) {
      contextTokens.add(token);
    }
  }

  if (!contextTokens.size) return message;

  const contextStr = Array.from(contextTokens).slice(0, 12).join(' ');
  return `${message} ${contextStr}`;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let requesterUid = 'anonymous';

  try {
    const context = await requireHopeAIAuth(request);
    requesterUid = context.uid;

    const body = (await request.json().catch(() => null)) as HopeAIChatRequest | null;
    const message = body?.message?.trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return jsonError('Message is required', 400);
    }

    const retrievalQuery = buildRetrievalQuery(message, history);

    const [settings, retrieval] = await Promise.all([
      getHopeAISettings(),
      retrieveHopeAIContext(retrievalQuery, context),
    ]);

    let answer = 'Hope AI could not find matching CRM data for that query. Try using a specific product name, patient name, invoice number, or serial number.';

    if (retrieval.citations.length || retrieval.exactResults.length) {
      try {
        answer = await generateHopeAIAnswer({
          question: message,
          history,
          citations: retrieval.citations,
          exactResults: retrieval.exactResults,
          settings,
        });
      } catch (providerError) {
        console.error('Hope AI provider failed, using deterministic fallback:', providerError);
        answer = buildFallbackAnswer(retrieval.exactResults, retrieval.citations);
      }
    }

    const response: HopeAIChatResponse = {
      ok: true,
      answer,
      citations: retrieval.citations,
      exactResults: retrieval.exactResults,
      retrievalMode: retrieval.retrievalMode,
    };

    await adminDb().collection('hopeAiLogs').add({
      uid: context.uid,
      role: context.profile.role,
      message,
      answer,
      citations: retrieval.citations.map(citation => ({
        domain: citation.domain,
        entityType: citation.entityType,
        entityId: citation.entityId,
        title: citation.title,
        sourcePath: citation.sourcePath || '',
      })),
      retrievalMode: retrieval.retrievalMode,
      createdAt: FieldValue.serverTimestamp(),
      latencyMs: Date.now() - startedAt,
      status: 'success',
    });

    return NextResponse.json(response);
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Hope AI request failed';

    try {
      await adminDb().collection('hopeAiLogs').add({
        uid: requesterUid,
        message: '',
        answer: '',
        status: 'error',
        error: message,
        createdAt: FieldValue.serverTimestamp(),
        latencyMs: Date.now() - startedAt,
      });
    } catch (logError) {
      console.error('Failed to log Hope AI error:', logError);
    }

    return jsonError(message, status);
  }
}
