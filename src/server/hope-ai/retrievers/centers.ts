import type { HopeAICitation } from '../types';
import { buildCitation, scoreCollectionDocs } from './shared';

interface CenterRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  isHeadOffice: boolean;
}

export async function retrieveCenters(query: string): Promise<{ citations: HopeAICitation[]; exactResults: string[] }> {
  const citations = await scoreCollectionDocs<CenterRecord>(
    'centers',
    query,
    (id, data) => ({
      id,
      name: data.name || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      isHeadOffice: !!data.isHeadOffice,
    }),
    record => buildCitation({
      id: `center-${record.id}`,
      domain: 'centers',
      entityType: 'center',
      entityId: record.id,
      title: record.name || `Center ${record.id}`,
      snippet: [
        record.address || '',
        record.phone || '',
        record.email || '',
        record.isHeadOffice ? 'Head office' : '',
      ].filter(Boolean).join('. '),
      sourcePath: '/centers',
      metadata: record,
    })
  );

  const exactResults = citations.map(citation => {
    const metadata = citation.metadata || {};
    return `${metadata.name || citation.title}${metadata.isHeadOffice ? ' (Head Office)' : ''}${metadata.phone ? `, phone ${metadata.phone}` : ''}`;
  });

  return { citations, exactResults };
}
