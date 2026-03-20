/**
 * Filter field metadata for the Enquiries module — grouped for Linear/Airtable-style pickers.
 * Paths match Firestore documents; a few synthetic paths are resolved in enquiryFilterFieldValue.
 */

import {
  ENQUIRY_REFERENCE_OPTIONS,
  VISIT_LOCATION_OPTIONS,
  HEARING_AID_STATUS_OPTIONS,
  TRIAL_RESULT_OPTIONS,
} from './enquiryFormFieldOptions';

export type FilterDataType = 'text' | 'number' | 'date' | 'boolean' | 'array';

export type EnumOptionSource =
  | 'static'
  | 'assignedTo'
  | 'telecaller'
  | 'visitorType'
  | 'visitTypeRoot'
  | 'visitStatusRoot'
  | 'enquiryType'
  | 'activeFormType'
  | 'reference'
  | 'centers'
  | 'paymentStatus'
  | 'paymentFor'
  | 'paymentMode';

export interface EnquiryFilterFieldMeta {
  field: string;
  label: string;
  dataType: FilterDataType;
  category: string;
  /** For searchable multi-select (stored as joined values + in_list operator) */
  enumSource?: EnumOptionSource;
  staticOptions?: { value: string; label: string }[];
  description?: string;
}

export const PAYMENT_FOR_OPTIONS = [
  { value: 'hearing_test', label: 'Hearing test' },
  { value: 'hearing_aid', label: 'Hearing aid' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'booking_advance', label: 'Booking advance' },
  { value: 'full_payment', label: 'Full payment' },
  { value: 'partial_payment', label: 'Partial payment' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_MODE_OPTIONS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Card', label: 'Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Net Banking', label: 'Net Banking' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'NEFT/RTGS', label: 'NEFT/RTGS' },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'fully_paid', label: 'Fully paid' },
  { value: 'pending', label: 'Pending' },
];

/** For filter Autocomplete — reference options come from props + this list (see enumOptionsForField). */
export const REFERENCE_OPTION_OBJECTS = ENQUIRY_REFERENCE_OPTIONS.map(v => ({ value: v, label: v }));

export const ENQUIRY_TYPE_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'product', label: 'Product inquiry' },
  { value: 'service', label: 'Service request' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'appointment', label: 'Appointment' },
];

const VISITOR_TYPE_OPTS = [
  { value: 'patient', label: 'Patient' },
  { value: 'general', label: 'General' },
];

const VISIT_HA_STATUS_ALL = [...HEARING_AID_STATUS_OPTIONS, ...TRIAL_RESULT_OPTIONS];

