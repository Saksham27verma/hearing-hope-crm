'use client';

import SqueezeLoader from '@/components/ui/loading-indicator';
import { CRM_PAGE_BG } from '@/components/Layout/crm-theme';

/** Main column while a protected route segment loads — sidebar/header stay mounted. */
export default function ProtectedRouteLoading() {
  return (
    <SqueezeLoader
      fullscreen={false}
      backgroundColor={CRM_PAGE_BG}
      caption="Loading…"
      size={52}
      spinDuration={9}
      squeezeDuration={2.8}
    />
  );
}
