'use client';

/**
 * Admin dashboard: current-month center-wise sales bar chart + booked-pipeline summary.
 * Respects center data scope (same helpers as main dashboard).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Grid,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import BarChartIcon from '@mui/icons-material/BarChart';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useCenterScope } from '@/hooks/useCenterScope';
import { enquiryMatchesDataScope, saleMatchesDataScope } from '@/lib/tenant/centerScope';
import { getEnquiryStatusMeta } from '@/utils/enquiryStatus';
import { fetchAllCenters } from '@/utils/centerUtils';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRouter } from 'next/navigation';
import { CRM_ACCENT, CRM_ORANGE_GHOST } from '@/components/Layout/crm-theme';

/** Softer than sidebar outline — matches Today’s Pulse chrome. */
const INSIGHTS_PANEL_SHADOW =
  '0 0 0 1px rgba(241, 115, 54, 0.16), 0 0 14px rgba(241, 115, 54, 0.07), 0 4px 14px rgba(15, 23, 42, 0.05)';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);

const formatAxisInr = (n: number) => {
  if (!Number.isFinite(n)) return '0';
  const v = Math.abs(n);
  if (v >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(Math.round(n));
};

function saleGrandTotal(s: Record<string, unknown>): number {
  const g = s.grandTotal;
  if (typeof g === 'number' && !Number.isNaN(g) && g > 0) return g;
  return (Number(s.totalAmount) || 0) + (Number(s.gstAmount) || 0);
}

/** Same as Sales report: MRP-weighted discount on product lines. */
function aggregateDiscountFromProductLines(products: unknown[] | undefined): {
  mrpSum: number;
  discountSum: number;
} {
  let mrpSum = 0;
  let discountSum = 0;
  if (!Array.isArray(products)) return { mrpSum, discountSum };
  for (const raw of products) {
    const p = raw as Record<string, unknown>;
    const mrp = Number(p.mrp) || 0;
    if (mrp <= 0) continue;
    const selling = Number(p.sellingPrice ?? p.finalAmount ?? 0) || 0;
    const explicit = Number(p.discount);
    let off = 0;
    if (Number.isFinite(explicit) && explicit >= 0) {
      off = Math.min(explicit, mrp);
    } else {
      const dp = Number(p.discountPercent);
      if (Number.isFinite(dp) && dp >= 0 && dp <= 100) {
        off = Math.min(mrp, (mrp * dp) / 100);
      } else {
        off = Math.max(0, mrp - selling);
      }
    }
    mrpSum += mrp;
    discountSum += off;
  }
  return { mrpSum, discountSum };
}

// —— Booked enquiry helpers (aligned with BookedEnquiriesReportTab) ——
function getSchedules(enquiry: any): any[] {
  if (Array.isArray(enquiry?.visitSchedules) && enquiry.visitSchedules.length > 0) {
    return enquiry.visitSchedules;
  }
  if (Array.isArray(enquiry?.visits) && enquiry.visits.length > 0) {
    return enquiry.visits;
  }
  return [];
}

function getVisitSortTime(visit: any): number {
  const candidates = [visit?.visitDate, visit?.date, visit?.bookingDate, visit?.trialStartDate];
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (Number.isFinite(t)) return t;
  }
  const ca = visit?.createdAt;
  if (ca && typeof ca.toMillis === 'function') return ca.toMillis();
  if (typeof ca?.seconds === 'number') return ca.seconds * 1000;
  return 0;
}

function isBookingVisit(visit: any): boolean {
  if (!visit || typeof visit !== 'object') return false;
  const ms = Array.isArray(visit.medicalServices) ? visit.medicalServices : [];
  const has = (code: string) => ms.includes(code);
  const hearingAidBooked = Boolean(visit.hearingAidBooked) || has('hearing_aid_booked');
  const hearingAidSale =
    Boolean(visit.hearingAidSale) || has('hearing_aid_sale') || has('hearing_aid');
  return hearingAidBooked && !hearingAidSale;
}

function extractBookingDetails(visit: any) {
  const ha =
    visit.hearingAidDetails && typeof visit.hearingAidDetails === 'object'
      ? visit.hearingAidDetails
      : {};
  const bookingQty = Math.max(1, Math.floor(Number(visit.bookingQuantity ?? 1)) || 1);
  const unitSelling =
    Number(
      visit.bookingSellingPrice ??
        ha.bookingSellingPrice ??
        ha.grossSalesBeforeTax ??
        0
    ) || 0;
  const bookingAdvance =
    Number(visit.bookingAdvanceAmount ?? ha.bookingAdvanceAmount ?? 0) || 0;
  return { bookingQty, unitSelling, bookingAdvance };
}

