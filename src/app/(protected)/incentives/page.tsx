'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  MonetizationOn as CoinsIcon,
  Phone as PhoneIcon,
  Bolt as BoltIcon,
  ReceiptLong as ReceiptIcon,
} from '@mui/icons-material';
import {
  Timestamp,
  collection,
  documentId,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useCenterScope } from '@/hooks/useCenterScope';
import { PRIMARY_ADMIN_EMAIL } from '@/components/Layout/crm-nav-config';
import { saleMatchesDataScope } from '@/lib/tenant/centerScope';
import { isSaleCancelled } from '@/lib/sales-invoicing/saleCancelled';
import {
  INCENTIVE_EMPLOYEES,
  computeIncentiveForSale,
  computeMonthlyTierIncentive,
  getIncentiveEmployee,
  parseSaleDate,
  resolveEffectiveSalespersonName,
  resolveSaleIncentiveAmount,
  saleMatchesEmployeeSalesperson,
  type EnquiryLike,
  type IncentiveResult,
  type MonthlyTier,
} from '@/lib/incentives/incentiveRules';

type SaleRow = {
  id: string;
  invoiceNumber?: string;
  patientName?: string;
  saleDate?: Timestamp;
  grandTotal?: number;
  totalAmount?: number;
  enquiryId?: string;
  centerId?: string;
  branch?: string;
  source?: string;
  cancelled?: boolean;
  salesperson?: { id?: string | null; name?: string | null } | null;
};

type Row = {
  sale: SaleRow;
  enquiry: EnquiryLike | null;
  result: IncentiveResult;
};

type MonthlyRow = {
  monthKey: string;
  monthLabel: string;
  monthTotal: number;
  salesCount: number;
  tier: MonthlyTier | null;
  rate: number;
  amount: number;
  sales: SaleRow[];
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (ts?: Timestamp | unknown) => {
  const d = parseSaleDate(ts);
  if (!d) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function firstDayOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function fetchEnquiriesByIds(ids: string[]): Promise<Map<string, EnquiryLike>> {
  const out = new Map<string, EnquiryLike>();
  if (ids.length === 0) return out;
  const unique = Array.from(new Set(ids.filter((x) => !!x)));
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const q = query(collection(db, 'enquiries'), where(documentId(), 'in', chunk));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      out.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as EnquiryLike);
    });
  }
  return out;
}

