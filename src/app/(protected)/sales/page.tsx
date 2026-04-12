'use client';

import React, { useMemo } from 'react';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import { createSalesInvoicingTheme } from '@/lib/sales-invoicing/salesInvoicingTheme';
import SalesInvoicingPageInner from '@/components/sales-invoicing/SalesInvoicingPageInner';

export default function SalesPage() {
  const baseTheme = useTheme();
  const salesTheme = useMemo(() => createSalesInvoicingTheme(baseTheme), [baseTheme]);

  return (
    <ThemeProvider theme={salesTheme}>
      <SalesInvoicingPageInner />
    </ThemeProvider>
  );
}
