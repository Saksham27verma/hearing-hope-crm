export interface HopeAICitationView {
  id: string;
  domain: string;
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  sourcePath?: string;
}

export interface HopeAIMessageView {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: HopeAICitationView[];
  exactResults?: string[];
  retrievalMode?: string;
  error?: boolean;
}
