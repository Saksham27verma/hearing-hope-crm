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

/**
 * Seed / default `users` displayName values (see scripts/seed-database.js) — not real people
 * and must not appear as telecaller dropdown choices.
 */
const GENERIC_LOGIN_DISPLAY_NAMES = new Set(
  ['staff user', 'admin user', 'audiologist user'].map((s) => s)
);

export function isGenericLoginDisplayName(name: string | null | undefined): boolean {
  const t = String(name || '').trim().toLowerCase();
  return GENERIC_LOGIN_DISPLAY_NAMES.has(t);
}

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

/** Names already on the enquiry so dropdowns stay correct even if staff query is empty. */
export function collectTelecallerExtrasFromEnquiry(
  enquiry: {
    telecaller?: string;
    assignedTo?: string;
    followUps?: { callerName?: string }[];
  } | null | undefined
): string[] {
  if (!enquiry) return [];
  const out: string[] = [];
  const add = (s: string | undefined | null) => {
    const t = String(s || '').trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(enquiry.telecaller);
  add(enquiry.assignedTo);
  (enquiry.followUps || []).forEach((f) => add(f?.callerName));
  return out;
}

/**
 * All unique active staff names (sorted), plus any extra names (e.g. enquiry telecaller not in staff).
 * Use for Telecalling Records "log call" so every Manager, Telecaller, and other active staff appear.
 */
export function getAllActiveStaffDisplayNames(
  staffList: StaffRecord[],
  extraNames: (string | null | undefined)[] = []
): string[] {
  const active = staffList.filter((s) => (s.status || 'active') === 'active');
  const fromStaff = active
    .map((s) => String(s.name || '').trim())
    .filter((n) => n && !isGenericLoginDisplayName(n));
  const uniqueStaff = [...new Set(fromStaff)].sort((a, b) => a.localeCompare(b));
  const extras = extraNames
    .map((n) => String(n || '').trim())
    .filter((n) => n && !isGenericLoginDisplayName(n));
  const out = [...uniqueStaff];
  extras.forEach((n) => {
    if (!out.includes(n)) out.unshift(n);
  });
  return out;
}

/** Display names for the telecaller / "call done by" select (same rules as enquiry form). */
export function getTelecallerSelectOptions(
  staffList: StaffRecord[],
  selectedRoles: Record<string, string[]> = readEnquiryStaffRolesFromStorage(),
  extraNames: (string | null | undefined)[] = []
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
  const extras = extraNames
    .map((n) => String(n || '').trim())
    .filter((n) => n && !isGenericLoginDisplayName(n));
  extras.forEach((n) => {
    if (!names.includes(n)) names.unshift(n);
  });
  return names;
}

/** Prefer signed-in display name, then enquiry telecaller, then first option. */
export function pickDefaultTelecallerName(
  options: string[],
  prefs: { displayName?: string | null; enquiryTelecaller?: string | null }
): string {
  const dnRaw = prefs.displayName?.trim() || '';
  const dn = isGenericLoginDisplayName(dnRaw) ? '' : dnRaw;
  if (dn && (options.length === 0 || options.includes(dn))) return dn;
  const etc = prefs.enquiryTelecaller?.trim() || '';
  if (etc && (options.length === 0 || options.includes(etc))) return etc;
  return options[0] || etc || '';
}
