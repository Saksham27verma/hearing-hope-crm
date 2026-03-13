import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import type { HopeAIIndexDocument } from '../types';
import { normalizeText, safeDateString, tokenize } from '../utils';

const INDEX_COLLECTION = 'hopeAiIndex';
const META_COLLECTION = 'hopeAiSettings';
const META_DOC = 'indexStatus';

function buildIndexId(domain: string, entityType: string, entityId: string) {
  return `${domain}__${entityType}__${entityId}`.replace(/[^\w-]+/g, '_');
}

function buildSearchTokens(parts: any[]) {
  return tokenize(parts.map(part => normalizeText(part)).join(' ')).slice(0, 200);
}

function buildDoc(
  domain: string,
  entityType: string,
  entityId: string,
  title: string,
  summaryText: string,
  metadata: Record<string, any>,
  sourcePath: string,
  restrictedModules: string[]
): HopeAIIndexDocument {
  return {
    id: buildIndexId(domain, entityType, entityId),
    domain,
    entityType,
    entityId,
    title,
    summaryText,
    searchTokens: buildSearchTokens([title, summaryText, metadata]),
    sourcePath,
    metadata,
    branchIds: [metadata.branchId, metadata.centerId, metadata.location].filter(Boolean),
    restrictedModules,
  };
}

async function collectEnquiryDocs(): Promise<HopeAIIndexDocument[]> {
  const snap = await adminDb().collection('enquiries').get();
  const docs: HopeAIIndexDocument[] = [];

  snap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    const enquiryId = docSnap.id;
    const visits = Array.isArray(data.visits) ? data.visits : [];
    const followUps = Array.isArray(data.followUps) ? data.followUps : [];
    const latestVisit = visits[visits.length - 1];

    docs.push(buildDoc(
      'enquiries',
      'enquiry',
      enquiryId,
      `${data.name || 'Unknown'} enquiry`,
      [
        `Patient ${data.name || 'Unknown'}`,
        data.phone ? `phone ${data.phone}` : '',
        data.status ? `status ${data.status}` : '',
        data.subject ? `subject ${data.subject}` : '',
        data.notes || '',
        latestVisit?.visitNotes || '',
      ].filter(Boolean).join('. '),
      {
        patientName: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        status: data.status || '',
        assignedTo: data.assignedTo || '',
        telecaller: data.telecaller || '',
        centerId: data.center || data.visitingCenter || '',
        latestVisitDate: latestVisit?.visitDate || '',
        latestVisitStage: latestVisit?.journeyStage || latestVisit?.hearingAidStatus || '',
      },
      `/interaction/enquiries/${enquiryId}`,
      ['interaction']
    ));

    visits.forEach((visit: any, index: number) => {
      const visitId = visit.id || `${enquiryId}-visit-${index + 1}`;
      docs.push(buildDoc(
        'enquiries',
        'visit',
        visitId,
        `${data.name || 'Unknown'} visit ${index + 1}`,
        [
          visit.visitDate ? `Visit date ${visit.visitDate}` : '',
          visit.visitNotes || '',
          visit.hearingAidStatus || '',
          visit.journeyStage || '',
          normalizeText(visit.products),
        ].filter(Boolean).join('. '),
        {
          enquiryId,
          patientName: data.name || '',
          visitDate: visit.visitDate || '',
          centerId: visit.center || data.center || '',
          journeyStage: visit.journeyStage || '',
          hearingAidStatus: visit.hearingAidStatus || '',
        },
        `/interaction/enquiries/${enquiryId}`,
        ['interaction']
      ));
    });

    followUps.forEach((followUp: any, index: number) => {
      const followUpId = followUp.id || `${enquiryId}-followup-${index + 1}`;
      docs.push(buildDoc(
        'enquiries',
        'followup',
        followUpId,
        `${data.name || 'Unknown'} follow-up ${index + 1}`,
        [
          followUp.date ? `Follow-up date ${followUp.date}` : '',
          followUp.notes || '',
          followUp.status || '',
        ].filter(Boolean).join('. '),
        {
          enquiryId,
          patientName: data.name || '',
          date: followUp.date || '',
          status: followUp.status || '',
        },
        `/interaction/enquiries/${enquiryId}`,
        ['interaction']
      ));
    });
  });

  return docs;
}

