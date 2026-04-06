'use client';

import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import {
  TrendingUp as SalesIcon,
  Receipt as ReceiptIcon,
  PendingActions as PendingActionsIcon,
  BookmarkAdded as BookmarkAddedIcon,
} from '@mui/icons-material';

import InProcessEnquiriesReportTab from '@/components/Reports/InProcessEnquiriesReportTab';
import BookedEnquiriesReportTab from '@/components/Reports/BookedEnquiriesReportTab';
import SalesReportsTab from '@/components/Reports/SalesReportsTab';
import AssignToReportTab from '@/components/Reports/AssignToReportTab';

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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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
          <Tab
            label="In-process & follow-up"
            icon={<PendingActionsIcon />}
            iconPosition="start"
          />
          <Tab label="Booked Report" icon={<BookmarkAddedIcon />} iconPosition="start" />
          <Tab label="Sales Report" icon={<SalesIcon />} iconPosition="start" />
          <Tab label="Assign To Report" icon={<ReceiptIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <InProcessEnquiriesReportTab />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <BookedEnquiriesReportTab />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <SalesReportsTab />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <AssignToReportTab />
      </TabPanel>
    </Box>
  );
}
