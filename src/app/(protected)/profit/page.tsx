'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid as MuiGrid,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Download as DownloadIcon,
  InfoOutlined,
  PictureAsPdf as PdfIcon,
  Search as SearchIcon,
  TableChart as ExcelIcon,
  TrendingDown,
  TrendingFlat,
  TrendingUp,
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import { isSuperAdminViewer } from '@/lib/tenant/centerScope';
import {
  UNALLOCATED_KEY,
} from '@/lib/profit/mergeCenterProfit';
import type { BreakdownRow, DatePreset, ProfitSummary } from '@/lib/profit/types';
import { exportToExcel, exportToPdf } from '@/lib/profit/export';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { alpha, useTheme } from '@mui/material/styles';

const Grid = ({ children, ...props }: React.ComponentProps<typeof MuiGrid>) => (
  <MuiGrid {...props}>{children}</MuiGrid>
);

// ── Utilities ────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}


function getThisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
}

function getLastQuarterRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(now) };
}

function buildDateLabel(from: string, to: string): string {
  if (!from || !to) return 'Custom Range';
  const fmtDate = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

// ── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Revenue: '#059669',
  Salary: '#e11d48',
  'Fixed Cost': '#b45309',
  'Cash Outflow': '#dc2626',
  'Managed Expense': '#7c3aed',
};
const CATEGORY_BG: Record<string, string> = {
  Revenue: '#d1fae5',
  Salary: '#ffe4e6',
  'Fixed Cost': '#fef3c7',
  'Cash Outflow': '#fee2e2',
  'Managed Expense': '#ede9fe',
};

// ── Main page component ───────────────────────────────────────────────────────