async function collectProductDocs(): Promise<HopeAIIndexDocument[]> {
  const snap = await adminDb().collection('products').get();
  return snap.docs.map(docSnap => {
    const data: any = docSnap.data();
    return buildDoc(
      'products',
      'product',
      docSnap.id,
      data.name || 'Unnamed product',
      [
        data.type ? `Type ${data.type}` : '',
        data.company ? `Company ${data.company}` : '',
        data.description || '',
        data.features || '',
        data.hasSerialNumber ? 'Serial tracked product' : '',
      ].filter(Boolean).join('. '),
      {
        productName: data.name || '',
        type: data.type || '',
        company: data.company || '',
        mrp: data.mrp || 0,
        dealerPrice: data.dealerPrice || 0,
        hasSerialNumber: !!data.hasSerialNumber,
      },
      `/products#id=${docSnap.id}`,
      ['products']
    );
  });
}

async function collectSalesDocs(): Promise<HopeAIIndexDocument[]> {
  const snap = await adminDb().collection('sales').get();
  return snap.docs.map(docSnap => {
    const data: any = docSnap.data();
    return buildDoc(
      'sales',
      'sale',
      docSnap.id,
      data.invoiceNumber || `Sale ${docSnap.id}`,
      [
        data.patientName ? `Patient ${data.patientName}` : '',
        data.branch ? `Branch ${data.branch}` : '',
        data.notes || '',
        normalizeText(data.products),
      ].filter(Boolean).join('. '),
      {
        invoiceNumber: data.invoiceNumber || '',
        patientName: data.patientName || '',
        phone: data.phone || '',
        centerId: data.centerId || '',
        branch: data.branch || '',
        saleDate: safeDateString(data.saleDate),
        grandTotal: data.grandTotal || 0,
      },
      '/sales',
      ['sales']
    );
  });
}

async function collectPurchaseDocs(): Promise<HopeAIIndexDocument[]> {
  const snap = await adminDb().collection('purchases').get();
  return snap.docs.map(docSnap => {
    const data: any = docSnap.data();
    return buildDoc(
      'purchases',
      'purchase',
      docSnap.id,
      data.invoiceNo || `Purchase ${docSnap.id}`,
      [
        data.party?.name ? `Supplier ${data.party.name}` : '',
        data.reference || '',
        normalizeText(data.products),
      ].filter(Boolean).join('. '),
      {
        invoiceNo: data.invoiceNo || '',
        supplierName: data.party?.name || '',
        location: data.location || '',
        purchaseDate: safeDateString(data.purchaseDate),
        totalAmount: data.totalAmount || data.grandTotal || 0,
      },
      `/purchase-management#id=${docSnap.id}`,
      ['purchases']
    );
  });
}

async function collectCenterDocs(): Promise<HopeAIIndexDocument[]> {
  const snap = await adminDb().collection('centers').get();
  return snap.docs.map(docSnap => {
    const data: any = docSnap.data();
    return buildDoc(
      'centers',
      'center',
      docSnap.id,
      data.name || `Center ${docSnap.id}`,
      [
        data.address || '',
        data.phone || '',
        data.email || '',
        data.isHeadOffice ? 'Head office' : '',
      ].filter(Boolean).join('. '),
      {
        centerName: data.name || '',
        branchId: docSnap.id,
        isHeadOffice: !!data.isHeadOffice,
      },
      '/centers',
      ['centers']
    );
  });
}

async function collectPartyDocs(): Promise<HopeAIIndexDocument[]> {
  const snap = await adminDb().collection('parties').get();
  return snap.docs.map(docSnap => {
    const data: any = docSnap.data();
    return buildDoc(
      'parties',
      'party',
      docSnap.id,
      data.name || `Party ${docSnap.id}`,
      [
        data.type ? `Type ${data.type}` : '',
        data.phone || '',
        data.email || '',
        data.address || '',
      ].filter(Boolean).join('. '),
      {
        partyName: data.name || '',
        type: data.type || '',
        phone: data.phone || '',
      },
      `/parties#id=${docSnap.id}`,
      ['parties']
    );
  });
}

