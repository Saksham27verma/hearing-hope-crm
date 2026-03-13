import { adminDb } from '@/server/firebaseAdmin';
import type { HopeAICitation } from '../types';
import { extractQueryTokens, normalizeText, rankCitations, safeDateString, summarizeForCitation } from '../utils';

function formatVisitSummary(visit: any, index: number): string {
  const parts: string[] = [];
  const date = visit.visitDate || visit.date || '';
  const purpose = visit.purpose || '';
  const notes = visit.visitNotes || visit.notes || '';
  const staff = visit.staff || visit.testDoneBy || '';
  const visitType = visit.visitType || '';

  parts.push(`Visit ${index + 1}${date ? ` on ${date}` : ''}`);
  if (purpose) parts.push(`Purpose: ${purpose}`);
  if (visitType) parts.push(`Type: ${visitType}`);
  if (staff) parts.push(`Staff: ${staff}`);

  const activities: string[] = [];
  if (visit.hearingTest) activities.push('Hearing Test done');
  if (visit.hearingAidTrial || visit.trialGiven) activities.push('Trial given');
  if (visit.hearingAidBooked) activities.push('Hearing aid booked');
  if (visit.hearingAidSale) activities.push('Hearing aid sold');
  if (visit.salesReturn) activities.push('Sales return');
  if (visit.accessory) activities.push('Accessory');
  if (visit.programming) activities.push('Programming');
  if (visit.repair) activities.push('Repair');
  if (visit.counselling) activities.push('Counselling');

  if (activities.length) parts.push(`Activities: ${activities.join(', ')}`);

  if (visit.hearingAidStatus) parts.push(`HA Status: ${visit.hearingAidStatus}`);
  if (visit.journeyStage) parts.push(`Stage: ${visit.journeyStage}`);

  if (visit.testDetails) {
    const td = visit.testDetails;
    if (td.testName) parts.push(`Test: ${td.testName}`);
    if (td.testResults) parts.push(`Test Results: ${td.testResults}`);
    if (td.recommendations) parts.push(`Recommendations: ${td.recommendations}`);
    if (td.hearingLossType) parts.push(`Hearing Loss Type: ${td.hearingLossType}`);
    if (td.testPrice) parts.push(`Test Price: ₹${td.testPrice}`);
  }

  if (visit.trialDetails) {
    const tr = visit.trialDetails;
    if (tr.trialDevice || tr.deviceBrand || tr.deviceModel) {
      parts.push(`Trial Device: ${[tr.trialDevice, tr.deviceBrand, tr.deviceModel].filter(Boolean).join(' ')}`);
    }
    if (tr.trialDuration) parts.push(`Trial Duration: ${tr.trialDuration}`);
    if (tr.trialResult) parts.push(`Trial Result: ${tr.trialResult}`);
    if (tr.trialFeedback || tr.patientFeedback) parts.push(`Feedback: ${tr.trialFeedback || tr.patientFeedback}`);
  }

  if (visit.trialSerialNumber) parts.push(`Trial Serial: ${visit.trialSerialNumber}`);
  if (visit.trialHearingAidModel) parts.push(`Trial Model: ${visit.trialHearingAidModel}`);
  if (visit.trialResult) parts.push(`Trial Result: ${visit.trialResult}`);
  if (visit.trialStartDate) parts.push(`Trial Start: ${visit.trialStartDate}`);
  if (visit.trialEndDate) parts.push(`Trial End: ${visit.trialEndDate}`);

  if (visit.fittingDetails) {
    const fd = visit.fittingDetails;
    if (fd.hearingAidBrand || fd.hearingAidModel) {
      parts.push(`Fitting: ${[fd.hearingAidBrand, fd.hearingAidModel].filter(Boolean).join(' ')}`);
    }
    if (fd.serialNumber) parts.push(`Fitting Serial: ${fd.serialNumber}`);
    if (fd.hearingAidPrice) parts.push(`HA Price: ₹${fd.hearingAidPrice}`);
  }

  if (visit.homeVisitDetails) {
    const hv = visit.homeVisitDetails;
    if (hv.visitOutcome) parts.push(`Home Visit Outcome: ${hv.visitOutcome}`);
    if (hv.hearingAidsShown) parts.push(`Aids Shown: ${hv.hearingAidsShown}`);
  }

  if (visit.hearingAidModel || visit.hearingAidBrand) {
    parts.push(`HA: ${[visit.hearingAidBrand, visit.hearingAidModel].filter(Boolean).join(' ')}`);
  }
  if (visit.hearingAidPrice) parts.push(`HA Price: ₹${visit.hearingAidPrice}`);
  if (visit.whichEar) parts.push(`Ear: ${visit.whichEar}`);

  if (visit.bookingAdvanceAmount) parts.push(`Advance: ₹${visit.bookingAdvanceAmount}`);
  if (visit.bookingDate) parts.push(`Booking Date: ${visit.bookingDate}`);

  if (notes) parts.push(`Notes: ${notes}`);

  return parts.join('. ');
}

