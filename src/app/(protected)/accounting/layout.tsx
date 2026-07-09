'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Box } from '@mui/material';
import { AccountingCompanyProvider } from '@/context/AccountingCompanyContext';
import CompanyScopeBar from '@/components/accounting/CompanyScopeBar';
import AccountingSubNav from '@/components/accounting/AccountingSubNav';

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === '/accounting' || pathname === '/accounting/';

  return (
    <AccountingCompanyProvider>
      <Box>
        {!isLanding && (
          <>
            <CompanyScopeBar />
            <AccountingSubNav />
          </>
        )}
        {children}
      </Box>
    </AccountingCompanyProvider>
  );
}
