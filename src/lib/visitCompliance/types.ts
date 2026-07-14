/**
 * End-of-visit compliance fields stored on Firestore `appointments` documents.
 * Calendar `status` stays scheduled|completed|cancelled; compliance lifecycle uses `complianceStatus`.
 */

export type ComplianceStatus =
  | 'awaiting_telecaller_pin'
  | 'pending_verification'
  | 'incomplete_compliance'
  | 'completed';

export type ComplianceFormData = {
  wearingIdUniformBag: boolean;
  sharedPersonalContact: boolean;
  focHomeVisitsCommitted: number;
  freeBatteryBoxesCommitted: boolean;
  freeBatteryBoxesQty?: number | null;
  explainedAccessoriesCharges: boolean;
  explainedWarranty: boolean;
  connectedWithTelecaller: true;
};

export type GpsLocation = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  capturedAt: string;
};

export type ComplianceAdminOverride = {
  byUid: string;
  byName?: string;
  at: string;
  reason?: string;
};

/** Staged by staff before telecaller PIN — telecaller reviews this with the patient. */
export type CheckoutDraftServices = {
  hearingTest?: {
    hearingTestEntries: { id: string; testType: string; price: number }[];
    testDoneBy?: string;
    testResults?: string;
    recommendations?: string;
  };
  accessory?: {
    accessoryName: string;
    accessoryDetails?: string;
    accessoryFOC?: boolean;
    accessoryAmount?: number;
    accessoryQuantity?: number;
  };
  programming?: {
    programmingReason?: string;
    programmingAmount?: number;
    programmingDoneBy?: string;
    hearingAidName?: string;
    underWarranty?: boolean;
  };
  counselling?: { notes?: string };
  savedAt?: string;
};

export type CheckoutDraftCommerce = {
  receiptType: 'booking' | 'trial' | 'invoice';
  amount: number;
  paymentMode: 'cash' | 'upi' | 'card';
  details: Record<string, unknown>;
  summaryLines?: string[];
  savedAt?: string;
};

export type AppointmentCheckoutDraft = {
  services?: CheckoutDraftServices | null;
  servicesSkipped?: boolean;
  commerce?: CheckoutDraftCommerce | null;
  commerceSkipped?: boolean;
  gps_location?: GpsLocation | null;
  compliance_form_data?: ComplianceFormData | null;
  feedback?: string;
};

export type AppointmentComplianceFields = {
  telecaller_pin?: string | null;
  telecaller_pin_generated_at?: unknown;
  telecaller_pin_generated_by?: string | null;
  telecaller_verified?: boolean;
  telecaller_verified_at?: unknown;
  gps_location?: GpsLocation | null;
  compliance_form_data?: ComplianceFormData | null;
  complianceStatus?: ComplianceStatus | null;
  complianceIncompleteSince?: unknown;
  complianceAdminOverride?: ComplianceAdminOverride | null;
  complianceAlertSentAt?: unknown;
  /** Staff filled services / commerce / checklist before requesting PIN. */
  checkoutDraft?: AppointmentCheckoutDraft | null;
  checkoutReadyForPin?: boolean;
  checkoutDraftSavedAt?: unknown;
  checkoutDraftSavedBy?: string | null;
};

export const COMPLIANCE_INCOMPLETE_ALERT_HOURS = 2;
