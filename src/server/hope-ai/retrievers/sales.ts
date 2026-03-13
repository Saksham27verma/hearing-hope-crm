import type { HopeAICitation } from '../types';
import { buildCitation, scoreCollectionDocs } from './shared';

interface SaleRecord {
  id: string;
  invoiceNumber: string;
  patientName: string;
  phone: string;
  centerId: string;
  branch: string;
  grandTotal: number;
  saleDate: any;
  notes: string;
  paymentMethod?: string;
}

export async function retrieveSales(query: string, branchId?: string): Promise<{ citations: HopeAICitation[]; exactResults: string[] }> {
  const citations = await scoreCollectionDocs<SaleRecord>(
    'sales',
    query,
    (id, data) => {
      const centerId = data.centerId || '';
      if (branchId && centerId && centerId !== branchId) return null;
      return {
        id,
        invoiceNumber: data.invoiceNumber || '',
        patientName: data.patientName || '',
        phone: data.phone || '',
        centerId,
        branch: data.branch || '',
        grandTotal: data.grandTotal || 0,
        saleDate: data.saleDate || '',
        notes: data.notes || '',
        paymentMethod: data.paymentMethod || '',
      };
    },
    record => buildCitation({
      id: `sale-${record.id}`,
      domain: 'sales',
      entityType: 'sale',
      entityId: record.id,
      title: record.invoiceNumber || `Sale ${record.id}`,
      snippet: [
        record.patientName ? `Patient ${record.patientName}` : '',
        record.branch ? `Branch ${record.branch}` : '',
        record.grandTotal ? `Grand total ₹${record.grandTotal}` : '',
        record.saleDate ? `Sale date ${record.saleDate}` : '',
        record.paymentMethod ? `Payment ${record.paymentMethod}` : '',
        record.notes || '',
      ].filter(Boolean).join('. '),
      sourcePath: '/sales',
      metadata: record,
    })
  );

  const exactResults = citations.map(citation => {
    const metadata = citation.metadata || {};
    return `${metadata.invoiceNumber || citation.title}: patient ${metadata.patientName || 'unknown'}${metadata.grandTotal ? `, total ₹${metadata.grandTotal}` : ''}${metadata.branch ? `, branch ${metadata.branch}` : ''}${metadata.paymentMethod ? `, payment ${metadata.paymentMethod}` : ''}`;
  });

  return { citations, exactResults };
}
