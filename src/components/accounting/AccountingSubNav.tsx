'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Paper, Tabs, Tab, Box } from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Payments as PaymentsIcon,
  MenuBook as LedgerIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

const TABS = [
  { path: '/accounting/dashboard', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { path: '/accounting/clients', label: 'Clients', icon: <PersonIcon fontSize="small" /> },
  { path: '/accounting/invoices', label: 'Invoices', icon: <ReceiptIcon fontSize="small" /> },
  { path: '/accounting/payments', label: 'Payments', icon: <PaymentsIcon fontSize="small" /> },
  { path: '/accounting/ledger', label: 'Ledger', icon: <LedgerIcon fontSize="small" /> },
  { path: '/accounting/settings', label: 'Settings', icon: <SettingsIcon fontSize="small" /> },
];

export default function AccountingSubNav() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const active = TABS.findIndex((t) => pathname.startsWith(t.path));

  return (
    <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
      <Box sx={{ overflowX: 'auto' }}>
        <Tabs
          value={active === -1 ? false : active}
          onChange={(_, v) => router.push(TABS[v].path)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 44 }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.path}
              icon={t.icon}
              iconPosition="start"
              label={t.label}
              sx={{ minHeight: 44, textTransform: 'none' }}
            />
          ))}
        </Tabs>
      </Box>
    </Paper>
  );
}
