import type { HopeAICitation } from '../types';
import { buildCitation, scoreCollectionDocs } from './shared';

interface PurchaseRecord {
  id: string;
  invoiceNo: string;
  supplierName: string;
  location: string;
  purchaseDate: any;
  totalAmount: number;
  reference: string;
}

export async function retrievePurchases(query: string, branchId?: string): Promise<{ citations: HopeAICitation[]; exactResults: string[] }> {
  const citations = await scoreCollectionDocs<PurchaseRecord>(
    'purchases',
    query,
    (id, data) => {
      const location = data.location || '';
      if (branchId && location && location !== branchId) return null;
      return {
        id,
        invoiceNo: data.invoiceNo || '',
        supplierName: data.party?.name || '',
        location,
        purchaseDate: data.purchaseDate || '',
        totalAmount: data.totalAmount || data.grandTotal || 0,
        reference: data.reference || '',
      };
    },
    record => buildCitation({
      id: `purchase-${record.id}`,
      domain: 'purchases',
      entityType: 'purchase',
      entityId: record.id,
      title: record.invoiceNo || `Purchase ${record.id}`,
      snippet: [
        record.supplierName ? `Supplier ${record.supplierName}` : '',
        record.totalAmount ? `Total ₹${record.totalAmount}` : '',
        record.reference || '',
      ].filter(Boolean).join('. '),
      sourcePath: `/purchase-management#id=${record.id}`,
      metadata: record,
    })
  );

  const exactResults = citations.map(citation => {
    const metadata = citation.metadata || {};
    return `${metadata.invoiceNo || citation.title}: supplier ${metadata.supplierName || 'unknown'}${metadata.totalAmount ? `, total ₹${metadata.totalAmount}` : ''}${metadata.location ? `, location ${metadata.location}` : ''}${metadata.purchaseDate ? `, date ${metadata.purchaseDate}` : ''}`;
  });

  return { citations, exactResults };
}