async function collectStockTransferDocs(): Promise<HopeAIIndexDocument[]> {
  const snap = await adminDb().collection('stockTransfers').get();
  return snap.docs.map(docSnap => {
    const data: any = docSnap.data();
    return buildDoc(
      'stockTransfers',
      'transfer',
      docSnap.id,
      data.transferNumber || `Stock transfer ${docSnap.id}`,
      [
        data.fromBranch ? `From ${data.fromBranch}` : '',
        data.toBranch ? `To ${data.toBranch}` : '',
        data.reason || '',
        normalizeText(data.products),
      ].filter(Boolean).join('. '),
      {
        transferNumber: data.transferNumber || '',
        fromBranch: data.fromBranch || '',
        toBranch: data.toBranch || '',
        transferDate: safeDateString(data.transferDate),
      },
      '/stock-transfer',
      ['stock']
    );
  });
}

async function collectInventoryMovementDocs(): Promise<HopeAIIndexDocument[]> {
  const [materialInSnap, materialOutSnap] = await Promise.all([
    adminDb().collection('materialInward').get(),
    adminDb().collection('materialsOut').get(),
  ]);

  const docs: HopeAIIndexDocument[] = [];

  materialInSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    docs.push(buildDoc(
      'inventory',
      'materialIn',
      docSnap.id,
      data.challanNumber || `Material In ${docSnap.id}`,
      [
        data.supplier?.name ? `Supplier ${data.supplier.name}` : '',
        data.notes || '',
        normalizeText(data.products),
      ].filter(Boolean).join('. '),
      {
        location: data.location || '',
        supplierName: data.supplier?.name || '',
        challanNumber: data.challanNumber || '',
        receivedDate: safeDateString(data.receivedDate),
      },
      `/material-in#id=${docSnap.id}`,
      ['inventory', 'materials']
    ));
  });

  materialOutSnap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    docs.push(buildDoc(
      'inventory',
      'materialOut',
      docSnap.id,
      data.challanNumber || `Material Out ${docSnap.id}`,
      [
        data.recipient?.name ? `Recipient ${data.recipient.name}` : '',
        data.reason || '',
        data.notes || '',
        normalizeText(data.products),
      ].filter(Boolean).join('. '),
      {
        location: data.location || '',
        recipientName: data.recipient?.name || '',
        challanNumber: data.challanNumber || '',
        dispatchDate: safeDateString(data.dispatchDate),
        status: data.status || '',
      },
      `/material-out#id=${docSnap.id}`,
      ['inventory', 'materials', 'stock']
    ));
  });

  return docs;
}

export async function buildHopeAIIndexDocuments(): Promise<HopeAIIndexDocument[]> {
  const batches = await Promise.all([
    collectEnquiryDocs(),
    collectProductDocs(),
    collectSalesDocs(),
    collectPurchaseDocs(),
    collectCenterDocs(),
    collectPartyDocs(),
    collectStockTransferDocs(),
    collectInventoryMovementDocs(),
  ]);

  return batches.flat();
}

export async function saveHopeAIIndexDocuments(documents: HopeAIIndexDocument[], initiatedBy: string) {
  const db = adminDb();

  const existingSnap = await db.collection(INDEX_COLLECTION).get();
  for (let index = 0; index < existingSnap.docs.length; index += 400) {
    const batchDeletes = db.batch();
    existingSnap.docs.slice(index, index + 400).forEach(docSnap => batchDeletes.delete(docSnap.ref));
    await batchDeletes.commit();
  }

  for (let index = 0; index < documents.length; index += 400) {
    const batch = db.batch();
    documents.slice(index, index + 400).forEach(document => {
      batch.set(db.collection(INDEX_COLLECTION).doc(document.id), {
        ...document,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  await db.collection(META_COLLECTION).doc(META_DOC).set({
    lastIndexedAt: FieldValue.serverTimestamp(),
    documentCount: documents.length,
    lastIndexedBy: initiatedBy,
  }, { merge: true });
}

export async function runHopeAIBackfill(initiatedBy: string) {
  const documents = await buildHopeAIIndexDocuments();
  await saveHopeAIIndexDocuments(documents, initiatedBy);
  return { count: documents.length };
}
