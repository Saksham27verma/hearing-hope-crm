/** Maps URL segments to human-readable CRM labels for breadcrumbs. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  inventory: 'Inventory',
  'purchase-management': 'Purchases',
  'material-in': 'Material In',
  'material-out': 'Material Out',
  'distribution-sales': 'Distribution Sales',
  sales: 'Sales & Invoicing',
  'invoice-manager': 'Invoice Manager',
  parties: 'Parties',
  centers: 'Centers',
  companies: 'Companies',
  interaction: 'Interaction',
  visitors: 'Visitors',
  enquiries: 'Enquiries',
  'telecalling-records': 'Telecalling Records',
  'stock-transfer': 'Stock Transfer',
  'cash-register': 'Cash Register',
  appointments: 'Appointment Scheduler',
  reports: 'Reports',
  staff: 'Staff',
  'loans-advances': 'Loans & Advances',
  settings: 'Settings',
  'password-management': 'Password Management',
  'admin-cleanup': 'Admin Cleanup',
  new: 'New',
  edit: 'Edit',
};

function titleCaseSegment(segment: string): string {
  return segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export type Crumb = { href: string; label: string };

export function getCrmBreadcrumbs(pathname: string | null): Crumb[] {
  if (!pathname || pathname === '/') {
    return [
      { href: '/dashboard', label: 'Home' },
      { href: '/dashboard', label: 'Dashboard' },
    ];
  }

  const segments = pathname.split('/').filter(Boolean);
  const items: Crumb[] = [{ href: '/dashboard', label: 'Home' }];

  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    const label = SEGMENT_LABELS[seg] ?? titleCaseSegment(seg);
    items.push({ href: acc, label });
  }

  return items;
}
