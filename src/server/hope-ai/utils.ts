import type { HopeAICitation } from './types';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i',
  'in', 'is', 'it', 'me', 'of', 'on', 'or', 'show', 'that', 'the', 'their',
  'this', 'to', 'want', 'what', 'when', 'where', 'which', 'who', 'with', 'you',
  'all', 'any', 'about', 'please', 'tell', 'need', 'give', 'latest', 'today',
  'crm', 'hope', 'ai'
]);

export function normalizeText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value?.toDate) return value.toDate().toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.values(value).map(normalizeText).filter(Boolean).join(' ');
  }
  return '';
}

export function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      normalizeText(text)
        .toLowerCase()
        .replace(/[^a-z0-9@.\-/ ]+/g, ' ')
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token.length > 1 && !STOP_WORDS.has(token))
    )
  );
}

export function extractQueryTokens(query: string): string[] {
  const baseTokens = tokenize(query);
  const ids = query.match(/[A-Za-z0-9][A-Za-z0-9\-./@]{2,}/g) || [];
  return Array.from(new Set([...baseTokens, ...ids.map(token => token.toLowerCase())])).slice(0, 10);
}

export function safeDateString(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value?.toDate) return value.toDate().toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  return '';
}

export function citationScore(queryTokens: string[], citation: HopeAICitation): number {
  const haystack = `${citation.title} ${citation.snippet} ${normalizeText(citation.metadata)}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token.toLowerCase())) score += 1;
  }
  return score;
}

export function rankCitations(query: string, citations: HopeAICitation[], limit = 15): HopeAICitation[] {
  const tokens = extractQueryTokens(query);
  return citations
    .map(citation => ({ ...citation, score: citationScore(tokens, citation) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

export function summarizeForCitation(text: string, maxLength = 500): string {
  const normalized = normalizeText(text).replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}