export async function retrieveEnquiries(query: string, branchId?: string): Promise<{ citations: HopeAICitation[]; exactResults: string[] }> {
  const db = adminDb();
  const tokens = extractQueryTokens(query);
  const snap = await db.collection('enquiries').get();

  const citations: HopeAICitation[] = [];

  snap.docs.forEach(docSnap => {
    const data: any = docSnap.data();
    const visits = Array.isArray(data.visits) ? data.visits : [];
    const followUps = Array.isArray(data.followUps) ? data.followUps : [];
    const payments = Array.isArray(data.payments) ? data.payments : [];
    const centerId = data.center || data.visitingCenter || (visits[visits.length - 1]?.center) || '';

    if (branchId && centerId && centerId !== branchId) return;

    const visitSummaries = visits.map((v: any, i: number) => formatVisitSummary(v, i));

    const fullText = [
      data.name || '',
      data.phone || '',
      data.email || '',
      data.status || '',
      data.subject || '',
      data.notes || '',
      data.assignedTo || '',
      data.telecaller || '',
      data.message || '',
      ...visitSummaries,
      normalizeText(data.hearingAidDetails),
      normalizeText(data.testDetails),
      normalizeText(data.trialDetails),
    ].filter(Boolean).join(' ');

    const haystack = fullText.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (haystack.includes(token.toLowerCase()) ? 1 : 0), 0);
    if (score <= 0) return;

    const snippet = [
      `Patient: ${data.name || 'Unknown'}`,
      data.phone ? `Phone: ${data.phone}` : '',
      `Status: ${data.status || 'unknown'}`,
      `Total Visits: ${visits.length}`,
      followUps.length ? `Follow-ups: ${followUps.length}` : '',
      payments.length ? `Payments: ${payments.length}` : '',
      data.assignedTo ? `Assigned To: ${data.assignedTo}` : '',
      data.telecaller ? `Telecaller: ${data.telecaller}` : '',
      ...visitSummaries,
    ].filter(Boolean).join('\n');

    citations.push({
      id: `enquiry-${docSnap.id}`,
      domain: 'enquiries',
      entityType: 'enquiry',
      entityId: docSnap.id,
      title: `${data.name || 'Unknown'} enquiry`,
      snippet: summarizeForCitation(snippet, 600),
      sourcePath: `/interaction/enquiries/${docSnap.id}`,
      metadata: {
        patientName: data.name || '',
        phone: data.phone || '',
        status: data.status || '',
        centerId,
        assignedTo: data.assignedTo || '',
        telecaller: data.telecaller || '',
        totalVisits: visits.length,
        totalFollowUps: followUps.length,
        totalPayments: payments.length,
        createdAt: safeDateString(data.createdAt),
        updatedAt: safeDateString(data.updatedAt),
      },
      score,
    });
  });

  const ranked = rankCitations(query, citations, 8);

  const exactResults = ranked.map(citation => {
    const m = citation.metadata || {};
    const lines: string[] = [];
    lines.push(`${m.patientName || citation.title}: Status=${m.status || 'unknown'}, Visits=${m.totalVisits || 0}, Follow-ups=${m.totalFollowUps || 0}`);
    if (m.phone) lines[0] += `, Phone=${m.phone}`;
    if (m.assignedTo) lines[0] += `, Assigned=${m.assignedTo}`;

    const visitDetail = citation.snippet
      .split('\n')
      .filter((l: string) => l.startsWith('Visit '));
    visitDetail.forEach((v: string) => lines.push(`  ${v}`));

    return lines.join('\n');
  });

  return { citations: ranked, exactResults };
}
