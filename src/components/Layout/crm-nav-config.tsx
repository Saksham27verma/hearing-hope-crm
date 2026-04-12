import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Headphones,
  Package,
  ShoppingCart,
  ArrowDownToLine,
  ArrowUpFromLine,
  Truck,
  CircleDollarSign,
  FileText,
  Handshake,
  Building2,
  Factory,
  Users,
  RefreshCw,
  CreditCard,
  CalendarDays,
  BarChart3,
  UserCog,
  Settings,
  UsersRound,
  Sparkles,
  ScrollText,
  TrendingUp,
  Activity,
} from 'lucide-react';

export interface NavChild {
  text: string;
  path: string;
}

export interface CrmNavItem {
  text: string;
  path: string;
  icon: LucideIcon;
  children?: NavChild[];
  adminOnly?: boolean;
  /** When true, visible only to users where `isSuperAdminViewer` is true */
  superAdminOnly?: boolean;
}

export const CRM_NAV_ITEMS: CrmNavItem[] = [
  { text: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { text: 'Products', path: '/products', icon: Headphones },
  { text: 'Inventory', path: '/inventory', icon: Package },
  { text: 'Purchases', path: '/purchase-management', icon: ShoppingCart },
  { text: 'Material In', path: '/material-in', icon: ArrowDownToLine },
  { text: 'Material Out', path: '/material-out', icon: ArrowUpFromLine },
  { text: 'Distribution Sales', path: '/distribution-sales', icon: Truck },
  { text: 'Sales & Invoicing', path: '/sales', icon: CircleDollarSign },
  { text: 'Receipts', path: '/receipts', icon: ScrollText },
  { text: 'Invoice Manager', path: '/invoice-manager', icon: FileText },
  { text: 'Parties', path: '/parties', icon: Handshake },
  { text: 'Centers', path: '/centers', icon: Building2 },
  { text: 'Companies', path: '/companies', icon: Factory, adminOnly: true },
  {
    text: 'Interaction',
    path: '/interaction',
    icon: Users,
    children: [
      { text: 'Visitors', path: '/interaction/visitors' },
      { text: 'Enquiries', path: '/interaction/enquiries' },
      { text: 'Telecalling Records', path: '/telecalling-records' },
    ],
  },
  { text: 'Stock Transfer', path: '/stock-transfer', icon: RefreshCw },
  { text: 'Cash Register', path: '/cash-register', icon: CreditCard },
  { text: 'Appointment Scheduler', path: '/appointments', icon: CalendarDays },
  { text: 'Reports', path: '/reports', icon: BarChart3 },
  { text: 'Profit', path: '/profit', icon: TrendingUp, adminOnly: true, superAdminOnly: true },
  {
    text: 'Staff',
    path: '/staff',
    icon: UserCog,
    adminOnly: true,
    children: [
      { text: 'Staff Management', path: '/staff' },
      { text: 'Loans & Advances', path: '/staff/loans-advances' },
    ],
  },
  { text: 'Settings', path: '/settings', icon: Settings, adminOnly: true },
  { text: 'User Management', path: '/user-management', icon: UsersRound, adminOnly: true },
  { text: 'Activity Logs', path: '/activity-logs', icon: Activity, adminOnly: true, superAdminOnly: true },
  { text: 'Admin Cleanup', path: '/admin-cleanup', icon: Sparkles, adminOnly: true },
];

/** Maps CRM nav item labels to access keys stored in `users/{uid}.allowedModules`. */
export const NAV_ITEM_ACCESS_KEYS: Record<string, string[]> = {
  Dashboard: ['dashboard'],
  Products: ['products'],
  Inventory: ['inventory'],
  Purchases: ['purchases'],
  'Material In': ['materials', 'material in'],
  'Material Out': ['deliveries', 'material out'],
  'Distribution Sales': ['distribution sales'],
  'Sales & Invoicing': ['sales'],
  Receipts: ['receipts'],
  'Invoice Manager': ['invoice manager'],
  Parties: ['parties'],
  Centers: ['centers'],
  Companies: ['companies'],
  Interaction: ['interaction'],
  'Stock Transfer': ['stock transfer', 'stock'],
  'Cash Register': ['cash register', 'cash'],
  'Appointment Scheduler': ['appointment scheduler', 'appointments'],
  Reports: ['reports'],
  Staff: ['staff'],
  Settings: ['settings'],
  'User Management': ['user management'],
  'Activity Logs': ['activity logs'],
  'Admin Cleanup': ['admin cleanup'],
};

/** Options for admin user-management UI (keys must align with `isAllowedModule` checks). */
export const CRM_MODULE_ACCESS_OPTIONS: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Products' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'materials', label: 'Material In' },
  { key: 'deliveries', label: 'Material Out' },
  { key: 'distribution sales', label: 'Distribution Sales' },
  { key: 'sales', label: 'Sales & Invoicing' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'invoice manager', label: 'Invoice Manager' },
  { key: 'parties', label: 'Parties' },
  { key: 'centers', label: 'Centers' },
  { key: 'companies', label: 'Companies' },
  { key: 'interaction', label: 'Interaction' },
  { key: 'stock transfer', label: 'Stock Transfer' },
  { key: 'cash register', label: 'Cash Register' },
  { key: 'appointment scheduler', label: 'Appointment Scheduler' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'reports', label: 'Reports' },
  { key: 'staff', label: 'Staff' },
  { key: 'settings', label: 'Settings' },
];

