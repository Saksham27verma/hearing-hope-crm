/**
 * Every Enquiries-module dropdown / enum set: where it appears in the CRM and built-in defaults.
 * Settings → Enquiries uses this list; Firestore keys are `moduleKey: enquiries` + `fieldKey` below.
 */
import { ENQUIRY_REFERENCE_OPTIONS } from '@/components/enquiries/enquiryFormFieldOptions';
import { ENQUIRY_STATUS_OPTIONS } from '@/utils/enquiryStatus';
import {
  VISIT_LOCATION_OPTIONS,
  HEARING_AID_STATUS_OPTIONS,
  TRIAL_RESULT_OPTIONS,
  MEDICAL_SERVICE_SLUGS,
} from '@/components/enquiries/enquiryFormFieldOptions';
import {
  PAYMENT_FOR_OPTIONS,
  PAYMENT_MODE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  ENQUIRY_TYPE_OPTIONS,
} from '@/components/enquiries/enquiryFilterSchema';

const withOrder = (rows: { optionValue: string; optionLabel: string }[]) =>
  rows.map((r, i) => ({ ...r, sortOrder: (i + 1) * 10 }));

export interface EnquiryOptionFieldDef {
  /** Firestore `fieldKey` */
  fieldKey: string;
  /** Shown in Settings */
  displayName: string;
  /** Where this appears (forms, filters, detail, etc.) */
  usedIn: string;
  defaults: ReturnType<typeof withOrder>;
}

export interface EnquiryOptionCategory {
  id: string;
  title: string;
  subtitle?: string;
  fields: EnquiryOptionFieldDef[];
}

const visitorTypeDefaults = withOrder([
  { optionValue: 'patient', optionLabel: 'Patient' },
  { optionValue: 'general', optionLabel: 'General' },
]);

const medicalServiceLabels: Record<string, string> = {
  hearing_test: 'Hearing test',
  hearing_aid_trial: 'Hearing aid trial',
  hearing_aid_booked: 'Hearing aid booked',
  hearing_aid_sale: 'Hearing aid sale',
  hearing_aid: 'Hearing aid',
  accessory: 'Accessory',
  programming: 'Programming',
  repair: 'Repair',
  counselling: 'Counselling',
};

