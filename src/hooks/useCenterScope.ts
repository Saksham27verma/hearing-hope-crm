/**
 * Re-export for a stable import path across the CRM.
 * Provides multi-tenant center scoping: {@link CenterScopeContextValue}.
 */
export { useCenterScope, CenterScopeProvider } from '@/context/CenterScopeContext';
export type { CenterScopeContextValue } from '@/context/CenterScopeContext';
