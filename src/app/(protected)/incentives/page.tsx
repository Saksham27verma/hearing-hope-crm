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
  TextField,
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
  getIncentiveEmployee,
  type EnquiryLike,
  type IncentiveResult,
} from '@/lib/incentives/incentiveRules';

type SaleRow = {
  id: string;
  invoiceNumber?: string;
  patientName?: string;
  saleDate?: Timestamp;
  grandTotal?: number;
  enquiryId?: string;
  centerId?: string;
  branch?: string;
  source?: string;
  cancelled?: boolean;
};

type Row = {
  sale: SaleRow;
  enquiry: EnquiryLike | null;
  result: IncentiveResult;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (ts?: Timestamp) => {
  if (!ts) return '-';
  const d = new Date(ts.seconds * 1000);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [salesScanned, setSalesScanned] = useState(0);

  const employee = useMemo(() => getIncentiveEmployee(employeeId), [employeeId]);

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
          !!s.enquiryId,
      );
      setSalesScanned(scopedSales.length);

      const enquiryMap = await fetchEnquiriesByIds(scopedSales.map((s) => s.enquiryId as string));

      const computedRows: Row[] = [];
      for (const sale of scopedSales) {
        const enquiry = sale.enquiryId ? enquiryMap.get(sale.enquiryId) ?? null : null;
        const result = computeIncentiveForSale(sale, enquiry, employee);
        if (result.amount > 0) {
          computedRows.push({ sale, enquiry, result });
        }
      }
      setRows(computedRows);
      setPage(0);
    } catch (e) {
      console.error('Failed to load incentives:', e);
      setError(e instanceof Error ? e.message : 'Failed to load incentives');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [employee, dateFrom, dateTo, effectiveScopeCenterId, allowedCenterIds]);

  useEffect(() => {
    if (!isPrimaryAdmin) return;
    void fetchData();
  }, [isPrimaryAdmin, fetchData]);

  const totals = useMemo(() => {
    let total = 0;
    let count50 = 0;
    let count100 = 0;
    for (const r of rows) {
      total += r.result.amount;
      if (r.result.amount === 100) count100 += 1;
      else if (r.result.amount === 50) count50 += 1;
    }
    return { total, count50, count100 };
  }, [rows]);

  const paged = useMemo(
    () => rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [rows, page, rowsPerPage],
  );

  const handleExportCsv = () => {
    const header = [
      'Invoice #',
      'Sale Date',
      'Patient',
      'Reference',
      'Call Records (matched)',
      'Rule',
      'Amount (INR)',
    ];
    const body = rows.map((r) => [
      r.sale.invoiceNumber || r.sale.id,
      formatDate(r.sale.saleDate),
      r.sale.patientName || '',
      r.result.referenceValues.join(' | '),
      r.result.matchedCallerNames.join(' | '),
      r.result.ruleLabel || '',
      r.result.amount,
    ]);
    const footer = ['', '', '', '', '', 'TOTAL', totals.total];
    const csv = [header, ...body, footer].map((row) => row.map(csvEscape).join(',')).join('\n');
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
                  Computes per-employee sales incentives based on call records and enquiry reference. Visible only to the primary admin.
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
                Active rules for <b>{employee.displayName}</b>:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {employee.rules.map((r) => (
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
              label="₹100 Sales (Indiamart / Online)"
              value={String(totals.count100)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<PhoneIcon />}
              color={theme.palette.info.main}
              label="₹50 Sales (call record)"
              value={String(totals.count50)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <SummaryCard
              icon={<ReceiptIcon />}
              color={theme.palette.primary.main}
              label="Sales Scanned"
              value={String(salesScanned)}
            />
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Sale Date</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Call Records (matched)</TableCell>
                  <TableCell>Rule</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">
                        No incentive-earning sales in this range.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((r) => {
                    const isBoost = r.result.amount === 100;
                    return (
                      <TableRow key={r.sale.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {r.sale.invoiceNumber || r.sale.id}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDate(r.sale.saleDate)}</TableCell>
                        <TableCell>{r.sale.patientName || '-'}</TableCell>
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
                  })
                )}
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