/** Grouped lists for the add-filter menu */
export const ENQUIRY_FILTER_FIELD_GROUPS: { category: string; fields: EnquiryFilterFieldMeta[] }[] = [
  {
    category: 'Enquiry',
    fields: [
      { field: 'name', label: 'Name', dataType: 'text', category: 'Enquiry' },
      { field: 'phone', label: 'Phone', dataType: 'text', category: 'Enquiry' },
      { field: 'email', label: 'Email', dataType: 'text', category: 'Enquiry' },
      { field: 'address', label: 'Address', dataType: 'text', category: 'Enquiry' },
      { field: 'reference', label: 'Reference / lead source', dataType: 'text', category: 'Enquiry', enumSource: 'reference' },
      { field: 'enquiryType', label: 'Enquiry type', dataType: 'text', category: 'Enquiry', enumSource: 'enquiryType' },
      { field: 'subject', label: 'Subject', dataType: 'text', category: 'Enquiry' },
      { field: 'message', label: 'Message', dataType: 'text', category: 'Enquiry' },
      { field: 'notes', label: 'Notes', dataType: 'text', category: 'Enquiry' },
      { field: 'companyName', label: 'Company name', dataType: 'text', category: 'Enquiry' },
      { field: 'purposeOfVisit', label: 'Purpose of visit', dataType: 'text', category: 'Enquiry' },
      { field: 'contactPerson', label: 'Contact person', dataType: 'text', category: 'Enquiry' },
      { field: 'visitorType', label: 'Visitor type', dataType: 'text', category: 'Enquiry', enumSource: 'static', staticOptions: VISITOR_TYPE_OPTS },
      {
        field: 'visitLocationAny',
        label: 'Visit location (center / home, any visit)',
        dataType: 'text',
        category: 'Enquiry',
        enumSource: 'static',
        staticOptions: VISIT_LOCATION_OPTIONS,
        description: 'Matches if any visit or schedule uses this location',
      },
      {
        field: 'hearingAidStatusAny',
        label: 'Hearing aid / trial status (any visit)',
        dataType: 'text',
        category: 'Enquiry',
        enumSource: 'static',
        staticOptions: VISIT_HA_STATUS_ALL,
        description: 'hearingAidStatus or trialResult on any visit',
      },
      { field: 'visitType', label: 'Visit type (enquiry root only)', dataType: 'text', category: 'Enquiry', enumSource: 'visitTypeRoot' },
      { field: 'visitStatus', label: 'Visit status (enquiry root only)', dataType: 'text', category: 'Enquiry', enumSource: 'visitStatusRoot' },
      { field: 'assignedTo', label: 'Assigned to', dataType: 'text', category: 'Enquiry', enumSource: 'assignedTo' },
      { field: 'telecaller', label: 'Telecaller', dataType: 'text', category: 'Enquiry', enumSource: 'telecaller' },
      { field: 'center', label: 'Center', dataType: 'text', category: 'Enquiry', enumSource: 'centers' },
      { field: 'visitingCenter', label: 'Visiting center (legacy id)', dataType: 'text', category: 'Enquiry', enumSource: 'centers' },
      { field: 'createdAt', label: 'Created date', dataType: 'date', category: 'Enquiry' },
      { field: 'status', label: 'Legacy status field', dataType: 'text', category: 'Enquiry' },
      { field: 'activeFormTypes', label: 'Active form types', dataType: 'array', category: 'Enquiry', enumSource: 'activeFormType' },
    ],
  },
  {
    category: 'Visits',
    fields: [
      { field: 'visits.length', label: 'Number of visits', dataType: 'number', category: 'Visits' },
      { field: 'visitSchedules.length', label: 'Scheduled visits count', dataType: 'number', category: 'Visits' },
      { field: 'testDetails.testPrice', label: 'Test price (root)', dataType: 'number', category: 'Visits' },
      { field: 'testDetails.rightEarLoss', label: 'Right ear loss (summary)', dataType: 'text', category: 'Visits' },
      { field: 'testDetails.leftEarLoss', label: 'Left ear loss (summary)', dataType: 'text', category: 'Visits' },
    ],
  },
  {
    category: 'Follow-ups',
    fields: [
      { field: 'followUps.length', label: 'Follow-up count', dataType: 'number', category: 'Follow-ups' },
    ],
  },
  {
    category: 'Sales & payments',
    fields: [
      { field: 'payments.length', label: 'Payment records count', dataType: 'number', category: 'Sales & payments' },
      { field: 'paymentsTotal', label: 'Total payments amount (sum)', dataType: 'number', category: 'Sales & payments', description: 'Sum of all payment amounts' },
      { field: 'financialSummary.totalDue', label: 'Total due', dataType: 'number', category: 'Sales & payments' },
      { field: 'financialSummary.totalPaid', label: 'Total paid', dataType: 'number', category: 'Sales & payments' },
      { field: 'financialSummary.outstanding', label: 'Outstanding', dataType: 'number', category: 'Sales & payments' },
      { field: 'financialSummary.paymentStatus', label: 'Payment status', dataType: 'text', category: 'Sales & payments', enumSource: 'static', staticOptions: PAYMENT_STATUS_OPTIONS },
      { field: 'hearingAidDetails.finalPrice', label: 'HA quoted final price', dataType: 'number', category: 'Sales & payments' },
      { field: 'hearingAidDetails.mrp', label: 'HA MRP', dataType: 'number', category: 'Sales & payments' },
      { field: 'paymentForAny', label: 'Has payment for', dataType: 'text', category: 'Sales & payments', enumSource: 'static', staticOptions: PAYMENT_FOR_OPTIONS, description: 'Match if any payment uses this type' },
      { field: 'paymentModeAny', label: 'Has payment mode', dataType: 'text', category: 'Sales & payments', enumSource: 'static', staticOptions: PAYMENT_MODE_OPTIONS },
    ],
  },
];

export function flatFilterFields(): EnquiryFilterFieldMeta[] {
  return ENQUIRY_FILTER_FIELD_GROUPS.flatMap(g => g.fields);
}

export function getFieldMeta(fieldPath: string): EnquiryFilterFieldMeta | undefined {
  return flatFilterFields().find(f => f.field === fieldPath);
}

/** Operators by data type — aligned with enquiries page applyFilterCondition */
export const operatorsByType: Record<FilterDataType, { value: string; label: string }[]> = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'in_list', label: 'Is any of' },
    { value: 'regex', label: 'Regex' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
    { value: 'is_null', label: 'Is null' },
    { value: 'is_not_null', label: 'Is not null' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'greater_than_equal', label: 'Greater or equal' },
    { value: 'less_than', label: 'Less than' },
    { value: 'less_than_equal', label: 'Less or equal' },
    { value: 'between', label: 'Between' },
    { value: 'not_between', label: 'Not between' },
    { value: 'is_null', label: 'Is null' },
    { value: 'is_not_null', label: 'Is not null' },
  ],
  date: [
    { value: 'equals', label: 'On date' },
    { value: 'not_equals', label: 'Not on date' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
    { value: 'last_days', label: 'Last N days' },
    { value: 'next_days', label: 'Next N days' },
    { value: 'this_month', label: 'This month' },
    { value: 'last_month', label: 'Last month' },
    { value: 'this_year', label: 'This year' },
    { value: 'is_null', label: 'Is null' },
    { value: 'is_not_null', label: 'Is not null' },
  ],
  boolean: [
    { value: 'is_true', label: 'Is true' },
    { value: 'is_false', label: 'Is false' },
    { value: 'is_null', label: 'Is null' },
  ],
  array: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'contains_all', label: 'Contains all' },
    { value: 'contains_any', label: 'Contains any' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
    { value: 'length_equals', label: 'Length equals' },
    { value: 'length_greater', label: 'Length greater than' },
    { value: 'length_less', label: 'Length less than' },
  ],
};
