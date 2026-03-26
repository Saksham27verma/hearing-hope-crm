'use client';

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { salesInvoicingTheme } from '@/lib/sales-invoicing/salesInvoicingTheme';
import SalesInvoicingPageInner from '@/components/sales-invoicing/SalesInvoicingPageInner';

export default function SalesPage() {
  return (
    <ThemeProvider theme={salesInvoicingTheme}>
      <SalesInvoicingPageInner />
    </ThemeProvider>
  );
}
