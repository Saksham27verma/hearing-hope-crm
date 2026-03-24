/**
 * Telecaller dropdown options for enquiry follow-ups — matches SimplifiedEnquiryForm
 * (`getStaffOptionsForField('telecaller')` + localStorage `enquiryStaffRoles`).
 */

export const ENQUIRY_JOB_ROLES = [
  'Manager',
  'Audiologist',
  'Sales Executive',
  'Technician',
  'Receptionist',
  'Accountant',
  'Administrator',
  'Customer Support',
  'Marketing Executive',
  'Telecaller',
] as const;

export type StaffRecord = {
  id: string;
  name: string;
  jobRole: string;
  status?: string;
};

const DEFAULT_SELECTED_ROLES: Record<string, string[]> = {
  telecaller: ['Telecaller', 'Customer Support'],
  assignedTo: ['Manager', 'Sales Executive', 'Audiologist'],
  testBy: ['Audiologist', 'Technician'],
  programmingBy: ['Audiologist', 'Technician'],
  sales: ['Sales Executive', 'Manager'],
  general: [...ENQUIRY_JOB_ROLES],
};

/** Same fallback list as SimplifiedEnquiryForm when no active staff match roles. */
export const FALLBACK_TELECALLER_NAMES = [
  'Aditya',
  'Chirag',
  'Deepika',
  'Deepika Jain',
  'Manish',
  'Nisha',
  'Pankaj',
  'Priya',
  'Raghav',
  'Rohit',
  'Saksham',
  'Sanjana',
  'Siddharth',
  'Tushar',
  'Vikash',
];

export function readEnquiryStaffRolesFromStorage(): Record<string, string[]> {
  if (typeof window === 'undefined') return DEFAULT_SELECTED_ROLES;
  try {
    const saved = localStorage.getItem('enquiryStaffRoles');
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, string[]>;
      return { ...DEFAULT_SELECTED_ROLES, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SELECTED_ROLES;
}

export function groupActiveStaffByJobRole(staffList: StaffRecord[]): Record<string, StaffRecord[]> {
  const active = staffList.filter((s) => (s.status || 'active') === 'active');
  const grouped: Record<string, StaffRecord[]> = {};
  ENQUIRY_JOB_ROLES.forEach((role) => {
    grouped[role] = active.filter((s) => s.jobRole === role);
  });
  return grouped;
}

/** Display names for the telecaller / "call done by" select (same rules as enquiry form). */
export function getTelecallerSelectOptions(
  staffList: StaffRecord[],
  selectedRoles: Record<string, string[]> = readEnquiryStaffRolesFromStorage()
): string[] {
  const staffByRole = groupActiveStaffByJobRole(staffList);
  const allowedRoles = selectedRoles.telecaller || [];
  const names: string[] = [];
  allowedRoles.forEach((role) => {
    (staffByRole[role] || []).forEach((staff) => {
      if (staff.name && !names.includes(staff.name)) {
        names.push(staff.name);
      }
    });
  });
  return names.length > 0 ? names : [...FALLBACK_TELECALLER_NAMES];
}

/** Prefer signed-in display name, then enquiry telecaller, then first option. */
export function pickDefaultTelecallerName(
  options: string[],
  prefs: { displayName?: string | null; enquiryTelecaller?: string | null }
): string {
  const dn = prefs.displayName?.trim() || '';
  if (dn && options.includes(dn)) return dn;
  const etc = prefs.enquiryTelecaller?.trim() || '';
  if (etc && options.includes(etc)) return etc;
  return options[0] || '';
}
