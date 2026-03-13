import type { HopeAICitation, HopeAIChatMessage, HopeAIModelSettings } from './types';

interface GenerateAnswerInput {
  question: string;
  history: HopeAIChatMessage[];
  citations: HopeAICitation[];
  exactResults: string[];
  settings: HopeAIModelSettings;
}

const MAX_EVIDENCE_CHARS = 3800;
const MAX_CITATIONS_FOR_PROMPT = 5;
const MAX_EXACT_RESULTS_FOR_PROMPT = 8;
const MAX_SNIPPET_CHARS = 350;

function compactSnippet(snippet: string, maxLen = MAX_SNIPPET_CHARS): string {
  if (snippet.length <= maxLen) return snippet;
  return snippet.slice(0, maxLen - 3) + '...';
}

function formatCitationForPrompt(citation: HopeAICitation): string {
  const metadata = citation.metadata || {};
  const importantEntries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 10)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);

  return [
    `[${citation.title}]`,
    `Domain: ${citation.domain}`,
    compactSnippet(citation.snippet),
    importantEntries.length ? importantEntries.join(', ') : '',
  ].filter(Boolean).join('\n');
}

function buildMessages(input: GenerateAnswerInput) {
  const systemPrompt = [
    'You are Hope AI, a CRM assistant for Hearing Hope.',
    'Answer ONLY from the evidence below. Never invent data.',
    'RULES:',
    '- For stock/inventory: state exact "Current Stock" number from evidence.',
    '- For enquiries: report exact visit count and what happened in each visit.',
    '- For counts: count from evidence, state exact number.',
    '- Use actual names, numbers, dates, serial numbers, statuses from evidence.',
    '- State facts directly. Never say "based on the data" or "it appears".',
    '- Do NOT include a Sources section.',
    '- Do NOT add generic explanations. Only answer what was asked.',
    '- Use bullet points and short headings when listing multiple items.',
    '- Keep answers concise and factual.',
  ].join('\n');

  const topExact = input.exactResults.slice(0, MAX_EXACT_RESULTS_FOR_PROMPT);
  const topCitations = input.citations.slice(0, MAX_CITATIONS_FOR_PROMPT);

  let evidenceParts: string[] = [];

  if (topExact.length) {
    evidenceParts.push(`FACTS:\n${topExact.join('\n')}`);
  }

  if (topCitations.length) {
    evidenceParts.push(`RECORDS:\n${topCitations.map(c => formatCitationForPrompt(c)).join('\n---\n')}`);
  }

  let evidence = evidenceParts.join('\n\n');
  if (evidence.length > MAX_EVIDENCE_CHARS) {
    evidence = evidence.slice(0, MAX_EVIDENCE_CHARS) + '\n[truncated]';
  }

  if (!evidence.trim()) {
    evidence = 'No matching records found.';
  }

  return [
    { role: 'system', content: systemPrompt },
    ...input.history.slice(-4).map(message => ({ role: message.role, content: message.content })),
    {
      role: 'user',
      content: `${input.question}\n\n${evidence}\n\nAnswer directly using the facts above.`,
    },
  ];
}

async function callGroq(messages: Array<{ role: string; content: string }>, settings: HopeAIModelSettings) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY for Hope AI');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: 1024,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq request failed: ${errorBody}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function callOpenRouter(messages: Array<{ role: string; content: string }>, settings: HopeAIModelSettings) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Missing OPENROUTER_API_KEY for Hope AI');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Hearing Hope CRM',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: 1024,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter request failed: ${errorBody}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

export async function generateHopeAIAnswer(input: GenerateAnswerInput): Promise<string> {
  const messages = buildMessages(input);

  if (input.settings.provider === 'openrouter') {
    return callOpenRouter(messages, input.settings);
  }

  return callGroq(messages, input.settings);
}
