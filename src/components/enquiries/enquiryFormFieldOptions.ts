/**
 * Single source for enquiry form dropdown values used by SimplifiedEnquiryForm and filter UI.
 */

/** Reference / lead source — must match SimplifiedEnquiryForm multi-select */
export const ENQUIRY_REFERENCE_OPTIONS: string[] = [
  'Camp',
  'CGHS/DGEHS/ Any Govt. deptt',
  'converted',
  'Dealer',
  'Dr Deepika Ref.',
  'Dr Yogesh Kansal Ref.',
  'existing',
  'Gautam dhamija',
  'GN RESOUND ENQUIRY',
  'Google Adwords',
  'Hear.com',
  'home service',
  'INDIAMART',
  'just dial',
  'Medical Store Reference',
  'must and more',
  'Nath brother ( chemist )',
  'Online',
  'Other Doctor Referenes',
  'reference existing patient',
  'signia',
  'Visit Health',
  'walking',
];

/** Visit row: center vs home (stored on each visit / visitSchedule) */
export const VISIT_LOCATION_OPTIONS = [
  { value: 'center', label: 'Center visit' },
  { value: 'home', label: 'Home visit' },
];

/** Stored on each visit as hearingAidStatus */
export const HEARING_AID_STATUS_OPTIONS = [
  { value: 'trial_given', label: 'Trial given' },
  { value: 'booked', label: 'Booked' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'sold', label: 'Sold' },
  { value: 'trial_completed', label: 'Trial completed' },
  { value: 'trial_extended', label: 'Trial extended' },
];

/** Trial result on visit */
export const TRIAL_RESULT_OPTIONS = [
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'successful', label: 'Successful' },
  { value: 'unsuccessful', label: 'Unsuccessful' },
  { value: 'extended', label: 'Extended' },
];

/** medicalServices / active form slugs saved from the simplified form */
export const MEDICAL_SERVICE_SLUGS = [
  'hearing_test',
  'hearing_aid_trial',
  'hearing_aid_booked',
  'hearing_aid_sale',
  'hearing_aid',
  'accessory',
  'programming',
  'repair',
  'counselling',
];
