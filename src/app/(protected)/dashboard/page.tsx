'use client';

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { 
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  AttachMoney as MoneyIcon,
  Assignment as AssignmentIcon,
  Store as StoreIcon,
  SwapHoriz as TransferIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  EventAvailable as EventAvailableIcon,
  BookmarkAdded as BookmarkAddedIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useCenterScope } from '@/hooks/useCenterScope';
import {
  appointmentMatchesDataScope,
  enquiryMatchesDataScope,
  isGlobalDataScope,
  saleMatchesDataScope,
  stockTransferMatchesDataScope,
} from '@/lib/tenant/centerScope';
import { useRouter } from 'next/navigation';
import { alpha, useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import SvgIcon from '@mui/material/SvgIcon';
import AdminDashboardInsights from '@/components/dashboard/AdminDashboardInsights';
import {
  getBookingAdvancePaidDateKey,
  getEnquiryVisitSchedules,
  isBookingVisitRow,
} from '@/utils/bookingAdvancePaidDate';
// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Format date
const formatDate = (timestamp: Timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

function getLocalDayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getTimeOfDayKey(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function getGreetingLine(displayName: string): string {
  const key = getTimeOfDayKey();
  const name = displayName || 'there';
  if (key === 'morning') return `Good morning, ${name} 👋`;
  if (key === 'afternoon') return `Good afternoon, ${name} 👋`;
  return `Good evening, ${name} 👋`;
}

/** Local calendar YYYY-MM-DD (avoid UTC drift vs payment date keys). */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateKeyEnIn(key: string): string {
  const parts = key.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return key;
  const [y, mo, da] = parts;
  return new Date(y, mo - 1, da).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function pulseCardSxFromTheme(theme: Theme) {
  const p = theme.palette.primary.main;
  return {
    border: '1px solid',
    borderColor: alpha(p, 0.22),
    borderRadius: 2,
    overflow: 'hidden',
    bgcolor: alpha(p, theme.palette.mode === 'light' ? 0.12 : 0.2),
    height: '100%',
    boxShadow:
      theme.palette.mode === 'light'
        ? '0 1px 2px rgba(15, 23, 42, 0.04)'
        : '0 1px 2px rgba(0, 0, 0, 0.35)',
    borderLeft: '3px solid',
    borderLeftColor: p,
    transition: 'background-color 0.28s ease, border-color 0.28s ease',
  } as const;
}

/** Minimal pill for dates / status (Today's Pulse tables). */
function pulsePillSxFromTheme(theme: Theme) {
  return {
    display: 'inline-block',
    bgcolor: theme.palette.mode === 'light' ? theme.palette.grey[100] : alpha(theme.palette.common.white, 0.08),
    color: 'text.secondary',
    fontSize: '10px',
    lineHeight: 1.35,
    px: 0.75,
    py: 0.125,
    borderRadius: 1,
    fontWeight: 600,
  } as const;
}

function pulseRowSxFromTheme(theme: Theme) {
  return {
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    '&:hover': { bgcolor: 'action.hover' },
    '& td': { py: 0.75, borderColor: 'divider', color: 'text.primary' },
  } as const;
}

function pulseHeadCellSxFromTheme(theme: Theme) {
  return {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: 'text.secondary',
    py: 0.5,
    px: 1,
    borderBottom: '1px solid',
    borderColor: 'divider',
    bgcolor:
      theme.palette.mode === 'light'
        ? alpha(theme.palette.common.white, 0.72)
        : alpha(theme.palette.common.white, 0.05),
  } as const;
}

const pulseTableContainerSx = {
  bgcolor: (t: Theme) =>
    t.palette.mode === 'light' ? alpha(t.palette.common.white, 0.55) : alpha(t.palette.common.white, 0.03),
} as const;

const pulseBodyTypographySx = {
  fontSize: '0.75rem',
  lineHeight: 1.35,
} as const;

const EMERALD = '#059669';

type StatStripItem = {
  title: string;
  value: React.ReactNode;
  color: string;
  icon: typeof SvgIcon;
  path: string;
};

/** Ultra-compact single-row stat strip (Vercel/Stripe-style): one surface, vertical hairlines, micro icons. */
function DashboardStatStrip({ items }: { items: StatStripItem[] }) {
  const router = useRouter();
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: (t) =>
          t.palette.mode === 'dark' ? alpha(t.palette.divider, 0.8) : 'rgba(226, 232, 240, 0.75)',
        borderRadius: 1.5,
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        bgcolor: (t) => (t.palette.mode === 'dark' ? t.palette.background.paper : '#FFFFFF'),
        overflow: 'hidden',
        mb: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'action.disabledBackground',
            borderRadius: 2,
          },
        }}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <Box
              key={`${item.title}-${index}`}
              onClick={() => router.push(item.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(item.path);
                }
              }}
              sx={{
                flex: '1 1 0',
                minWidth: { xs: 104, sm: 112, md: 0 },
                maxWidth: { xs: 'none', md: 'none' },
                py: 1,
                px: 1.5,
                cursor: 'pointer',
                borderLeft:
                  index === 0
                    ? 'none'
                    : (t) =>
                        `1px solid ${
                          t.palette.mode === 'dark' ? alpha(t.palette.divider, 0.5) : 'rgba(243, 244, 246, 1)'
                        }`,
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  bgcolor: (t) =>
                    t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : 'rgba(249, 250, 251, 0.9)',
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 0,
                  minWidth: 0,
                }}
              >
                <Icon
                  sx={{
                    fontSize: 16,
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                    color: item.color,
                  }}
                />
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    lineHeight: 1.1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.title}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  mt: 0,
                }}
              >
                {item.value}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export default function DashboardPage() {
  const { user, userProfile } = useAuth();
  const { effectiveScopeCenterId, allowedCenterIds } = useCenterScope();
  const router = useRouter();
  const theme = useTheme();
  const pulseCardSx = pulseCardSxFromTheme(theme);
  const pulseHeadCellSx = pulseHeadCellSxFromTheme(theme);
  const pulsePillSx = pulsePillSxFromTheme(theme);
  const pulseRowSx = pulseRowSxFromTheme(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalEnquiries: 0,
    totalSales: 0,
    monthlySales: 0,
    monthlyRevenue: 0,
    totalInventory: 0,
    totalStockTransfers: 0,
  });
  const [todaysSales, setTodaysSales] = useState<any[]>([]);
  const [todaysEnquiries, setTodaysEnquiries] = useState<any[]>([]);
  const [todaysTransfers, setTodaysTransfers] = useState<any[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<any[]>([]);
  const [todaysBookingAdvances, setTodaysBookingAdvances] = useState<any[]>([]);
  /** Audiologist-only pending audiogram list (reuses enquiry state name in that branch). */
  const [recentEnquiries, setRecentEnquiries] = useState<any[]>([]);
  /** Bumps child insights when user hits Refresh (see AdminDashboardInsights). */
  const [insightsRefresh, setInsightsRefresh] = useState(0);

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // For audiologists, only fetch enquiries data
      if (userProfile?.role === 'audiologist') {
        // Recent enquiries - For audiologists, filter to only show enquiries with hearing test but no audiogram
        const allEnquiriesSnapshot = await getDocs(collection(db, 'enquiries'));
        const recentEnquiriesData = allEnquiriesSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter((enquiry: any) =>
            enquiryMatchesDataScope(enquiry as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds),
          )
          .filter((enquiry: any) => {
            // Must have visitSchedules
            if (!enquiry.visitSchedules || !Array.isArray(enquiry.visitSchedules) || enquiry.visitSchedules.length === 0) {
              return false;
            }
            
            // Check if ANY visit has hearing test service selected
            const hasHearingTest = enquiry.visitSchedules.some((visit: any) => {
              // Check if medicalServices array includes 'hearing_test'
              if (visit.medicalServices && Array.isArray(visit.medicalServices)) {
                return visit.medicalServices.includes('hearing_test');
              }
              // Check if medicalService is 'hearing_test' (legacy field)
              if (visit.medicalService === 'hearing_test') {
                return true;
              }
              return false;
            });
            
            if (!hasHearingTest) {
              return false;
            }
            
            // Hearing test is “complete” if in-CRM audiogram exists OR an external PTA report is linked
            const hasAudiogramOrExternalPta = enquiry.visitSchedules.some((visit: any) => {
              const h = visit.hearingTestDetails;
              if (!h) return false;
              return Boolean(h.audiogramData || h.externalPtaReport?.viewUrl);
            });

            return !hasAudiogramOrExternalPta;
          })
          .sort((a: any, b: any) => {
            // Sort by createdAt descending
            const dateA = a.createdAt?.seconds || a.createdAt?._seconds || 0;
            const dateB = b.createdAt?.seconds || b.createdAt?._seconds || 0;
            return dateB - dateA;
          })
          .slice(0, 20); // Show up to 20 pending audiograms
        
        setRecentEnquiries(recentEnquiriesData);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Get counts in parallel for non-audiologist users
      const [
        productsSnapshot,
        enquiriesSnapshot,
        salesSnapshot,
        inventorySnapshot,
        transfersSnapshot,
        appointmentsSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'enquiries')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'inventory')),
        getDocs(collection(db, 'stockTransfers')),
        getDocs(collection(db, 'appointments')),
      ]);
      
      // Calculate monthly data (current month)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayTimestamp = Timestamp.fromDate(firstDayOfMonth);
      
      const monthlySalesQuery = query(
        collection(db, 'sales'),
        where('saleDate', '>=', firstDayTimestamp)
      );
      const monthlySalesSnapshot = await getDocs(monthlySalesQuery);

      let monthlyRevenue = 0;
      monthlySalesSnapshot.forEach((doc) => {
        const saleData = doc.data() as Record<string, unknown>;
        if (!saleMatchesDataScope(saleData, effectiveScopeCenterId, allowedCenterIds)) return;
        monthlyRevenue += Number(saleData.totalAmount) || 0;
      });

      const { start: dayStart, end: dayEnd } = getLocalDayBounds();
      const tDay0 = dayStart.getTime();
      const tDay1 = dayEnd.getTime();

      const tsToMs = (ts: unknown): number | null => {
        if (!ts) return null;
        const t = ts as Timestamp & { seconds?: number };
        if (typeof t.toMillis === 'function') return t.toMillis();
        if (typeof t.seconds === 'number') return t.seconds * 1000;
        return null;
      };

      const inLocalDay = (ms: number | null) => ms != null && ms >= tDay0 && ms <= tDay1;

      const todaysSalesData = salesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string }))
        .filter((row) => saleMatchesDataScope(row as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds))
        .filter((row) => inLocalDay(tsToMs(row.saleDate)))
        .sort((a, b) => (tsToMs(b.saleDate) || 0) - (tsToMs(a.saleDate) || 0))
        .slice(0, 12);

      const todaysEnquiriesData = enquiriesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string }))
        .filter((row) => enquiryMatchesDataScope(row as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds))
        .filter((row) => inLocalDay(tsToMs(row.createdAt)))
        .sort((a, b) => (tsToMs(b.createdAt) || 0) - (tsToMs(a.createdAt) || 0))
        .slice(0, 12);

      const todaysTransfersData = transfersSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string }))
        .filter((row) => stockTransferMatchesDataScope(row as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds))
        .filter((row) => inLocalDay(tsToMs(row.transferDate)))
        .sort((a, b) => (tsToMs(b.transferDate) || 0) - (tsToMs(a.transferDate) || 0))
        .slice(0, 12);

      const todaysAppointmentsData = appointmentsSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((appt: any) => appointmentMatchesDataScope(appt as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds))
        .filter((appt: any) => {
          if (!appt.start) return false;
          const t = new Date(appt.start).getTime();
          return t >= tDay0 && t <= tDay1;
        })
        .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 12);

      const todayKey = localDateKey(new Date());
      const todaysBookingAdvancesData: {
        enquiryId: string;
        patientName: string;
        advance: number;
        visitId: string;
        paidDateKey: string;
      }[] = [];
      enquiriesSnapshot.docs.forEach((doc) => {
        const e = { id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string };
        if (!enquiryMatchesDataScope(e, effectiveScopeCenterId, allowedCenterIds)) return;
        const visits = getEnquiryVisitSchedules(e);
        for (const visit of visits) {
          if (!isBookingVisitRow(visit)) continue;
          const ha = visit.hearingAidDetails as Record<string, unknown> | undefined;
          const advance =
            Number(visit.bookingAdvanceAmount ?? ha?.bookingAdvanceAmount ?? 0) || 0;
          if (advance <= 0) continue;
          const paidKey = getBookingAdvancePaidDateKey(e, visit);
          if (!paidKey || paidKey !== todayKey) continue;
          const visitId = String(visit.id ?? '');
          todaysBookingAdvancesData.push({
            enquiryId: doc.id,
            patientName: String(e.name ?? '—'),
            advance,
            visitId,
            paidDateKey: paidKey,
          });
        }
      });
      todaysBookingAdvancesData.sort((a, b) => b.advance - a.advance);
      if (todaysBookingAdvancesData.length > 12) {
        todaysBookingAdvancesData.length = 12;
      }
      
      const scopeActive = !isGlobalDataScope(effectiveScopeCenterId, allowedCenterIds);
      const enquiriesRows = enquiriesSnapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => enquiryMatchesDataScope(row as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds));
      const salesRows = salesSnapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => saleMatchesDataScope(row as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds));
      const monthlySalesScoped = monthlySalesSnapshot.docs.filter((d) =>
        saleMatchesDataScope(d.data() as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds),
      ).length;
      /** In-stock rows: sum units like the inventory list; legacy rows may omit status (treat as in stock if not sold/reserved). */
      const isInventoryRowInStock = (row: Record<string, unknown>) => {
        const s = row.status;
        if (s === 'Sold' || s === 'Reserved' || s === 'Damaged') return false;
        if (s === 'In Stock') return true;
        if (s === undefined || s === null || s === '') return true;
        return false;
      };
      const inventoryRowUnits = (row: Record<string, unknown>) => {
        const q = Number(row.quantity);
        if (Number.isFinite(q) && q > 0) return q;
        return 1;
      };
      const inventoryDataRows = inventorySnapshot.docs.map((d) => d.data() as Record<string, unknown>);
      /** Org-wide in-stock units (all centers / companies). Scope filter is not applied — matches expectation vs per-center strip confusion. */
      const totalInventoryUnits = inventoryDataRows
        .filter((row) => isInventoryRowInStock(row))
        .reduce((sum, row) => sum + inventoryRowUnits(row), 0);
      const transfersRows = transfersSnapshot.docs.filter((d) =>
        stockTransferMatchesDataScope(d.data() as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds),
      );

      setStats({
        totalProducts: productsSnapshot.size,
        totalEnquiries: scopeActive ? enquiriesRows.length : enquiriesSnapshot.size,
        totalSales: scopeActive ? salesRows.length : salesSnapshot.size,
        monthlySales: scopeActive ? monthlySalesScoped : monthlySalesSnapshot.size,
        monthlyRevenue,
        totalInventory: totalInventoryUnits,
        totalStockTransfers: scopeActive ? transfersRows.length : transfersSnapshot.size,
      });
      
      setTodaysSales(todaysSalesData);
      setTodaysEnquiries(todaysEnquiriesData);
      setTodaysTransfers(todaysTransfersData);
      setTodaysAppointments(todaysAppointmentsData);
      setTodaysBookingAdvances(todaysBookingAdvancesData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (isRefresh) {
        setInsightsRefresh((x) => x + 1);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, userProfile?.role, effectiveScopeCenterId, allowedCenterIds]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  // For audiologists, show custom dashboard with only pending audiogram enquiries
  if (userProfile?.role === 'audiologist') {
    return (
      <Box
        sx={{
          bgcolor: (t) => (t.palette.mode === 'dark' ? t.palette.background.default : '#F8F9FA'),
          minHeight: '100%',
          width: '100%',
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.5, sm: 2 },
          pb: 3,
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
              Pending Audiogram Entries
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enquiries requiring hearing test data entry
            </Typography>
          </Box>
          <Tooltip title="Refresh Data">
            <IconButton 
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              sx={{ 
                bgcolor: 'primary.50',
                '&:hover': { bgcolor: 'primary.100' }
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {refreshing && (
          <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />
        )}

        {/* Pending Audiogram Enquiries Table */}
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              p: 2.5,
              bgcolor: 'primary.50',
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                <AssignmentIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Enquiries Pending Audiogram
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {recentEnquiries.length} {recentEnquiries.length === 1 ? 'enquiry' : 'enquiries'} waiting for data entry
                </Typography>
              </Box>
            </Box>
            <Button
              variant="text"
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={() => router.push('/interaction/enquiries')}
            >
              View All
            </Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead sx={{ bgcolor: (t) => (t.palette.mode === 'light' ? t.palette.grey[50] : alpha(t.palette.common.white, 0.04)) }}>
                <TableRow>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell><strong>Patient Name</strong></TableCell>
                  <TableCell><strong>Visit Date</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="right"><strong>Action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentEnquiries.length > 0 ? (
                  recentEnquiries.map((enquiry: any) => {
                    // Find the visit with hearing test
                    const hearingTestVisit = enquiry.visitSchedules?.find((visit: any) => {
                      if (visit.medicalServices && Array.isArray(visit.medicalServices)) {
                        return visit.medicalServices.includes('hearing_test');
                      }
                      return visit.medicalService === 'hearing_test';
                    });
                    
                    return (
                      <TableRow
                        key={enquiry.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/interaction/enquiries/edit/${enquiry.id}`)}
                      >
                        <TableCell>
                          <Chip
                            label={formatDate(enquiry.createdAt)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {enquiry.name || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {hearingTestVisit?.visitDate ? new Date(hearingTestVisit.visitDate).toLocaleDateString('en-IN') : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label="Pending"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="contained"
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/interaction/enquiries/edit/${enquiry.id}`);
                            }}
                          >
                            Add Audiogram
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <AssignmentIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.5 }} />
                        <Typography variant="h6" color="text.secondary">
                          No Pending Audiograms
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          All enquiries with hearing test service have audiogram data entered.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  }

  /** Single strip (admin: 6 metrics; no Parties/Centers). */
  const statStripItems: StatStripItem[] =
    userProfile?.role === 'staff'
      ? [
          {
            title: 'Products',
            value: stats.totalProducts,
            icon: InventoryIcon,
            color: '#ff6b35',
            path: '/products',
          },
          {
            title: 'Enquiries',
            value: stats.totalEnquiries,
            icon: PeopleIcon,
            color: '#2196f3',
            path: '/interaction/enquiries',
          },
          {
            title: 'All in stock',
            value: stats.totalInventory,
            icon: StoreIcon,
            color: '#9c27b0',
            path: '/inventory',
          },
          {
            title: 'Stock Transfers',
            value: stats.totalStockTransfers,
            icon: TransferIcon,
            color: '#00bcd4',
            path: '/stock-transfer',
          },
        ]
      : [
          {
            title: 'Products',
            value: stats.totalProducts,
            icon: InventoryIcon,
            color: '#ff6b35',
            path: '/products',
          },
          {
            title: 'Enquiries',
            value: stats.totalEnquiries,
            icon: PeopleIcon,
            color: '#2196f3',
            path: '/interaction/enquiries',
          },
          {
            title: 'Total Sales',
            value: stats.totalSales,
            icon: ReceiptIcon,
            color: '#4caf50',
            path: '/sales',
          },
          {
            title: 'Monthly Revenue',
            value: formatCurrency(stats.monthlyRevenue),
            icon: MoneyIcon,
            color: '#ff9800',
            path: '/reports',
          },
          {
            title: 'All in stock',
            value: stats.totalInventory,
            icon: StoreIcon,
            color: '#9c27b0',
            path: '/inventory',
          },
          {
            title: 'Stock Transfers',
            value: stats.totalStockTransfers,
            icon: TransferIcon,
            color: '#00bcd4',
            path: '/stock-transfer',
          },
        ];

  return (
    <Box
      sx={{
        bgcolor: (t) => (t.palette.mode === 'dark' ? t.palette.background.default : '#F8F9FA'),
        minHeight: '100%',
        width: '100%',
        px: { xs: 1.5, sm: 2 },
        py: { xs: 1.5, sm: 2 },
        pb: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '1.375rem', sm: '1.5rem' },
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: '-0.02em',
              lineHeight: 1.35,
            }}
          >
            {getGreetingLine(
              (userProfile?.nickname?.trim() ||
                userProfile?.displayName?.trim() ||
                user?.displayName?.trim() ||
                user?.email?.split('@')[0] ||
                'there') as string,
            )}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, fontSize: '0.875rem' }}>
            Your workspace at a glance — scoped to your current data view.
          </Typography>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            size="small"
            sx={{
              bgcolor: 'action.hover',
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.selected' },
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {refreshing && (
        <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />
      )}

      {/* Unified stat strip — single surface, hairline dividers, horizontal scroll on narrow viewports */}
      <DashboardStatStrip items={statStripItems} />

      {/* Admin: month center sales + booked pipeline */}
      {userProfile && !['staff', 'audiologist'].includes(userProfile.role) && (
        <AdminDashboardInsights refreshSignal={insightsRefresh} />
      )}

      {/* Today's Pulse */}
      <Box
        sx={{
          borderRadius: 3,
          p: { xs: 1.5, sm: 2 },
          mb: 3,
          boxShadow: (t) =>
            `0 0 0 1px ${alpha(t.palette.primary.main, 0.2)}, 0 0 16px ${alpha(
              t.palette.primary.main,
              0.1,
            )}, 0 4px 14px ${alpha(t.palette.text.primary, t.palette.mode === 'light' ? 0.06 : 0.12)}`,
          border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.2)}`,
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.35) : 'rgba(255,255,255,0.94)',
          transition: 'background-color 0.28s ease, border-color 0.28s ease, box-shadow 0.28s ease',
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'text.primary',
              letterSpacing: '-0.01em',
            }}
          >
            Today&apos;s Pulse
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, fontSize: '0.8125rem' }}>
            Sales, enquiries, transfers, booking advances collected today, and appointments scheduled for today
            (local time) — respects your data scope.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(5, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
        {/* Today's Sales */}
        <Paper elevation={0} sx={pulseCardSx}>
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                Today&apos;s Sales
              </Typography>
            </Box>
            <Tooltip title="View all">
              <IconButton
                size="small"
                onClick={() => router.push('/sales')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="View all sales"
              >
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <TableContainer sx={pulseTableContainerSx}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '28%' }}>Date</TableCell>
                  <TableCell sx={pulseHeadCellSx}>Customer</TableCell>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '30%' }} align="right">
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todaysSales.length > 0 ? (
                  todaysSales.map((sale: any) => (
                    <TableRow key={sale.id} onClick={() => router.push('/sales')} sx={pulseRowSx}>
                      <TableCell>
                        <Box component="span" sx={pulsePillSx}>
                          {formatDate(sale.saleDate)}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Tooltip title={sale.customerName || '—'} placement="top-start">
                          <Typography fontWeight={500} noWrap sx={pulseBodyTypographySx}>
                            {sale.customerName || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          fontWeight={600}
                          sx={{
                            ...pulseBodyTypographySx,
                            fontVariantNumeric: 'tabular-nums',
                            color: EMERALD,
                          }}
                        >
                          {formatCurrency(sale.totalAmount || 0)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No sales today
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Today's Enquiries */}
        <Paper elevation={0} sx={pulseCardSx}>
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                Today&apos;s Enquiries
              </Typography>
            </Box>
            <Tooltip title="View all">
              <IconButton
                size="small"
                onClick={() => router.push('/interaction/enquiries')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="View all enquiries"
              >
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <TableContainer sx={pulseTableContainerSx}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '28%' }}>Date</TableCell>
                  <TableCell sx={pulseHeadCellSx}>Name</TableCell>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '32%' }}>Phone</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todaysEnquiries.length > 0 ? (
                  todaysEnquiries.map((enquiry: any) => (
                    <TableRow
                      key={enquiry.id}
                      onClick={() => router.push(`/interaction/enquiries/${enquiry.id}`)}
                      sx={pulseRowSx}
                    >
                      <TableCell>
                        <Box component="span" sx={pulsePillSx}>
                          {formatDate(enquiry.createdAt)}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Tooltip title={enquiry.name || '—'} placement="top-start">
                          <Typography fontWeight={500} noWrap sx={pulseBodyTypographySx}>
                            {enquiry.name || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Tooltip title={enquiry.phone || '—'} placement="top-start">
                          <Typography color="text.secondary" noWrap sx={pulseBodyTypographySx}>
                            {enquiry.phone || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No enquiries today
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Today's Transfers */}
        <Paper elevation={0} sx={pulseCardSx}>
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TransferIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                Today&apos;s Transfers
              </Typography>
            </Box>
            <Tooltip title="View all">
              <IconButton
                size="small"
                onClick={() => router.push('/stock-transfer')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="View all transfers"
              >
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <TableContainer sx={pulseTableContainerSx}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '28%' }}>Date</TableCell>
                  <TableCell sx={pulseHeadCellSx}>Transfer #</TableCell>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '22%' }}>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todaysTransfers.length > 0 ? (
                  todaysTransfers.map((transfer: any) => (
                    <TableRow key={transfer.id} onClick={() => router.push('/stock-transfer')} sx={pulseRowSx}>
                      <TableCell>
                        <Box component="span" sx={pulsePillSx}>
                          {formatDate(transfer.transferDate)}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Tooltip title={transfer.transferNumber || '—'} placement="top-start">
                          <Typography fontWeight={500} noWrap sx={pulseBodyTypographySx}>
                            {transfer.transferNumber || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box component="span" sx={pulsePillSx}>
                          {transfer.transferType === 'intracompany' ? 'Intra' : 'Inter'}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        No transfers today
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Today's booking advances (paid today) */}
        <Paper elevation={0} sx={pulseCardSx}>
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BookmarkAddedIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                Today&apos;s booking advances
              </Typography>
            </Box>
            <Tooltip title="Booked enquiries report">
              <IconButton
                size="small"
                onClick={() => router.push('/reports')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="Open reports"
              >
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <TableContainer sx={pulseTableContainerSx}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={pulseHeadCellSx}>Patient</TableCell>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '34%' }} align="right">
                    Advance
                  </TableCell>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '28%' }}>Paid</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todaysBookingAdvances.length > 0 ? (
                  todaysBookingAdvances.map((row: any) => (
                    <TableRow
                      key={`${row.enquiryId}-${row.visitId || row.paidDateKey}`}
                      onClick={() => router.push(`/interaction/enquiries/${row.enquiryId}`)}
                      sx={pulseRowSx}
                    >
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Tooltip title={row.patientName || '—'} placement="top-start">
                          <Typography fontWeight={500} noWrap sx={pulseBodyTypographySx}>
                            {row.patientName || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          fontWeight={600}
                          sx={{
                            ...pulseBodyTypographySx,
                            fontVariantNumeric: 'tabular-nums',
                            color: EMERALD,
                          }}
                        >
                          {formatCurrency(row.advance || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box component="span" sx={pulsePillSx}>
                          {formatDateKeyEnIn(row.paidDateKey)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary" sx={pulseBodyTypographySx}>
                        No booking advances recorded today
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Today's appointments (scheduled today) */}
        <Paper elevation={0} sx={pulseCardSx}>
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventAvailableIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                Today&apos;s appointments
              </Typography>
            </Box>
            <Tooltip title="View all">
              <IconButton
                size="small"
                onClick={() => router.push('/appointments')}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                aria-label="View all appointments"
              >
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <TableContainer sx={pulseTableContainerSx}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '36%' }}>Time</TableCell>
                  <TableCell sx={pulseHeadCellSx}>Patient</TableCell>
                  <TableCell sx={{ ...pulseHeadCellSx, width: '22%' }}>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {todaysAppointments.length > 0 ? (
                  todaysAppointments.map((appt: any) => (
                    <TableRow key={appt.id} onClick={() => router.push('/appointments')} sx={pulseRowSx}>
                      <TableCell>
                        <Typography fontWeight={500} sx={{ ...pulseBodyTypographySx, fontVariantNumeric: 'tabular-nums' }}>
                          {appt.start
                            ? new Date(appt.start).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 0 }}>
                        <Tooltip title={appt.patientName || appt.title || '—'} placement="top-start">
                          <Typography fontWeight={500} noWrap sx={pulseBodyTypographySx}>
                            {appt.patientName || appt.title || '—'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Box component="span" sx={pulsePillSx}>
                          {appt.type === 'home' ? 'Home' : 'Center'}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary" sx={pulseBodyTypographySx}>
                        No appointments today
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        </Box>
      </Box>
    </Box>
  );
}