export default function ProfitPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const isSuperAdmin = isSuperAdminViewer(userProfile);

  const [preset, setPreset] = useState<DatePreset>('this-month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [summary, setSummary] = useState<ProfitSummary | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  const fetchGenRef = useRef(0);

  const dateRange = useMemo(() => {
    if (preset === 'this-month') return getThisMonthRange();
    if (preset === 'last-quarter') return getLastQuarterRange();
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo]);

  const dateLabel = useMemo(() => buildDateLabel(dateRange.from, dateRange.to), [dateRange]);

  const fetchSummary = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;
    const gen = ++fetchGenRef.current;
    setFetchLoading(true);
    setFetchError(null);

    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error('Please sign in again to load profit summary.');
      const sp = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
      const res = await fetch(`/api/profit/summary?${sp.toString()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json()) as
        | { ok: true; data: ProfitSummary }
        | { ok: false; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error('error' in payload ? payload.error || 'Failed to load profit summary' : 'Failed to load profit summary');
      }
      if (gen !== fetchGenRef.current) return;
      setSummary(payload.data);
    } catch (err) {
      if (gen !== fetchGenRef.current) return;
      console.error('Profit page error:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load data. Please try again.');
    } finally {
      if (gen === fetchGenRef.current) setFetchLoading(false);
    }
  }, [dateRange, user]);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) router.replace('/dashboard');
  }, [authLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) fetchSummary();
    return () => { fetchGenRef.current++; };
  }, [isSuperAdmin, fetchSummary]);

  const filteredRows = useMemo<BreakdownRow[]>(() => {
    if (!summary) return [];
    const q = search.toLowerCase().trim();
    return summary.breakdownRows.filter((r) => {
      if (categoryFilter !== 'All' && r.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        (r.reference ?? '').toLowerCase().includes(q) ||
        (r.centerName ?? '').toLowerCase().includes(q)
      );
    });
  }, [summary, search, categoryFilter]);

  const pagedRows = useMemo(
    () => filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredRows, page, rowsPerPage],
  );

  const centerChartData = useMemo(() => {
    if (!summary?.centerRows?.length) return [];
    return summary.centerRows.map((r) => ({
      name: r.centerName.length > 22 ? `${r.centerName.slice(0, 20)}…` : r.centerName,
      fullName: r.centerName,
      grossProfit: r.grossProfit,
      salaries: r.salaries,
      fixedCosts: r.fixedCosts,
      cashOutflows: r.cashOutflows,
      managedExpenses: r.managedExpenses,
      netProfit: r.netProfit,
    }));
  }, [summary?.centerRows]);

  const handlePresetChange = (_: React.MouseEvent<HTMLElement>, value: DatePreset | null) => {
    if (!value) return;
    setPreset(value);
    setPage(0);
  };

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isSuperAdmin) return null;

  const netProfitPositive = (summary?.netProfit ?? 0) >= 0;

  return (
    <Box>
      {/* ── Page header ── */}
      <Box mb={3} display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: -0.3, color: 'text.primary' }}>
            Profit Module
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            SuperAdmin financial overview — {dateLabel}
          </Typography>
        </Box>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Tooltip title={!summary ? 'Load data first' : 'Export to Excel'}>
            <span>
              <Button
                variant="outlined" size="small"
                startIcon={exporting === 'excel' ? <CircularProgress size={14} /> : <ExcelIcon />}
                onClick={async () => { if (!summary) return; setExporting('excel'); try { await exportToExcel(summary, dateLabel); } finally { setExporting(null); } }}
                disabled={!summary || !!exporting}
              >Excel</Button>
            </span>
          </Tooltip>
          <Tooltip title={!summary ? 'Load data first' : 'Export to PDF'}>
            <span>
              <Button
                variant="outlined" size="small"
                startIcon={exporting === 'pdf' ? <CircularProgress size={14} /> : <PdfIcon />}
                onClick={async () => { if (!summary) return; setExporting('pdf'); try { await exportToPdf(summary, dateLabel); } finally { setExporting(null); } }}
                disabled={!summary || !!exporting}
              >PDF</Button>
            </span>
          </Tooltip>
          <Button
            variant="contained" size="small"
            startIcon={fetchLoading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
            onClick={fetchSummary}
            disabled={fetchLoading || (preset === 'custom' && (!customFrom || !customTo))}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
          >Refresh</Button>
        </Box>
      </Box>

      {/* ── Date filter bar ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Date Range
          </Typography>
          <ToggleButtonGroup value={preset} exclusive onChange={handlePresetChange} size="small" color="primary">
            <ToggleButton value="this-month">This Month</ToggleButton>
            <ToggleButton value="last-quarter">Last Quarter</ToggleButton>
            <ToggleButton value="custom">Custom</ToggleButton>
          </ToggleButtonGroup>
          {preset === 'custom' && (
            <Box display="flex" gap={1.5} flexWrap="wrap">
              <TextField type="date" size="small" label="From" value={customFrom}
                onChange={(e) => { setCustomFrom(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
              <TextField type="date" size="small" label="To" value={customTo}
                onChange={(e) => { setCustomTo(e.target.value); setPage(0); }}
                InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
            </Box>
          )}
        </Box>
      </Paper>

      {fetchError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setFetchError(null)}>{fetchError}</Alert>
      )}

      {fetchLoading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <Box textAlign="center">
            <CircularProgress sx={{ color: '#F17336' }} />
            <Typography variant="body2" color="text.secondary" mt={2}>
              Aggregating financial data…
            </Typography>
          </Box>
        </Box>
      )}

      {summary && !fetchLoading && (
        <>
          {/* Unresolved serials notice */}
          {summary.unresolvedSerialsCount > 0 && (
            <Alert severity="info" icon={<InfoOutlined fontSize="small" />} sx={{ mb: 2.5, borderRadius: 2 }}>
              <strong>{summary.unresolvedSerialsCount}</strong> serial(s) worth{' '}
              <strong>{formatINR(summary.unresolvedSellingValue)}</strong> have no matching purchase/material-inward
              record. Their dealer cost is treated as ₹0, which may slightly inflate Gross Profit.
              Resolve them in the Profit Analysis report for full accuracy.
            </Alert>
          )}

          {/* ── 3 KPI cards ── */}
          <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
            {/* Gross Profit */}
            <Grid item xs={12} sm={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                  border: isDark ? `1px solid ${alpha('#059669', 0.45)}` : '1px solid #a7f3d0',
                  bgcolor: isDark ? alpha('#059669', 0.14) : undefined,
                  background: isDark ? undefined : 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)',
                }}
              >
                <Box sx={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(5,150,105,0.08)' }} />
                <Typography variant="caption" fontWeight={600} color={isDark ? 'success.light' : '#065f46'} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Gross Profit
                </Typography>
                <Tooltip title="Selling price minus dealer cost per resolved serial — same number shown in Reports → Profit Analysis" placement="top">
                  <Typography variant="h4" fontWeight={800} color={isDark ? 'success.light' : '#059669'} sx={{ mt: 1, mb: 0.5, lineHeight: 1.1, cursor: 'help' }}>
                    {formatINR(summary.grossProfit)}
                  </Typography>
                </Tooltip>
                <Typography variant="caption" color={isDark ? 'success.light' : '#065f46'} display="block">
                  Matches Profit Analysis Report exactly
                </Typography>
                <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                  <TrendingUp sx={{ fontSize: 15, color: isDark ? 'success.light' : '#059669' }} />
                  <Typography variant="caption" color={isDark ? 'success.light' : '#065f46'}>
                    {summary.grossRevenue > 0
                      ? `${((summary.grossProfit / summary.grossRevenue) * 100).toFixed(1)}% gross margin`
                      : 'No revenue'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Operating Expenses */}
            <Grid item xs={12} sm={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                  border: isDark ? `1px solid ${alpha('#e11d48', 0.45)}` : '1px solid #fecdd3',
                  bgcolor: isDark ? alpha('#e11d48', 0.12) : undefined,
                  background: isDark ? undefined : 'linear-gradient(135deg,#fff1f2 0%,#ffe4e6 100%)',
                }}
              >
                <Box sx={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(225,29,72,0.08)' }} />
                <Typography variant="caption" fontWeight={600} color={isDark ? 'error.light' : '#881337'} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Operating Expenses
                </Typography>
                <Typography variant="h4" fontWeight={800} color={isDark ? 'error.light' : '#e11d48'} sx={{ mt: 1, mb: 0.5, lineHeight: 1.1 }}>
                  {formatINR(summary.totalOperatingExpenses)}
                </Typography>
                <Box display="flex" flexDirection="column" gap={0.25} mt={0.5}>
                  <Typography variant="caption" color={isDark ? 'error.light' : '#881337'}>Salaries: {formatINR(summary.totalSalaries)}</Typography>
                  <Typography variant="caption" color={isDark ? 'error.light' : '#881337'}>Fixed Costs: {formatINR(summary.totalFixedCosts)}</Typography>
                  <Typography variant="caption" color={isDark ? 'error.light' : '#881337'}>Cash expenses (register): {formatINR(summary.totalCashOutflows)}</Typography>
                  <Typography variant="caption" color={isDark ? 'error.light' : '#881337'}>Managed expenses: {formatINR(summary.totalManagedExpenses)}</Typography>
                </Box>
              </Paper>
            </Grid>

            {/* Net Profit */}
            <Grid item xs={12} sm={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                  border: netProfitPositive
                    ? isDark
                      ? `1px solid ${alpha('#3b82f6', 0.5)}`
                      : '1px solid #bfdbfe'
                    : isDark
                      ? `1px solid ${alpha('#e11d48', 0.45)}`
                      : '1px solid #fecdd3',
                  bgcolor: isDark
                    ? netProfitPositive
                      ? alpha('#3b82f6', 0.14)
                      : alpha('#e11d48', 0.12)
                    : undefined,
                  background: isDark
                    ? undefined
                    : netProfitPositive
                      ? 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)'
                      : 'linear-gradient(135deg,#fff1f2 0%,#ffe4e6 100%)',
                }}
              >
                <Box sx={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', bgcolor: netProfitPositive ? 'rgba(37,99,235,0.07)' : 'rgba(225,29,72,0.07)' }} />
                <Typography variant="caption" fontWeight={600} color={netProfitPositive ? (isDark ? 'info.light' : '#1e3a8a') : isDark ? 'error.light' : '#881337'} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Net Profit
                </Typography>
                <Typography variant="h4" fontWeight={800} color={netProfitPositive ? (isDark ? 'info.light' : '#2563eb') : isDark ? 'error.light' : '#e11d48'} sx={{ mt: 1, mb: 0.5, lineHeight: 1.1 }}>
                  {formatINR(summary.netProfit)}
                </Typography>
                <Typography variant="caption" color={netProfitPositive ? (isDark ? 'info.light' : '#1e3a8a') : isDark ? 'error.light' : '#881337'} display="block">
                  Gross Profit − Operating Expenses
                </Typography>
                <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                  {netProfitPositive ? <TrendingUp sx={{ fontSize: 15, color: isDark ? theme.palette.info.light : '#2563eb' }} /> : summary.netProfit === 0 ? <TrendingFlat sx={{ fontSize: 15, color: 'text.secondary' }} /> : <TrendingDown sx={{ fontSize: 15, color: isDark ? 'error.light' : '#e11d48' }} />}
                  <Typography variant="caption" color={netProfitPositive ? (isDark ? 'info.light' : '#1e3a8a') : isDark ? 'error.light' : '#881337'}>
                    {summary.grossRevenue > 0 ? `${((summary.netProfit / summary.grossRevenue) * 100).toFixed(1)}% net margin on revenue` : 'No revenue'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Sub-cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Gross Revenue', value: summary.grossRevenue, color: '#059669', bg: '#f0fdf4', hint: 'Total of all invoice grand totals' },
              { label: 'Salaries', value: summary.totalSalaries, color: '#e11d48', bg: '#fff1f2', hint: 'Paid salary disbursements' },
              { label: 'Fixed Costs', value: summary.totalFixedCosts, color: '#b45309', bg: '#fffbeb', hint: 'Rent + electricity' },
              { label: 'Cash expenses', value: summary.totalCashOutflows, color: '#dc2626', bg: '#fef2f2', hint: 'Cash Register lines categorized as Expenses only' },
              { label: 'Managed expenses', value: summary.totalManagedExpenses, color: '#7c3aed', bg: '#f5f3ff', hint: 'Expenses entered from the dedicated Expenses module' },
            ].map((item) => (
              <Grid item xs={6} sm={4} md={3} key={item.label}>
                <Tooltip title={item.hint} placement="top">
                  <Paper
                    elevation={0}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: isDark ? alpha(item.color, 0.14) : item.bg,
                      borderColor: isDark ? alpha(item.color, 0.35) : 'divider',
                      cursor: 'default',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap>{item.label}</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, color: item.color }}>
                      {formatINR(item.value)}
                    </Typography>
                  </Paper>
                </Tooltip>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ mb: 3 }} />

          {/* ── Center-wise net profit ── */}
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, color: 'text.primary' }}>
            Center-wise net profit
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 900 }}>
            Salaries are charged only to centers where that person appears under{' '}
            <strong>Centers → Staff</strong>. If someone is listed on multiple centers, their salary is split
            equally across those centers. Only Cash Register outflows tagged <strong>Expenses</strong> (not
            handed-over or miscellaneous) use each sheet&apos;s center; sheets without a center are grouped under
            Unallocated.
          </Typography>

          {centerChartData.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, color: 'text.primary' }}>
                Gross profit, expense breakdown, and net profit by center
              </Typography>
              <Box sx={{ width: '100%', height: { xs: 320, sm: 400 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={centerChartData} margin={{ top: 8, right: 12, left: 4, bottom: 56 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={alpha(theme.palette.text.secondary, isDark ? 0.35 : 0.25)}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={72}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
                      tickFormatter={(v) => {
                        const n = Number(v);
                        if (!Number.isFinite(n)) return '';
                        if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
                        if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}k`;
                        return `₹${Math.round(n)}`;
                      }}
                      width={56}
                    />
                    <RechartsTooltip
                      formatter={(value: number | string) =>
                        formatINR(typeof value === 'number' ? value : Number(value))
                      }
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ''
                      }
                    />
                    <Legend wrapperStyle={{ paddingTop: 12 }} />
                    <Bar dataKey="grossProfit" name="Gross profit" fill="#059669" />
                    <Bar dataKey="salaries" stackId="exp" name="Salaries" fill="#e11d48" />
                    <Bar dataKey="fixedCosts" stackId="exp" name="Fixed costs" fill="#d97706" />
                    <Bar dataKey="cashOutflows" stackId="exp" name="Cash expenses (register)" fill="#b91c1c" />
                    <Bar dataKey="managedExpenses" stackId="exp" name="Managed expenses" fill="#7c3aed" />
                    <Bar dataKey="netProfit" name="Net profit">
                      {centerChartData.map((e, i) => (
                        <Cell key={`net-${e.fullName}-${i}`} fill={e.netProfit >= 0 ? '#1d4ed8' : '#be123c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Center</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Gross revenue</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Gross profit</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Salaries</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Fixed costs</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Cash exp.</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Managed exp.</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Total expenses</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Net profit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(summary.centerRows ?? []).map((row) => (
                  <TableRow key={row.rowKey} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{row.centerName}</Typography>
                      {row.rowKey === UNALLOCATED_KEY && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Assign staff on Centers page or add center on cash sheets
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{formatINR(row.grossRevenue)}</TableCell>
                    <TableCell align="right" sx={{ color: '#059669', fontWeight: 600 }}>
                      {formatINR(row.grossProfit)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#e11d48' }}>{formatINR(row.salaries)}</TableCell>
                    <TableCell align="right" sx={{ color: '#b45309' }}>{formatINR(row.fixedCosts)}</TableCell>
                    <TableCell align="right" sx={{ color: '#dc2626' }}>{formatINR(row.cashOutflows)}</TableCell>
                    <TableCell align="right" sx={{ color: '#7c3aed' }}>{formatINR(row.managedExpenses)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatINR(row.totalExpenses)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, color: row.netProfit >= 0 ? '#1d4ed8' : '#be123c' }}
                    >
                      {formatINR(row.netProfit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ mb: 3 }} />

          {/* ── Breakdown table ── */}
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <Box sx={{ px: 2.5, pt: 2, pb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
              <Box>
                <Typography variant="h6" fontWeight={700} color="text.primary">Transaction Breakdown</Typography>
                <Typography variant="caption" color="text.secondary">
                  Net Profit = Gross Profit (from Profit Analysis) − Salaries − Fixed Costs − Cash Register (Expenses only) − Managed Expenses
                </Typography>
              </Box>
              <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
                <Box display="flex" gap={0.75} flexWrap="wrap">
                  {['All', 'Revenue', 'Salary', 'Fixed Cost', 'Cash Outflow', 'Managed Expense'].map((cat) => (
                    <Chip key={cat} label={cat} size="small"
                      onClick={() => { setCategoryFilter(cat); setPage(0); }}
                      variant={categoryFilter === cat ? 'filled' : 'outlined'}
                      sx={
                        categoryFilter === cat && cat !== 'All'
                          ? {
                              bgcolor: CATEGORY_COLORS[cat] ?? '#6366f1',
                              color: '#fff',
                              borderColor: CATEGORY_COLORS[cat] ?? '#6366f1',
                              fontWeight: 600,
                            }
                          : categoryFilter === cat
                            ? {
                                bgcolor: isDark ? alpha(theme.palette.common.white, 0.12) : '#1e293b',
                                color: isDark ? 'text.primary' : '#fff',
                                fontWeight: 600,
                              }
                            : {}
                      }
                    />
                  ))}
                </Box>
                <TextField size="small" placeholder="Search…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                  sx={{ width: 240 }} />
              </Box>
            </Box>

            <TableContainer sx={{ maxHeight: 520 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Center</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedRows.length > 0 ? pagedRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8rem' }}>{row.date}</TableCell>
                      <TableCell sx={{ maxWidth: 340 }}>
                        <Typography variant="body2" noWrap title={row.description}>{row.description}</Typography>
                        {row.reference && <Typography variant="caption" color="text.secondary" noWrap>Ref: {row.reference}</Typography>}
                      </TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary" noWrap>{row.centerName ?? '—'}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          label={row.category}
                          size="small"
                          sx={{
                            bgcolor: isDark
                              ? alpha(CATEGORY_COLORS[row.category] ?? '#6366f1', 0.2)
                              : CATEGORY_BG[row.category] ?? '#f1f5f9',
                            color: isDark ? CATEGORY_COLORS[row.category] ?? theme.palette.info.light : CATEGORY_COLORS[row.category] ?? '#334155',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip label={row.type === 'in' ? 'Inflow' : 'Outflow'} size="small"
                          sx={{ bgcolor: row.type === 'in' ? '#d1fae5' : '#ffe4e6', color: row.type === 'in' ? '#065f46' : '#9f1239', fontWeight: 700, fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700} color={row.type === 'in' ? '#059669' : '#e11d48'}>
                          {row.type === 'in' ? '+' : '−'} {formatINR(row.amount)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                        {search || categoryFilter !== 'All' ? 'No transactions match the current filter.' : 'No transactions found for this date range.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filteredRows.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Rows:"
            />
          </Paper>
        </>
      )}
    </Box>
  );
}