export default function IncentivesPage() {
  const router = useRouter();
  const theme = useTheme();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { effectiveScopeCenterId, allowedCenterIds } = useCenterScope();

  const [employeeId, setEmployeeId] = useState<string>(INCENTIVE_EMPLOYEES[0]?.id ?? '');
  const [dateFrom, setDateFrom] = useState<Date | null>(firstDayOfMonth());
  const [dateTo, setDateTo] = useState<Date | null>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [salesScanned, setSalesScanned] = useState(0);

  const employee = useMemo(() => getIncentiveEmployee(employeeId), [employeeId]);
  const isMonthlyTiered = !!employee?.monthlyTiered;
  const showSalespersonColumn = employee ? !employee.requiresEnquiry : false;
  const showCallRecordColumn = employee ? employee.requiresEnquiry : false;

  const isPrimaryAdmin =
    (userProfile?.email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isPrimaryAdmin) {
      router.replace('/dashboard');
    }
  }, [authLoading, user, isPrimaryAdmin, router]);

  const fetchData = React.useCallback(async () => {
    if (!employee || !dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);
    try {
      const startTs = Timestamp.fromDate(startOfDay(dateFrom));
      const endTs = Timestamp.fromDate(endOfDay(dateTo));
      const salesQ = query(
        collection(db, 'sales'),
        where('saleDate', '>=', startTs),
        where('saleDate', '<=', endTs),
        orderBy('saleDate', 'desc'),
      );
      const salesSnap = await getDocs(salesQ);

      const allSales = salesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as SaleRow[];
      const scopedSales = allSales.filter(
        (s) =>
          !isSaleCancelled(s) &&
          saleMatchesDataScope(s as Record<string, unknown>, effectiveScopeCenterId, allowedCenterIds) &&
          (employee.requiresEnquiry ? !!s.enquiryId : true),
      );
      setSalesScanned(scopedSales.length);

      // Always fetch linked enquiries when present — needed for call-record rules
      // and as a salesperson "Who Sold" fallback for Ashok / Bhavik / Bhawna.
      const enquiryIds = scopedSales
        .map((s) => s.enquiryId)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
      const enquiryMap = await fetchEnquiriesByIds(enquiryIds);

      if (employee.monthlyTiered) {
        const empSales = scopedSales.filter((s) => {
          const enquiry = s.enquiryId ? enquiryMap.get(s.enquiryId) ?? null : null;
          return saleMatchesEmployeeSalesperson(s, employee, enquiry);
        });
        const byMonth = new Map<string, { label: string; sales: SaleRow[]; total: number }>();
        for (const sale of empSales) {
          const d = parseSaleDate(sale.saleDate);
          if (!d) continue;
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
          const bucket = byMonth.get(monthKey) ?? { label, sales: [], total: 0 };
          bucket.sales.push(sale);
          bucket.total += resolveSaleIncentiveAmount(sale);
          byMonth.set(monthKey, bucket);
        }
        const monthKeys = Array.from(byMonth.keys()).sort().reverse();
        const monthly: MonthlyRow[] = [];
        const perSale: Row[] = [];
        for (const monthKey of monthKeys) {
          const bucket = byMonth.get(monthKey)!;
          const { tier, rate, amount } = computeMonthlyTierIncentive(
            bucket.total,
            employee.monthlyTiered.tiers,
          );
          monthly.push({
            monthKey,
            monthLabel: bucket.label,
            monthTotal: bucket.total,
            salesCount: bucket.sales.length,
            tier,
            rate,
            amount,
            sales: bucket.sales,
          });
          if (rate > 0) {
            for (const sale of bucket.sales) {
              const enquiry = sale.enquiryId ? enquiryMap.get(sale.enquiryId) ?? null : null;
              const saleTotal = resolveSaleIncentiveAmount(sale);
              const share = Math.round(saleTotal * rate);
              if (share > 0) {
                perSale.push({
                  sale,
                  enquiry,
                  result: {
                    amount: share,
                    ruleId: `monthly-tier-${tier?.threshold ?? 0}`,
                    ruleLabel: tier ? `${tier.label} (share of monthly)` : null,
                    hasCallRecord: false,
                    matchedCallerNames: [],
                    referenceValues: [],
                    matchesSalesperson: true,
                    matchedSalespersonName: resolveEffectiveSalespersonName(sale, enquiry) || null,
                    saleGrandTotal: saleTotal,
                  },
                });
              }
            }
          }
        }
        setMonthlyRows(monthly);
        setRows(perSale);
        setPage(0);
      } else {
        const computedRows: Row[] = [];
        for (const sale of scopedSales) {
          const enquiry = sale.enquiryId ? enquiryMap.get(sale.enquiryId) ?? null : null;
          const result = computeIncentiveForSale(sale, enquiry, employee);
          if (result.amount > 0) {
            computedRows.push({ sale, enquiry, result });
          }
        }
        setMonthlyRows([]);
        setRows(computedRows);
        setPage(0);
      }
    } catch (e) {
      console.error('Failed to load incentives:', e);
      setError(e instanceof Error ? e.message : 'Failed to load incentives');
      setRows([]);
      setMonthlyRows([]);
    } finally {
      setLoading(false);
    }
  }, [employee, dateFrom, dateTo, effectiveScopeCenterId, allowedCenterIds]);

  useEffect(() => {
    if (!isPrimaryAdmin) return;
    void fetchData();
  }, [isPrimaryAdmin, fetchData]);

  const totals = useMemo(() => {
    const byRule = new Map<string, { label: string; count: number; amount: number }>();
    if (isMonthlyTiered) {
      let total = 0;
      for (const m of monthlyRows) {
        total += m.amount;
        const key = m.tier?.label ?? 'below-threshold';
        const label = m.tier?.label ?? 'Below threshold — no incentive';
        const existing = byRule.get(key);
        if (existing) {
          existing.count += 1;
          existing.amount += m.amount;
        } else {
          byRule.set(key, { label, count: 1, amount: m.amount });
        }
      }
      return { total, byRule: Array.from(byRule.values()) };
    }
    let total = 0;
    for (const r of rows) {
      total += r.result.amount;
      const key = r.result.ruleId ?? 'unknown';
      const existing = byRule.get(key);
      if (existing) {
        existing.count += 1;
        existing.amount += r.result.amount;
      } else {
        byRule.set(key, { label: r.result.ruleLabel ?? 'Unknown rule', count: 1, amount: r.result.amount });
      }
    }
    return { total, byRule: Array.from(byRule.values()) };
  }, [rows, monthlyRows, isMonthlyTiered]);

  const paged = useMemo(
    () => rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [rows, page, rowsPerPage],
  );

  const handleExportCsv = () => {
    const lines: (string | number)[][] = [];
    if (isMonthlyTiered) {
      lines.push(['Month', 'Sales Count', 'Monthly Total (INR)', 'Tier Reached', 'Rate', 'Incentive (INR)']);
      for (const m of monthlyRows) {
        lines.push([
          m.monthLabel,
          m.salesCount,
          m.monthTotal,
          m.tier?.label ?? 'Below threshold',
          m.rate ? `${(m.rate * 100).toFixed(2)}%` : '0%',
          m.amount,
        ]);
      }
      lines.push(['', '', '', '', 'TOTAL', totals.total]);
      lines.push([]);
      lines.push(['— Per-sale breakdown (share of monthly incentive) —']);
    }
    lines.push([
      'Invoice #',
      'Sale Date',
      'Patient',
      'Salesperson',
      'Grand Total (INR)',
      'Reference',
      'Call Records (matched)',
      'Rule',
      'Amount (INR)',
    ]);
    for (const r of rows) {
      lines.push([
        r.sale.invoiceNumber || r.sale.id,
        formatDate(r.sale.saleDate),
        r.sale.patientName || '',
        r.result.matchedSalespersonName ||
          resolveEffectiveSalespersonName(r.sale, r.enquiry) ||
          '',
        r.result.saleGrandTotal,
        r.result.referenceValues.join(' | '),
        r.result.matchedCallerNames.join(' | '),
        r.result.ruleLabel || '',
        r.result.amount,
      ]);
    }
    if (!isMonthlyTiered) {
      lines.push(['', '', '', '', '', '', '', 'TOTAL', totals.total]);
    }
    const csv = lines.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `incentives_${employee?.id ?? 'employee'}_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (authLoading || !user) {
    return (
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isPrimaryAdmin) {
    return null;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: theme.palette.primary.main,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CoinsIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={700}>
                  Incentive Calculator
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Per-employee sales incentives: call-record based, salesperson based, or monthly-tiered. Visible only to the primary admin.
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={() => void fetchData()} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={handleExportCsv}
              disabled={rows.length === 0 || loading}
            >
              Export CSV
            </Button>
          </Stack>
        </Stack>

        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="incentive-employee-label">Employee</InputLabel>
                <Select
                  labelId="incentive-employee-label"
                  label="Employee"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(String(e.target.value))}
                >
                  {INCENTIVE_EMPLOYEES.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.displayName} — {emp.role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="From"
                value={dateFrom}
                onChange={(d) => setDateFrom(d)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <DatePicker
                label="To"
                value={dateTo}
                onChange={(d) => setDateTo(d)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="contained" onClick={() => void fetchData()} disabled={loading}>
                {loading ? 'Loading…' : 'Apply'}
              </Button>
            </Grid>
          </Grid>
          {employee && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {isMonthlyTiered
                  ? <>Monthly tiers for <b>{employee.displayName}</b> (rate applies to full monthly total once threshold is crossed):</>
                  : <>Active rules for <b>{employee.displayName}</b>:</>}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {isMonthlyTiered
                  ? employee.monthlyTiered!.tiers.map((t) => (
                      <Chip key={t.threshold} size="small" label={t.label} variant="outlined" color="primary" />
                    ))
                  : employee.rules.map((r) => (
                      <Chip key={r.id} size="small" label={r.label} variant="outlined" />
                    ))}
              </Stack>
            </Box>
          )}
        </Paper>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<CoinsIcon />}
              color={theme.palette.success.main}
              label="Total Incentive"
              value={formatCurrency(totals.total)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<BoltIcon />}
              color={theme.palette.warning.main}
              label={isMonthlyTiered ? 'Months in Range' : 'Earning Sales'}
              value={String(isMonthlyTiered ? monthlyRows.length : rows.length)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<ReceiptIcon />}
              color={theme.palette.primary.main}
              label={isMonthlyTiered ? 'Matched Sales' : 'Sales Scanned'}
              value={String(
                isMonthlyTiered
                  ? monthlyRows.reduce((n, m) => n + m.salesCount, 0)
                  : salesScanned,
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<PhoneIcon />}
              color={theme.palette.info.main}
              label="Active Rules"
              value={String(employee?.rules.length ?? 0)}
            />
          </Grid>
        </Grid>

        {totals.byRule.length > 0 && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Breakdown by rule
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {totals.byRule.map((b) => (
                <Chip
                  key={b.label}
                  size="small"
                  variant="outlined"
                  label={`${b.label} — ${b.count} sales · ${formatCurrency(b.amount)}`}
                />
              ))}
            </Stack>
          </Paper>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isMonthlyTiered && (
          <Paper sx={{ mb: 3 }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Monthly Incentive Summary
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Sales are grouped by calendar month (based on Sale Date). The tier reached in a month applies to that month's full total.
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Sales Count</TableCell>
                    <TableCell align="right">Monthly Total</TableCell>
                    <TableCell>Tier Reached</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Incentive</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : monthlyRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Typography color="text.secondary">
                          No sales matched for this employee in the selected range
                          {salesScanned > 0
                            ? ` (${salesScanned} sales scanned — check salesperson name on invoices).`
                            : '.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyRows.map((m) => (
                      <TableRow key={m.monthKey} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{m.monthLabel}</Typography>
                        </TableCell>
                        <TableCell align="right">{m.salesCount}</TableCell>
                        <TableCell align="right">{formatCurrency(m.monthTotal)}</TableCell>
                        <TableCell>
                          {m.tier ? (
                            <Chip size="small" color="primary" variant="filled" label={m.tier.label} />
                          ) : (
                            <Chip size="small" color="default" variant="outlined" label="Below threshold" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {m.rate ? `${(m.rate * 100).toFixed(2)}%` : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={formatCurrency(m.amount)}
                            color={m.amount > 0 ? 'success' : 'default'}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <Paper>
          {isMonthlyTiered && (
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Per-Sale Breakdown
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Each sale's share of that month's incentive (sale grand total × month's tier rate).
              </Typography>
            </Box>
          )}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Sale Date</TableCell>
                  <TableCell>Patient</TableCell>
                  {showSalespersonColumn && <TableCell>Salesperson</TableCell>}
                  {showSalespersonColumn && <TableCell align="right">Grand Total</TableCell>}
                  {showCallRecordColumn && <TableCell>Reference</TableCell>}
                  {showCallRecordColumn && <TableCell>Call Records (matched)</TableCell>}
                  <TableCell>Rule</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const colCount =
                    3 +
                    (showSalespersonColumn ? 2 : 0) +
                    (showCallRecordColumn ? 2 : 0) +
                    2;
                  if (loading) {
                    return (
                      <TableRow>
                        <TableCell colSpan={colCount} align="center" sx={{ py: 6 }}>
                          <CircularProgress size={28} />
                        </TableCell>
                      </TableRow>
                    );
                  }
                  if (paged.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={colCount} align="center" sx={{ py: 6 }}>
                          <Typography color="text.secondary">
                            No incentive-earning sales in this range.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return paged.map((r) => {
                    const isBoost = r.result.ruleId === 'reference-boost';
                    return (
                      <TableRow key={r.sale.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {r.sale.invoiceNumber || r.sale.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDate(r.sale.saleDate)}</TableCell>
                        <TableCell>{r.sale.patientName || '-'}</TableCell>
                        {showSalespersonColumn && (
                          <TableCell>
                            {r.result.matchedSalespersonName ? (
                              <Chip
                                size="small"
                                color="info"
                                variant="filled"
                                label={r.result.matchedSalespersonName}
                              />
                            ) : (
                              <Typography variant="body2" color="text.disabled">
                                {resolveEffectiveSalespersonName(r.sale, r.enquiry) || '—'}
                              </Typography>
                            )}
                          </TableCell>
                        )}
                        {showSalespersonColumn && (
                          <TableCell align="right">
                            {formatCurrency(r.result.saleGrandTotal)}
                          </TableCell>
                        )}
                        {showCallRecordColumn && (
                          <TableCell>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {r.result.referenceValues.length === 0 ? (
                                <Typography variant="body2" color="text.disabled">—</Typography>
                              ) : (
                                r.result.referenceValues.map((ref) => {
                                  const boost = ref === 'indiamart' || ref === 'online';
                                  return (
                                    <Chip
                                      key={ref}
                                      size="small"
                                      label={ref}
                                      color={boost ? 'warning' : 'default'}
                                      variant={boost ? 'filled' : 'outlined'}
                                      sx={{ textTransform: 'capitalize' }}
                                    />
                                  );
                                })
                              )}
                            </Stack>
                          </TableCell>
                        )}
                        {showCallRecordColumn && (
                          <TableCell>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {r.result.matchedCallerNames.map((name) => (
                                <Chip
                                  key={name}
                                  size="small"
                                  label={name}
                                  color="info"
                                  variant="filled"
                                  icon={<PhoneIcon sx={{ fontSize: 14 }} />}
                                />
                              ))}
                            </Stack>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {r.result.ruleLabel}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={formatCurrency(r.result.amount)}
                            color={isBoost ? 'warning' : 'success'}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </TableContainer>
          <Divider />
          <TablePagination
            component="div"
            count={rows.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
          />
        </Paper>
      </Container>
    </LocalizationProvider>
  );
}

function SummaryCard({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha(color, 0.12),
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h6" fontWeight={700}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
