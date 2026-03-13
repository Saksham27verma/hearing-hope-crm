import { adminDb } from '@/server/firebaseAdmin';
import type { HopeAICitation } from '../types';
import { extractQueryTokens, normalizeText, rankCitations, summarizeForCitation } from '../utils';

export async function retrieveInventory(query: string, branchId?: string): Promise<{ citations: HopeAICitation[]; exactResults: string[] }> {
  const db = adminDb();
  const tokens = extractQueryTokens(query);

  const [materialInSnap, materialOutSnap, stockTransferSnap] = await Promise.all([
    db.collection('materialInward').get(),
    db.collection('materialsOut').get(),
    db.collection('stockTransfers').get().catch(() => ({ docs: [] as any[] })),
  ]);

  const citations: HopeAICitation[] = [];

  materialInSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    const location = data.location || '';
    if (branchId && location && location !== branchId) return;
    const snippet = [
      data.challanNumber ? `Challan ${data.challanNumber}` : '',
      data.supplier?.name ? `Supplier ${data.supplier.name}` : '',
      normalizeText(data.products),
      data.notes || '',
    ].filter(Boolean).join('. ');
    const score = tokens.reduce((sum, token) => sum + (snippet.toLowerCase().includes(token) ? 1 : 0), 0);
    if (score > 0) {
      citations.push({
        id: `inventory-in-${docSnap.id}`,
        domain: 'inventory',
        entityType: 'materialIn',
        entityId: docSnap.id,
        title: data.challanNumber || `Material In ${docSnap.id}`,
        snippet: summarizeForCitation(snippet),
        sourcePath: `/material-in#id=${docSnap.id}`,
        metadata: { location, supplierName: data.supplier?.name || '', type: 'materialIn' },
        score,
      });
    }
  });

  materialOutSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    const location = data.location || '';
    if (branchId && location && location !== branchId) return;
    const snippet = [
      data.challanNumber ? `Challan ${data.challanNumber}` : '',
      data.recipient?.name ? `Recipient ${data.recipient.name}` : '',
      data.reason || '',
      normalizeText(data.products),
      data.notes || '',
    ].filter(Boolean).join('. ');
    const score = tokens.reduce((sum, token) => sum + (snippet.toLowerCase().includes(token) ? 1 : 0), 0);
    if (score > 0) {
      citations.push({
        id: `inventory-out-${docSnap.id}`,
        domain: 'inventory',
        entityType: 'materialOut',
        entityId: docSnap.id,
        title: data.challanNumber || `Material Out ${docSnap.id}`,
        snippet: summarizeForCitation(snippet),
        sourcePath: `/material-out#id=${docSnap.id}`,
        metadata: { location, recipientName: data.recipient?.name || '', type: 'materialOut' },
        score,
      });
    }
  });

  stockTransferSnap.docs.forEach((docSnap: any) => {
    const data: any = docSnap.data();
    const branchMatch = !branchId || data.fromBranch === branchId || data.toBranch === branchId;
    if (!branchMatch) return;
    const snippet = [
      data.transferNumber ? `Transfer ${data.transferNumber}` : '',
      data.fromBranch ? `From ${data.fromBranch}` : '',
      data.toBranch ? `To ${data.toBranch}` : '',
      normalizeText(data.products),
      data.reason || '',
    ].filter(Boolean).join('. ');
    const score = tokens.reduce((sum, token) => sum + (snippet.toLowerCase().includes(token) ? 1 : 0), 0);
    if (score > 0) {
      citations.push({
        id: `inventory-transfer-${docSnap.id}`,
        domain: 'inventory',
        entityType: 'stockTransfer',
        entityId: docSnap.id,
        title: data.transferNumber || `Stock Transfer ${docSnap.id}`,
        snippet: summarizeForCitation(snippet),
        sourcePath: '/stock-transfer',
        metadata: { fromBranch: data.fromBranch || '', toBranch: data.toBranch || '', type: 'stockTransfer' },
        score,
      });
    }
  });

  const ranked = rankCitations(query, citations, 8);
  const exactResults = ranked.map(citation => {
    const metadata = citation.metadata || {};
    if (metadata.type === 'stockTransfer') {
      return `${citation.title}: transfer from ${metadata.fromBranch || 'unknown'} to ${metadata.toBranch || 'unknown'}`;
    }
    if (metadata.type === 'materialOut') {
      return `${citation.title}: material out${metadata.location ? ` from ${metadata.location}` : ''}${metadata.recipientName ? ` to ${metadata.recipientName}` : ''}`;
    }
    return `${citation.title}: material in${metadata.location ? ` at ${metadata.location}` : ''}${metadata.supplierName ? ` from ${metadata.supplierName}` : ''}`;
  });
  return { citations: ranked, exactResults };
}