export const ENQUIRIES_OPTION_CATEGORIES: EnquiryOptionCategory[] = [
  {
    id: 'enquiry-core',
    title: 'Enquiry profile',
    subtitle: 'Lead details, type, and journey',
    fields: [
      {
        fieldKey: 'reference',
        displayName: 'Reference / lead source',
        usedIn:
          'Simplified Enquiry Form (multi-select), legacy multi-step wizard (single Reference), Enquiries list → advanced filters.',
        defaults: withOrder(ENQUIRY_REFERENCE_OPTIONS.map((v) => ({ optionValue: v, optionLabel: v }))),
      },
      {
        fieldKey: 'enquiry_type',
        displayName: 'Enquiry type',
        usedIn: 'Advanced filters (Enquiry type); can be extended to forms.',
        defaults: withOrder(
          ENQUIRY_TYPE_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
      {
        fieldKey: 'visitor_type',
        displayName: 'Visitor type',
        usedIn: 'Advanced filters (Visitor type).',
        defaults: visitorTypeDefaults,
      },
      {
        fieldKey: 'journey_status_override',
        displayName: 'Journey tag (manual override)',
        usedIn:
          'Optional tag from the enquiries list or profile chip. Saving the enquiry form clears this so visits + lead outcome apply again.',
        defaults: withOrder(
          ENQUIRY_STATUS_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
    ],
  },
  {
    id: 'centers-legacy',
    title: 'Center & visit (legacy wizard)',
    subtitle: 'Older enquiry wizard on the Enquiries page',
    fields: [
      {
        fieldKey: 'visiting_center',
        displayName: 'Visiting center',
        usedIn: 'Legacy multi-step wizard — Visiting Center (main / branch keys).',
        defaults: withOrder([
          { optionValue: 'main', optionLabel: 'Main Center' },
          { optionValue: 'north', optionLabel: 'North Branch' },
          { optionValue: 'south', optionLabel: 'South Branch' },
          { optionValue: 'east', optionLabel: 'East Branch' },
          { optionValue: 'west', optionLabel: 'West Branch' },
        ]),
      },
      {
        fieldKey: 'patient_root_visit_status',
        displayName: 'Patient visit status (enquiry root)',
        usedIn: 'Legacy wizard — Patient Visit Status on the enquiry record.',
        defaults: withOrder([
          { optionValue: 'enquiry', optionLabel: 'Enquiry Only' },
          { optionValue: 'scheduled', optionLabel: 'Visit Scheduled' },
          { optionValue: 'visited', optionLabel: 'Patient Visited' },
          { optionValue: 'completed', optionLabel: 'Treatment Completed' },
        ]),
      },
      {
        fieldKey: 'legacy_visit_purpose',
        displayName: 'Visit purpose / type (scheduled visit)',
        usedIn: 'Legacy wizard — scheduling a visit (consultation, test, trial, etc.).',
        defaults: withOrder([
          { optionValue: 'consultation', optionLabel: 'General Consultation' },
          { optionValue: 'test', optionLabel: 'Hearing Test' },
          { optionValue: 'trial', optionLabel: 'Device Trial' },
          { optionValue: 'fitting', optionLabel: 'Device Fitting' },
          { optionValue: 'followup', optionLabel: 'Follow-up Visit' },
        ]),
      },
      {
        fieldKey: 'legacy_scheduled_visit_status',
        displayName: 'Scheduled visit status',
        usedIn: 'Legacy wizard — status for a scheduled visit row.',
        defaults: withOrder([
          { optionValue: 'scheduled', optionLabel: 'Scheduled' },
          { optionValue: 'completed', optionLabel: 'Completed' },
          { optionValue: 'cancelled', optionLabel: 'Cancelled' },
          { optionValue: 'no-show', optionLabel: 'No Show' },
        ]),
      },
      {
        fieldKey: 'hearing_test_type',
        displayName: 'Hearing test type',
        usedIn: 'Legacy wizard — test type dropdown (PTA, BERA, etc.).',
        defaults: withOrder([
          { optionValue: 'PTA', optionLabel: 'PTA' },
          { optionValue: 'Impedance', optionLabel: 'Impedance' },
          { optionValue: 'BERA', optionLabel: 'BERA' },
          { optionValue: 'ASSR', optionLabel: 'ASSR' },
          { optionValue: 'OAE', optionLabel: 'OAE' },
          { optionValue: 'Aided audiometry', optionLabel: 'Aided audiometry' },
          { optionValue: 'Impedence', optionLabel: 'Impedance (legacy spelling)' },
          { optionValue: 'Others', optionLabel: 'Others' },
          { optionValue: 'Speech Discrimination test', optionLabel: 'Speech Discrimination test' },
          { optionValue: 'Free Field Audiometry', optionLabel: 'Free Field Audiometry' },
          { optionValue: 'BOA', optionLabel: 'BOA' },
        ]),
      },
    ],
  },
  {
    id: 'hearing-aid-wizard',
    title: 'Hearing aid (legacy wizard card)',
    subtitle: 'Quick configuration on the multi-step form',
    fields: [
      {
        fieldKey: 'hearing_aid_details_status',
        displayName: 'Hearing aid details — pipeline status',
        usedIn: 'Legacy wizard — Hearing Aid Details → Status.',
        defaults: withOrder([
          { optionValue: 'enquiry', optionLabel: 'Enquiry' },
          { optionValue: 'quotation_sent', optionLabel: 'Quotation Sent' },
          { optionValue: 'trial_scheduled', optionLabel: 'Trial Scheduled' },
          { optionValue: 'trial_ongoing', optionLabel: 'Trial Ongoing' },
          { optionValue: 'trial_completed', optionLabel: 'Trial Completed' },
          { optionValue: 'purchased', optionLabel: 'Purchased' },
          { optionValue: 'fitted', optionLabel: 'Fitted' },
          { optionValue: 'delivered', optionLabel: 'Delivered' },
        ]),
      },
      {
        fieldKey: 'priority',
        displayName: 'Priority',
        usedIn: 'Legacy wizard — Hearing Aid Details → Priority.',
        defaults: withOrder([
          { optionValue: 'low', optionLabel: 'Low' },
          { optionValue: 'medium', optionLabel: 'Medium' },
          { optionValue: 'high', optionLabel: 'High' },
        ]),
      },
    ],
  },
  {
    id: 'simplified-form-visits',
    title: 'Simplified enquiry form — visits & trials',
    subtitle: 'Main enquiry form used from the Enquiries page',
    fields: [
      {
        fieldKey: 'visit_location',
        displayName: 'Visit location',
        usedIn: 'Simplified form — center vs home on visits / schedules.',
        defaults: withOrder(
          VISIT_LOCATION_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
      {
        fieldKey: 'visit_hearing_aid_status',
        displayName: 'Visit — hearing aid / trial status',
        usedIn: 'Simplified form — hearing aid status on a visit (trial given, booked, sold, …).',
        defaults: withOrder(
          HEARING_AID_STATUS_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
      {
        fieldKey: 'trial_result',
        displayName: 'Trial result',
        usedIn: 'Simplified form — trial outcome on a visit.',
        defaults: withOrder(
          TRIAL_RESULT_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
      {
        fieldKey: 'trial_location_type',
        displayName: 'Trial location (in-office vs home)',
        usedIn: 'Simplified form — where the trial happens.',
        defaults: withOrder([
          { optionValue: 'in_office', optionLabel: 'In-Office Trial' },
          { optionValue: 'home', optionLabel: 'Home Trial' },
        ]),
      },
      {
        fieldKey: 'ear_side',
        displayName: 'Ear side',
        usedIn: 'Simplified form — Left / Right / Both for trials and devices.',
        defaults: withOrder([
          { optionValue: 'left', optionLabel: 'Left' },
          { optionValue: 'right', optionLabel: 'Right' },
          { optionValue: 'both', optionLabel: 'Both' },
        ]),
      },
      {
        fieldKey: 'device_return_condition',
        displayName: 'Device return condition',
        usedIn: 'Simplified form — trial return / device condition rating.',
        defaults: withOrder([
          { optionValue: 'excellent', optionLabel: 'Excellent - Like New' },
          { optionValue: 'good', optionLabel: 'Good - Minor wear' },
          { optionValue: 'fair', optionLabel: 'Fair - Some damage' },
          { optionValue: 'poor', optionLabel: 'Poor - Significant damage' },
        ]),
      },
      {
        fieldKey: 'simplified_service_line',
        displayName: 'Service line (intake)',
        usedIn: 'Simplified form — counselling / speech / general enquiry style options.',
        defaults: withOrder([
          { optionValue: 'counselling', optionLabel: 'Hearing Aid Counselling' },
          { optionValue: 'speech_therapy', optionLabel: 'Speech Therapy' },
          { optionValue: 'general_enquiry', optionLabel: 'General Enquiry' },
        ]),
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments on enquiry',
    subtitle: 'Payment rows stored on the enquiry',
    fields: [
      {
        fieldKey: 'payment_for',
        displayName: 'Payment for',
        usedIn: 'Simplified form — payment type; advanced filters (Has payment for).',
        defaults: withOrder(
          PAYMENT_FOR_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
      {
        fieldKey: 'payment_mode',
        displayName: 'Payment mode',
        usedIn: 'Simplified form — Cash, Card, UPI, etc.; advanced filters (Has payment mode).',
        defaults: withOrder(
          PAYMENT_MODE_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
      {
        fieldKey: 'enquiry_financial_payment_status',
        displayName: 'Financial summary — payment status',
        usedIn: 'Advanced filters — financialSummary.paymentStatus (fully paid / pending).',
        defaults: withOrder(
          PAYMENT_STATUS_OPTIONS.map((o) => ({ optionValue: o.value, optionLabel: o.label }))
        ),
      },
    ],
  },
  {
    id: 'filters-services',
    title: 'Filters & medical services',
    subtitle: 'List filters and service slugs',
    fields: [
      {
        fieldKey: 'medical_service_slugs',
        displayName: 'Medical services (slugs)',
        usedIn:
          'Active form types / medical services chips — values are stored as slugs (hearing_test, hearing_aid, …).',
        defaults: withOrder(
          MEDICAL_SERVICE_SLUGS.map((slug) => ({
            optionValue: slug,
            optionLabel: medicalServiceLabels[slug] || slug,
          }))
        ),
      },
    ],
  },
];

export const ENQUIRY_FIELD_KEYS: string[] = Array.from(
  new Set(ENQUIRIES_OPTION_CATEGORIES.flatMap((c) => c.fields.map((f) => f.fieldKey)))
);

export function getEnquiryFieldDef(fieldKey: string): EnquiryOptionFieldDef | undefined {
  for (const c of ENQUIRIES_OPTION_CATEGORIES) {
    const f = c.fields.find((x) => x.fieldKey === fieldKey);
    if (f) return f;
  }
  return undefined;
}
