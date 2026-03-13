import { adminDb } from '@/server/firebaseAdmin';
import type { HopeAICitation } from '../types';
import { extractQueryTokens, normalizeText, rankCitations, summarizeForCitation } from '../utils';

export interface RetrieverScope {
  branchId?: string;
  canAccessAllData: boolean;
}

export async function scoreCollectionDocs<T>(
  collectionName: string,
  query: string,
  mapper: (docId: string, data: any) => T | null,
  citationBuilder: (record: T) => HopeAICitation,
  limit = 6
): Promise<HopeAICitation[]> {
  const snap = await adminDb().collection(collectionName).get();
  const tokens = extractQueryTokens(query);
  const candidates: HopeAICitation[] = [];

  snap.docs.forEach(docSnap => {
    const record = mapper(docSnap.id, docSnap.data());
    if (!record) return;

    const citation = citationBuilder(record);
    const haystack = `${citation.title} ${citation.snippet} ${normalizeText(citation.metadata)}`.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token.toLowerCase()) ? 1 : 0), 0);
    if (score > 0) {
      candidates.push({ ...citation, score });
    }
  });

  return rankCitations(query, candidates, limit);
}

export function buildCitation(input: Omit<HopeAICitation, 'snippet'> & { snippet: string }) {
  return {
    ...input,
    snippet: summarizeForCitation(input.snippet),
  };
}