function navItemAllowedByKeys(
  item: CrmNavItem,
  allowedModules: string[],
): boolean {
  const lower = allowedModules.map((m) => m.toLowerCase().trim());
  if (lower.includes('*')) return true;
  const keys = NAV_ITEM_ACCESS_KEYS[item.text] ?? [item.text.toLowerCase()];
  return keys.some((k) => lower.includes(k));
}

export const STAFF_ALLOWED_MODULES = [
  'Dashboard',
  'Products',
  'Sales & Invoicing',
  'Receipts',
  'Interaction',
  'Stock Transfer',
  'Cash Register',
  'Appointment Scheduler',
  'Material In',
  'Material Out',
  'Inventory',
] as const;

export const AUDIOLOGIST_ALLOWED_MODULES = [
  'Dashboard',
  'Products',
  'Inventory',
  'Receipts',
  'Appointment Scheduler',
  'Interaction',
] as const;

export type UserRole = 'admin' | 'staff' | 'audiologist' | string;

/**
 * Returns nav items visible to the current user (same rules as legacy layout).
 * When `allowedModules` is set on the profile (non-empty, not `*`), it overrides the default role lists.
 */
export function filterCrmNavForUser(
  userProfile: { role: UserRole; allowedModules?: string[]; isSuperAdmin?: boolean } | null,
  isAllowedModule?: (moduleKey: string) => boolean,
): CrmNavItem[] {
  if (!userProfile) return [];

  const customMods = userProfile.allowedModules;
  const useCustomAccess =
    Array.isArray(customMods) &&
    customMods.length > 0 &&
    !customMods.map((m) => m.toLowerCase()).includes('*');

  const isSuperAdmin = userProfile.isSuperAdmin === true;

  return CRM_NAV_ITEMS.filter((item) => {
    if (item.adminOnly && userProfile.role !== 'admin') return false;
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (userProfile.role === 'staff') {
      if (useCustomAccess) {
        return navItemAllowedByKeys(item, customMods!);
      }
      return (STAFF_ALLOWED_MODULES as readonly string[]).includes(item.text);
    }
    if (userProfile.role === 'audiologist') {
      if (useCustomAccess) {
        return navItemAllowedByKeys(item, customMods!);
      }
      if (item.text === 'Interaction') return true;
      return (AUDIOLOGIST_ALLOWED_MODULES as readonly string[]).includes(item.text);
    }
    if (userProfile.role === 'admin') {
      return isAllowedModule?.(item.text.toLowerCase()) !== false;
    }
    return false;
  }).map((item) => {
    if (userProfile.role === 'audiologist' && item.text === 'Interaction' && item.children) {
      return {
        ...item,
        children: item.children.filter((c) => c.text === 'Enquiries'),
      };
    }
    return item;
  });
}