function pickLatestBookingVisit(schedules: any[]): any | null {
  const bookingVisits = schedules.filter(isBookingVisit);
  if (!bookingVisits.length) return null;
  const sorted = [...bookingVisits].sort((a, b) => getVisitSortTime(b) - getVisitSortTime(a));
  return sorted[0];
}

function isLiveBookedEnquiry(enquiry: any): boolean {
  const meta = getEnquiryStatusMeta(enquiry);
  if (meta.key === 'sold' || meta.key === 'not_interested') return false;
  if (String(enquiry?.status || '').toLowerCase() === 'inactive') return false;
  const schedules = getSchedules(enquiry);
  return pickLatestBookingVisit(schedules) != null;
}

type CenterRow = {
  label: string;
  subtotal: number;
  grandTotal: number;
  count: number;
  discountMrpBasis: number;
  discountOffMrp: number;
};

type MonthSalesKpis = {
  invoices: number;
  taxable: number;
  gst: number;
  grand: number;
  avgDiscountPct: number | null;
};

type BookedSummary = {
  bookings: number;
  sumSelling: number;
  sumAdvance: number;
};

export default function AdminDashboardInsights({ refreshSignal }: { refreshSignal: number }) {
  const theme = useTheme();
  const router = useRouter();
  const { effectiveScopeCenterId, allowedCenterIds } = useCenterScope();
  const [loading, setLoading] = useState(true);
  const [centerRows, setCenterRows] = useState<CenterRow[]>([]);
  const [booked, setBooked] = useState<BookedSummary | null>(null);
  const [monthLabel, setMonthLabel] = useState('');
  const [monthKpis, setMonthKpis] = useState<MonthSalesKpis | null>(null);
  const [allTimeGrandTotal, setAllTimeGrandTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      setMonthLabel(
        now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      );
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const [allSalesSnap, centersList, enquiriesSnap] = await Promise.all([
        getDocs(collection(db, 'sales')),
        fetchAllCenters(),
        getDocs(collection(db, 'enquiries')),
      ]);

      const idToName = new Map<string, string>();
      centersList.forEach((c: { id: string; name?: string }) => {
        idToName.set(c.id, (c.name || c.id).toString());
      });

      const byCenter = new Map<
        string,
        {
          label: string;
          subtotal: number;
          grandTotal: number;
          count: number;
          discountMrpBasis: number;
          discountOffMrp: number;
        }
      >();

      let allTimeInScope = 0;
      let monthTaxable = 0;
      let monthGst = 0;
      let monthGrand = 0;
      let monthInvoices = 0;
      let monthDiscBasis = 0;
      let monthDiscOff = 0;

      allSalesSnap.docs.forEach((docSnap) => {
        const s = docSnap.data() as Record<string, unknown>;
        if (s.cancelled) return;
        if (!saleMatchesDataScope(s, effectiveScopeCenterId, allowedCenterIds)) return;

        const gt = saleGrandTotal(s);
        const taxable = Number(s.totalAmount) || 0;
        const gst = Number(s.gstAmount) || 0;
        allTimeInScope += gt;

        const sd = s.saleDate as Timestamp | undefined;
        if (!sd || typeof sd.toDate !== 'function') return;
        const d = sd.toDate();
        if (d < start || d > end) return;

        monthTaxable += taxable;
        monthGst += gst;
        monthGrand += gt;
        monthInvoices += 1;
        const discAgg = aggregateDiscountFromProductLines(s.products as unknown[]);
        monthDiscBasis += discAgg.mrpSum;
        monthDiscOff += discAgg.discountSum;

        const cid = String(s.centerId || '').trim();
        const branch = String(s.branch || '').trim();
        const label =
          (cid && idToName.get(cid)) ||
          branch ||
          (cid ? cid : 'Unassigned');
        const key = cid || `__b:${branch.toLowerCase() || 'na'}`;

        const prev = byCenter.get(key) || {
          label,
          subtotal: 0,
          grandTotal: 0,
          count: 0,
          discountMrpBasis: 0,
          discountOffMrp: 0,
        };
        byCenter.set(key, {
          label: prev.label || label,
          subtotal: prev.subtotal + taxable,
          grandTotal: prev.grandTotal + gt,
          count: prev.count + 1,
          discountMrpBasis: prev.discountMrpBasis + discAgg.mrpSum,
          discountOffMrp: prev.discountOffMrp + discAgg.discountSum,
        });
      });

      const rows: CenterRow[] = Array.from(byCenter.values())
        .map((r) => ({
          label: r.label,
          subtotal: r.subtotal,
          grandTotal: r.grandTotal,
          count: r.count,
          discountMrpBasis: r.discountMrpBasis,
          discountOffMrp: r.discountOffMrp,
        }))
        .sort((a, b) => b.grandTotal - a.grandTotal);

      setCenterRows(rows);
      setAllTimeGrandTotal(allTimeInScope);
      setMonthKpis({
        invoices: monthInvoices,
        taxable: monthTaxable,
        gst: monthGst,
        grand: monthGrand,
        avgDiscountPct:
          monthDiscBasis > 0 ? (100 * monthDiscOff) / monthDiscBasis : null,
      });

      let bookings = 0;
      let sumSelling = 0;
      let sumAdvance = 0;

      enquiriesSnap.docs.forEach((d) => {
        const enquiry: any = { id: d.id, ...d.data() };
        if (!enquiryMatchesDataScope(enquiry as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds)) {
          return;
        }
        if (!isLiveBookedEnquiry(enquiry)) return;
        const bv = pickLatestBookingVisit(getSchedules(enquiry));
        if (!bv) return;
        const det = extractBookingDetails(bv);
        bookings += 1;
        sumSelling += det.unitSelling * det.bookingQty;
        sumAdvance += det.bookingAdvance;
      });

      setBooked({ bookings, sumSelling, sumAdvance });
    } catch (e) {
      console.error('AdminDashboardInsights:', e);
      setCenterRows([]);
      setBooked(null);
      setMonthKpis(null);
      setAllTimeGrandTotal(0);
    } finally {
      setLoading(false);
    }
  }, [effectiveScopeCenterId, allowedCenterIds, refreshSignal]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData = centerRows.map((r) => {
    const avgDiscountPct =
      r.discountMrpBasis > 0
        ? (100 * r.discountOffMrp) / r.discountMrpBasis
        : undefined;
    return {
      name: r.label.length > 18 ? `${r.label.slice(0, 16)}…` : r.label,
      nameFull: r.label,
      selling: r.subtotal,
      grandTotal: r.grandTotal,
      avgDiscountPct,
      count: r.count,
    };
  });

  const barFill = theme.palette.mode === 'dark' ? '#42a5f5' : '#1565c0';

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography
            variant="overline"
            sx={{ letterSpacing: 1.2, color: 'text.secondary', fontWeight: 700 }}
          >
            Performance
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
            Sales &amp; pipeline
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Current month ({monthLabel}) · scoped to your centers
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={() => router.push('/reports')}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Full reports
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={7}>
          <Paper
            elevation={0}
            sx={{
              height: '100%',
              minHeight: 380,
              borderRadius: 3,
              border: '1px solid rgba(241, 115, 54, 0.18)',
              borderLeft: '3px solid',
              borderLeftColor: CRM_ACCENT,
              overflow: 'hidden',
              background:
                theme.palette.mode === 'dark'
                  ? alpha(CRM_ACCENT, 0.07)
                  : `linear-gradient(145deg, #ffffff 0%, ${CRM_ORANGE_GHOST} 42%, #f8fafc 100%)`,
              boxShadow: theme.palette.mode === 'dark' ? 'none' : INSIGHTS_PANEL_SHADOW,
            }}
          >
            <Box
              sx={{
                px: 2.5,
                pt: 2.5,
                pb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(CRM_ACCENT, 0.14),
                  color: CRM_ACCENT,
                }}
              >
                <BarChartIcon fontSize="small" />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Center-wise sales (month)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Taxable (bars) + MRP-weighted avg. discount % (line) · voided excluded
                </Typography>
              </Box>
            </Box>
            {!loading && monthKpis ? (
              <Box
                sx={{
                  px: 2.5,
                  pb: 1.5,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.success.main, 0.08),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.success.main, 0.22),
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    All-time sales (scope)
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {formatCurrency(allTimeGrandTotal)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    This month · grand total
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {formatCurrency(monthKpis.grand)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Month · taxable
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {formatCurrency(monthKpis.taxable)}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Month · avg. disc. vs MRP
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="error.dark">
                    {monthKpis.avgDiscountPct != null
                      ? `${monthKpis.avgDiscountPct.toFixed(1)}%`
                      : '—'}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
                    Month · invoices
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {monthKpis.invoices}
                  </Typography>
                </Box>
              </Box>
            ) : null}
            <Box sx={{ px: 1, pb: 2, pt: 1, height: 340 }}>
              {loading ? (
                <Skeleton variant="rounded" height={320} sx={{ borderRadius: 2, mx: 1 }} />
              ) : chartData.length === 0 ? (
                <Box
                  sx={{
                    height: 280,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary',
                  }}
                >
                  <Typography variant="body2">No sales this month in scope.</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="dashCenterBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={barFill} stopOpacity={0.95} />
                        <stop offset="100%" stopColor={barFill} stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" vertical={false} stroke={alpha('#64748b', 0.25)} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                      tickLine={false}
                      axisLine={{ stroke: alpha('#64748b', 0.35) }}
                      interval={0}
                      angle={chartData.length > 5 ? -28 : 0}
                      textAnchor={chartData.length > 5 ? 'end' : 'middle'}
                      height={chartData.length > 5 ? 64 : 36}
                    />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      tickFormatter={formatAxisInr}
                      tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 'auto']}
                      tickFormatter={(v) => `${Math.round(v)}%`}
                      tick={{ fontSize: 11, fill: '#b71c1c' }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <RechartsTooltip
                      cursor={{ fill: alpha(theme.palette.primary.main, 0.06) }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as {
                          nameFull: string;
                          selling: number;
                          grandTotal: number;
                          avgDiscountPct?: number;
                          count: number;
                        };
                        const disc = p.avgDiscountPct;
                        return (
                          <Paper elevation={8} sx={{ px: 1.5, py: 1, borderRadius: 2, minWidth: 200 }}>
                            <Typography variant="caption" fontWeight={700} display="block">
                              {p.nameFull}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Invoices: {p.count}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                              Taxable (selling): {formatCurrency(p.selling)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Grand total: {formatCurrency(p.grandTotal)}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: 'error.dark' }}>
                              Avg. discount vs MRP:{' '}
                              {disc != null && Number.isFinite(disc) ? `${disc.toFixed(1)}%` : '—'}
                            </Typography>
                          </Paper>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 4, fontSize: 12 }} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avgDiscountPct"
                      name="Avg. discount % vs MRP"
                      stroke="#c62828"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#c62828', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6 }}
                      connectNulls
                      style={{ pointerEvents: 'none' }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="selling"
                      name="Taxable (selling)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill="url(#dashCenterBarGrad)" />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper
            elevation={0}
            sx={{
              height: '100%',
              minHeight: 380,
              borderRadius: 3,
              border: '1px solid rgba(241, 115, 54, 0.18)',
              borderLeft: '3px solid',
              borderLeftColor: CRM_ACCENT,
              overflow: 'hidden',
              background:
                theme.palette.mode === 'dark'
                  ? alpha(CRM_ACCENT, 0.06)
                  : `linear-gradient(160deg, #ffffff 0%, ${CRM_ORANGE_GHOST} 38%, #fffefb 100%)`,
              boxShadow: theme.palette.mode === 'dark' ? 'none' : INSIGHTS_PANEL_SHADOW,
            }}
          >
            <Box
              sx={{
                px: 2.5,
                pt: 2.5,
                pb: 2,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(CRM_ACCENT, 0.14),
                    color: CRM_ACCENT,
                  }}
                >
                  <BookmarkAddedIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Booked pipeline
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Active HA bookings (not sold / inactive) · same rules as Booked Report
                  </Typography>
                </Box>
              </Box>
              <Button
                size="small"
                variant="contained"
                disableElevation
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/reports')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              >
                Booked report
              </Button>
            </Box>

            <Box sx={{ p: 2.5 }}>
              {loading ? (
                <>
                  <Skeleton height={56} sx={{ mb: 2, borderRadius: 2 }} />
                  <Skeleton height={56} sx={{ mb: 2, borderRadius: 2 }} />
                  <Skeleton height={56} sx={{ borderRadius: 2 }} />
                </>
              ) : booked ? (
                <>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                      mb: 2.5,
                    }}
                  >
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.8),
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Active bookings
                      </Typography>
                      <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5 }}>
                        {booked.bookings}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.paper, 0.8),
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Advances collected
                      </Typography>
                      <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }} color="info.dark">
                        {formatCurrency(booked.sumAdvance)}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.06),
                      border: '1px solid',
                      borderColor: alpha(theme.palette.success.main, 0.25),
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Pipeline value (qty × unit selling)
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color="success.dark" sx={{ mt: 0.5 }}>
                      {formatCurrency(booked.sumSelling)}
                    </Typography>
                  </Box>
                  <Button
                    fullWidth
                    sx={{ mt: 2, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    variant="outlined"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => router.push('/reports')}
                  >
                    Open Booked Report
                  </Button>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Could not load booked summary.
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
