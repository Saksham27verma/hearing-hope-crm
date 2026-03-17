export type EnquiryJourneyStatus =
  | 'enquiry'
  | 'in_process'
  | 'in_trial'
  | 'booked'
  | 'sold'
  | 'not_interested'
  | 'completed';

export const ENQUIRY_STATUS_OPTIONS: Array<{ value: EnquiryJourneyStatus; label: string }> = [
  { value: 'enquiry', label: 'New Enquiry' },
  { value: 'in_process', label: 'In Process' },
  { value: 'in_trial', label: 'In Trial' },
  { value: 'booked', label: 'Booked' },
  { value: 'sold', label: 'Sold' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'completed', label: 'Completed' },
];

const normalize = (value: any) => String(value || '').toLowerCase();

export const getEnquiryStatusMeta = (enquiry: any): {
  key: EnquiryJourneyStatus;
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
} => {
  const schedules = Array.isArray(enquiry?.visitSchedules)
    ? enquiry.visitSchedules
    : Array.isArray(enquiry?.visits)
      ? enquiry.visits
      : [];

  const reversed = [...schedules].reverse();
  const financialStatus = normalize(enquiry?.financialSummary?.paymentStatus);

  const hasAnyProgress =
    schedules.length > 0 ||
    (Array.isArray(enquiry?.followUps) && enquiry.followUps.length > 0) ||
    Boolean(enquiry?.assignedTo) ||
    Boolean(enquiry?.telecaller);

  const latestNotInterested = reversed.find((visit: any) =>
    normalize(visit?.hearingAidStatus) === 'not_interested' ||
    normalize(visit?.trialResult) === 'unsuccessful'
  );
  if (latestNotInterested) {
    return { key: 'not_interested', label: 'Not Interested', color: 'error' };
  }

  const latestSold = reversed.find((visit: any) =>
    Boolean(visit?.hearingAidSale) ||
    Boolean(visit?.purchaseFromTrial) ||
    normalize(visit?.hearingAidStatus) === 'sold'
  );
  if (latestSold) {
    return {
      key: financialStatus === 'fully_paid' ? 'completed' : 'sold',
      label: financialStatus === 'fully_paid' ? 'Completed' : 'Sold',
      color: financialStatus === 'fully_paid' ? 'success' : 'success',
    };
  }

  const latestBooked = reversed.find((visit: any) =>
    Boolean(visit?.hearingAidBooked) ||
    Number(visit?.bookingAdvanceAmount || 0) > 0 ||
    normalize(visit?.hearingAidStatus) === 'booked'
  );
  if (latestBooked) {
    return { key: 'booked', label: 'Booked', color: 'primary' };
  }

  const latestTrial = reversed.find((visit: any) =>
    Boolean(visit?.hearingAidTrial) ||
    Boolean(visit?.trialGiven) ||
    ['trial_given', 'trial_completed', 'trial_extended'].includes(normalize(visit?.hearingAidStatus)) ||
    ['ongoing', 'extended'].includes(normalize(visit?.trialResult))
  );
  if (latestTrial) {
    return { key: 'in_trial', label: 'In Trial', color: 'warning' };
  }

  const allCompleted =
    schedules.length > 0 &&
    schedules.every((visit: any) =>
      normalize(visit?.visitStatus) === 'completed' ||
      normalize(visit?.status) === 'completed'
    );
  if (allCompleted) {
    return { key: 'completed', label: 'Completed', color: 'success' };
  }

  if (hasAnyProgress) {
    return { key: 'in_process', label: 'In Process', color: 'info' };
  }

  return { key: 'enquiry', label: 'New Enquiry', color: 'default' };
};
