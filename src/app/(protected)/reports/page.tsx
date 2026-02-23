'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Divider,
  Container,
} from '@mui/material';
import {
  MonetizationOn as MonetizationOnIcon,
  TrendingUp as SalesIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import ProfitReportTab from '@/components/Reports/ProfitReportTab';
import StockPositionTab from '@/components/Reports/StockPositionTab';
import GSTReportTab from '@/components/Reports/GSTReportTab';
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
  const { enqueueSnackbar } = useSnackbar();
  
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
          <Tab label="Profit Analysis" icon={<MonetizationOnIcon />} iconPosition="start" />
          <Tab label="Sales Report" icon={<SalesIcon />} iconPosition="start" />
          <Tab label="Stock Position" icon={<InventoryIcon />} iconPosition="start" />
          <Tab label="GST Report" icon={<ReceiptIcon />} iconPosition="start" />
          <Tab label="Assign To Report" icon={<ReceiptIcon />} iconPosition="start" />
        </Tabs>
      </Box>
      
      {/* Profit Analysis Tab */}
      <TabPanel value={tabValue} index={0}>
        <ProfitReportTab />
      </TabPanel>
      
      {/* Sales Report Tab */}
      <TabPanel value={tabValue} index={1}>
        <SalesReportsTab />
      </TabPanel>
      
      {/* Stock Position Tab */}
      <TabPanel value={tabValue} index={2}>
        <StockPositionTab />
      </TabPanel>
      
      {/* GST Report Tab */}
      <TabPanel value={tabValue} index={3}>
        <GSTReportTab />
      </TabPanel>

      {/* Assign To Report Tab */}
      <TabPanel value={tabValue} index={4}>
        <AssignToReportTab />
      </TabPanel>
    </Box>
  );
} 