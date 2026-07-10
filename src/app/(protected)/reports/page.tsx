'use client';

import React, { useEffect, useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import {
  TrendingUp as SalesIcon,
  Receipt as ReceiptIcon,
  PendingActions as PendingActionsIcon,
  BookmarkAdded as BookmarkAddedIcon,
  Analytics as AnalyticsIcon,
  PhoneCallback as PhoneCallbackIcon,
  MonetizationOn as ProfitIcon,
  ShoppingBag as TopProductsIcon,
} from '@mui/icons-material';

import InProcessEnquiriesReportTab from '@/components/Reports/InProcessEnquiriesReportTab';
import BookedEnquiriesReportTab from '@/components/Reports/BookedEnquiriesReportTab';
import SalesReportsTab from '@/components/Reports/SalesReportsTab';
import TopProductsReportTab from '@/components/Reports/TopProductsReportTab';
import AssignToReportTab from '@/components/Reports/AssignToReportTab';
import ExecutiveAnalysisReportTab from '@/components/Reports/ExecutiveAnalysisReportTab';
import TelecallersAnalysisReportTab from '@/components/Reports/TelecallersAnalysisReportTab';
import ProfitReportTab from '@/components/Reports/ProfitReportTab';
import { useAuth } from '@/context/AuthContext';
import { isSuperAdminViewer } from '@/lib/tenant/centerScope';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
      style={{ padding: '16px 0' }}
    >
      {value === index && (
        <Box>{children}</Box>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [tabValue, setTabValue] = useState(0);
  const { userProfile } = useAuth();
  const showProfitTab = isSuperAdminViewer(userProfile);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const tabs = [
    {
      key: 'in-process',
      label: 'In-process & follow-up',
      icon: <PendingActionsIcon />,
      content: <InProcessEnquiriesReportTab />,
    },
    {
      key: 'booked',
      label: 'Booked Report',
      icon: <BookmarkAddedIcon />,
      content: <BookedEnquiriesReportTab />,
    },
    {
      key: 'sales',
      label: 'Sales Report',
      icon: <SalesIcon />,
      content: <SalesReportsTab />,
    },
    {
      key: 'top-products',
      label: 'Top Products',
      icon: <TopProductsIcon />,
      content: <TopProductsReportTab />,
    },
    {
      key: 'assign-to',
      label: 'Assign To Report',
      icon: <ReceiptIcon />,
      content: <AssignToReportTab />,
    },
    {
      key: 'executive-analysis',
      label: 'Executive Analysis',
      icon: <AnalyticsIcon />,
      content: <ExecutiveAnalysisReportTab />,
    },
    {
      key: 'telecallers-analysis',
      label: 'Telecallers Analysis',
      icon: <PhoneCallbackIcon />,
      content: <TelecallersAnalysisReportTab />,
    },
    ...(showProfitTab
      ? [
          {
            key: 'profit-analysis',
            label: 'Profit Analysis',
            icon: <ProfitIcon />,
            content: <ProfitReportTab />,
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (tabValue >= tabs.length) setTabValue(0);
  }, [tabValue, tabs.length]);

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="report tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} label={tab.label} icon={tab.icon} iconPosition="start" />
          ))}
        </Tabs>
      </Box>

      {tabs.map((tab, index) => (
        <TabPanel key={tab.key} value={tabValue} index={index}>
          {tab.content}
        </TabPanel>
      ))}
    </Box>
  );
}
