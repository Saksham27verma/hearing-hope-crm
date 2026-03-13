export type HopeAIRole = 'admin' | 'staff' | 'audiologist';

export interface HopeAIUserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: HopeAIRole;
  allowedModules?: string[];
  branchId?: string;
}

export interface HopeAIAuthContext {
  uid: string;
  email?: string;
  profile: HopeAIUserProfile;
  isAdmin: boolean;
  canAccessAllData: boolean;
  allowedModules: string[];
  branchId?: string;
}

export interface HopeAICitation {
  id: string;
  domain: string;
  entityType: string;
  entityId: string;
  title: string;
  snippet: string;
  sourcePath?: string;
  metadata?: Record<string, any>;
  score?: number;
}

export interface HopeAIIndexDocument {
  id: string;
  domain: string;
  entityType: string;
  entityId: string;
  title: string;
  summaryText: string;
  searchTokens: string[];
  sourcePath?: string;
  metadata: Record<string, any>;
  branchIds?: string[];
  restrictedModules?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface HopeAIModelSettings {
  provider: 'groq' | 'openrouter';
  model: string;
  temperature: number;
}

export interface HopeAIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HopeAIChatRequest {
  message: string;
  history?: HopeAIChatMessage[];
}

export interface HopeAIChatResponse {
  ok: boolean;
  answer?: string;
  citations?: HopeAICitation[];
  retrievalMode?: 'structured' | 'rag' | 'hybrid';
  exactResults?: string[];
  error?: string;
}

export interface HopeAIRetrievalContext {
  citations: HopeAICitation[];
  exactResults: string[];
  retrievalMode: 'structured' | 'rag' | 'hybrid';
}
