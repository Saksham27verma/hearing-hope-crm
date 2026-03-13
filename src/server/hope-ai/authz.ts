import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import type { HopeAIAuthContext, HopeAIUserProfile } from './types';

function jsonAuthError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export async function requireHopeAIAuth(request: Request): Promise<HopeAIAuthContext> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw jsonAuthError('Missing Authorization bearer token', 401);

  const decoded = await adminAuth().verifyIdToken(match[1]);
  const db = adminDb();
  const userSnap = await db.collection('users').doc(decoded.uid).get();

  if (!userSnap.exists) {
    throw jsonAuthError('Not authorized to use Hope AI', 403);
  }

  const profile = userSnap.data() as HopeAIUserProfile;
  const allowedModules = Array.isArray(profile.allowedModules) ? profile.allowedModules : [];
  const isAdmin = profile.role === 'admin';

  return {
    uid: decoded.uid,
    email: decoded.email,
    profile,
    isAdmin,
    canAccessAllData: isAdmin,
    allowedModules,
    branchId: profile.branchId,
  };
}

export function assertHopeAIAdmin(context: HopeAIAuthContext) {
  if (!context.isAdmin) {
    throw jsonAuthError('Admin access required', 403);
  }
}

export function getAllowedDomains(context: HopeAIAuthContext): string[] {
  if (context.canAccessAllData) {
    return ['enquiries', 'products', 'sales', 'inventory', 'purchases', 'centers', 'parties', 'reports', 'stockTransfers'];
  }

  const modules = new Set((context.allowedModules || []).map(module => module.toLowerCase()));
  const domains = new Set<string>();

  if (modules.has('interaction')) domains.add('enquiries');
  if (modules.has('products')) domains.add('products');
  if (modules.has('sales')) domains.add('sales');
  if (modules.has('inventory') || modules.has('materials') || modules.has('stock')) domains.add('inventory');
  if (modules.has('purchases')) domains.add('purchases');
  if (modules.has('centers')) domains.add('centers');
  if (modules.has('parties')) domains.add('parties');
  if (modules.has('reports')) domains.add('reports');

  return Array.from(domains);
}
