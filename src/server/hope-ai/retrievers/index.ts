import { adminDb } from '@/server/firebaseAdmin';
import { getAllowedDomains } from '../authz';
import type { HopeAIAuthContext, HopeAICitation, HopeAIRetrievalContext } from '../types';
import { extractQueryTokens, rankCitations, summarizeForCitation } from '../utils';
import { retrieveCenters } from './centers';
import { retrieveEnquiries } from './enquiries';
import { retrieveInventory } from './inventory';
import { retrieveProducts } from './products';
import { retrievePurchases } from './purchases';
import { retrieveSales } from './sales';

type Domain = 'products' | 'enquiries' | 'sales' | 'inventory' | 'purchases' | 'centers';

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  products: [
    'stock', 'product', 'products', 'inventory', 'how many', 'quantity', 'available',
    'bte', 'ric', 'cic', 'itc', 'ite', 'hearing aid', 'hearing aids',
    'serial', 'serials', 'in stock', 'out of stock', 'mrp', 'dealer price',
    'fast', 'signia', 'phonak', 'oticon', 'widex', 'starkey', 'resound',
    'charger', 'battery', 'earmould', 'earmold', 'accessory', 'accessories',
  ],
  enquiries: [
    'enquiry', 'enquiries', 'patient', 'visit', 'visits', 'follow up', 'followup',
    'follow-up', 'telecaller', 'assigned', 'status', 'counselling', 'trial',
    'booking', 'audiogram', 'hearing test', 'hearing loss',
  ],
  sales: [
    'sale', 'sales', 'invoice', 'sold', 'revenue', 'payment', 'billing',
    'grand total', 'amount',
  ],
  inventory: [
    'material in', 'material out', 'challan', 'stock transfer', 'transfer',
    'dispatch', 'dispatched', 'received', 'supplier', 'recipient',
  ],
  purchases: [
    'purchase', 'purchases', 'bought', 'procurement', 'supplier', 'vendor',
    'purchase order',
  ],
  centers: [
    'center', 'centres', 'branch', 'branches', 'head office', 'location',
    'clinic',
  ],
};

function detectQueryDomains(query: string): Domain[] {
  const lowerQuery = query.toLowerCase();
  const scores: [Domain, number][] = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [Domain, string[]][]) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        score += keyword.split(' ').length;
      }
    }
    if (score > 0) {
      scores.push([domain, score]);
    }
  }

  scores.sort((a, b) => b[1] - a[1]);
  return scores.map(([domain]) => domain);
}

async function retrieveIndexedCitations(query: string, context: HopeAIAuthContext): Promise<HopeAICitation[]> {
  const tokens = extractQueryTokens(query);
  if (!tokens.length) return [];

  const snap = await adminDb()
    .collection('hopeAiIndex')
    .where('searchTokens', 'array-contains-any', tokens.slice(0, 10))
    .get()
    .catch(() => ({ docs: [] as any[] }));

  const allowedDomains = new Set(getAllowedDomains(context));

  const citations = snap.docs
    .map((docSnap: any) => {
      const data = docSnap.data();
      if (!context.canAccessAllData) {
        if (!allowedDomains.has(data.domain)) return null;
        if (context.branchId && Array.isArray(data.branchIds) && data.branchIds.length && !data.branchIds.includes(context.branchId)) {
          return null;
        }
      }

      return {
        id: docSnap.id,
        domain: data.domain,
        entityType: data.entityType,
        entityId: data.entityId,
        title: data.title,
        snippet: summarizeForCitation(data.summaryText || ''),
        sourcePath: data.sourcePath,
        metadata: data.metadata || {},
      } satisfies HopeAICitation;
    })
    .filter(Boolean) as HopeAICitation[];

  return rankCitations(query, citations, 8);
}

export async function retrieveHopeAIContext(query: string, context: HopeAIAuthContext): Promise<HopeAIRetrievalContext> {
  const allowedDomains = new Set(getAllowedDomains(context));
  const detectedDomains = detectQueryDomains(query);
  const primaryDomain = detectedDomains[0] || null;

  const retrievers: Record<Domain, () => Promise<{ citations: HopeAICitation[]; exactResults: string[] }>> = {
    enquiries: () => allowedDomains.has('enquiries') ? retrieveEnquiries(query, context.branchId) : Promise.resolve({ citations: [], exactResults: [] }),
    products: () => allowedDomains.has('products') ? retrieveProducts(query) : Promise.resolve({ citations: [], exactResults: [] }),
    sales: () => allowedDomains.has('sales') ? retrieveSales(query, context.branchId) : Promise.resolve({ citations: [], exactResults: [] }),
    inventory: () => allowedDomains.has('inventory') ? retrieveInventory(query, context.branchId) : Promise.resolve({ citations: [], exactResults: [] }),
    purchases: () => allowedDomains.has('purchases') ? retrievePurchases(query, context.branchId) : Promise.resolve({ citations: [], exactResults: [] }),
    centers: () => allowedDomains.has('centers') ? retrieveCenters(query) : Promise.resolve({ citations: [], exactResults: [] }),
  };

  const allDomains: Domain[] = ['enquiries', 'products', 'sales', 'inventory', 'purchases', 'centers'];

  const orderedDomains = primaryDomain
    ? [primaryDomain, ...allDomains.filter(d => d !== primaryDomain)]
    : allDomains;

  const structuredGroups = await Promise.all(
    orderedDomains.map(domain =>
      retrievers[domain]().then(result => ({ domain, ...result })).catch(() => ({ domain, citations: [] as HopeAICitation[], exactResults: [] as string[] }))
    )
  );

  const primaryGroup = structuredGroups.find(g => g.domain === primaryDomain);
  const otherGroups = structuredGroups.filter(g => g.domain !== primaryDomain);

  const exactResults: string[] = [];
  if (primaryGroup && primaryGroup.exactResults.length) {
    exactResults.push(...primaryGroup.exactResults);
  }
  otherGroups.forEach(g => exactResults.push(...g.exactResults));
  const limitedExactResults = exactResults.slice(0, 15);

  const structuredCitations: HopeAICitation[] = [];
  if (primaryGroup && primaryGroup.citations.length) {
    structuredCitations.push(...primaryGroup.citations);
  }
  otherGroups.forEach(g => structuredCitations.push(...g.citations));

  const ragCitations = await retrieveIndexedCitations(query, context);

  const merged = new Map<string, HopeAICitation>();
  [...structuredCitations, ...ragCitations].forEach(citation => {
    const existing = merged.get(citation.id);
    if (!existing || (citation.score || 0) > (existing.score || 0)) {
      merged.set(citation.id, citation);
    }
  });

  const citations = rankCitations(query, Array.from(merged.values()), 12);

  return {
    citations,
    exactResults: limitedExactResults,
    retrievalMode: structuredCitations.length && ragCitations.length
      ? 'hybrid'
      : structuredCitations.length
        ? 'structured'
        : 'rag',
  };
}
