/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid as MuiGrid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Avoid MUI Grid generic type noise by wrapping (consistent with other modules)
const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);

const escapeCsv = (value: any) => {
  const s = (value ?? '').toString();
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const downloadCsv = (fileName: string, headers: string[], rows: any[][]) => {
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

type NormalizedSale = {
  id: string;
  source: 'sales' | 'enquiry';
  date: Date;
  patientName: string;
  centerId?: string;
  centerName: string;
  executiveName: string;
  subtotal: number;
  gstAmount: number;
  total: number;
};

type NormalizedBooking = {
  id: string;
  enquiryId: string;
  visitId?: string;
  date: Date;
  patientName: string;
  centerId?: string;
  centerName: string;
  executiveName: string;
  advanceAmount: number;
  bookingDateRaw?: string;
};

type Center = { id: string; name?: string };

function parseVisitDateToDate(dateStr?: string): Date | null {
  const s = (dateStr || '').toString().trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function inRange(d: Date, from?: Date | null, to?: Date | null) {
  const t = d.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

function isEnquirySaleVisit(visit: any): boolean {
  return !!(
    visit?.hearingAidSale ||
    (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
    visit?.journeyStage === 'sale' ||
    visit?.hearingAidStatus === 'sold' ||
    (Array.isArray(visit?.products) &&
      visit.products.length > 0 &&
      ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
  );
}

function isEnquiryBookedVisit(visit: any): boolean {
  return !!(
    visit?.hearingAidBooked ||
    (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_booked')) ||
    visit?.journeyStage === 'booking' ||
    visit?.hearingAidStatus === 'booked' ||
    (visit?.bookingAdvanceAmount || 0) > 0
  );
}

function getMonthDefaultRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

export default function SalesReportsTab() {
  const [{ from, to }] = useState(() => getMonthDefaultRange());
  const [tab, setTab] = useState(0);

  const [dateFrom, setDateFrom] = useState<string>(from.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState<string>(to.toISOString().slice(0, 10));
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [execFilter, setExecFilter] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<Center[]>([]);
  const [sales, setSales] = useState<NormalizedSale[]>([]);
  const [bookings, setBookings] = useState<NormalizedBooking[]>([]);

  const dateFromObj = useMemo(() => (dateFrom ? new Date(`${dateFrom}T00:00:00`) : null), [dateFrom]);
  const dateToObj = useMemo(() => (dateTo ? new Date(`${dateTo}T23:59:59.999`) : null), [dateTo]);

  const centerNameById = useMemo(() => {
    const m = new Map<string, string>();
    centers.forEach(c => m.set(c.id, (c.name || c.id).toString()));
    return m;
  }, [centers]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [centersSnap, salesSnap, enquiriesSnap] = await Promise.all([
        getDocs(collection(db, 'centers')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'enquiries')),
      ]);

      const centersList: Center[] = centersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setCenters(centersList);
      const centerMap = new Map<string, string>();
      centersList.forEach(c => centerMap.set(c.id, (c.name || c.id).toString()));

      const normalizedSales: NormalizedSale[] = [];
      salesSnap.docs.forEach(d => {
        const data: any = d.data();
        const ts: Timestamp | undefined = data.saleDate;
        const date = ts?.toDate ? ts.toDate() : new Date();
        const subtotal = Number(data.totalAmount || 0);
        const gstAmount = Number(data.gstAmount || 0);
        const total = subtotal + gstAmount;
        normalizedSales.push({
          id: d.id,
          source: 'sales',
          date,
          patientName: (data.patientName || '—').toString(),
          centerName: (data.branch || '—').toString(),
          executiveName: (data.salesperson?.name || data.salespersonName || '—').toString(),
          subtotal,
          gstAmount,
          total,
        });
      });

      const normalizedBookings: NormalizedBooking[] = [];
      enquiriesSnap.docs.forEach(d => {
        const e: any = d.data();
        const patientName = (e.name || e.patientName || e.fullName || '—').toString();
        const centerId = (e.center || '').toString();
        const centerName = centerId ? (centerMap.get(centerId) || centerId) : '—';
        const visits: any[] = Array.isArray(e.visits) ? e.visits : [];

        visits.forEach((visit: any, idx: number) => {
          if (isEnquirySaleVisit(visit)) {
            const date =
              parseVisitDateToDate(visit.purchaseDate) ||
              parseVisitDateToDate(visit.hearingAidPurchaseDate) ||
              parseVisitDateToDate(visit.visitDate) ||
              (e.updatedAt?.toDate ? e.updatedAt.toDate() : new Date());

            const products: any[] = Array.isArray(visit.products) ? visit.products : [];
            const subtotal =
              Number(visit.grossSalesBeforeTax || 0) ||
              products.reduce((sum, p) => sum + Number(p.sellingPrice || 0), 0);
            const gstAmount =
              Number(visit.taxAmount || 0) ||
              products.reduce((sum, p) => sum + Number(p.gstAmount || 0), 0);
            const total =
              Number(visit.salesAfterTax || 0) ||
              products.reduce((sum, p) => sum + Number(p.finalAmount || 0), 0);

            normalizedSales.push({
              id: `enq-${d.id}-sale-${visit.id || idx}`,
              source: 'enquiry',
              date,
              patientName,
              centerId,
              centerName,
              executiveName: (visit.hearingAidBrand || '—').toString(), // “Who Sold” field in this form
              subtotal,
              gstAmount,
              total,
            });
          }

          if (isEnquiryBookedVisit(visit)) {
            const date =
              parseVisitDateToDate(visit.bookingDate) ||
              parseVisitDateToDate(visit.visitDate) ||
              (e.updatedAt?.toDate ? e.updatedAt.toDate() : new Date());

            normalizedBookings.push({
              id: `enq-${d.id}-book-${visit.id || idx}`,
              enquiryId: d.id,
              visitId: (visit.id || '').toString(),
              date,
              patientName,
              centerId,
              centerName,
              executiveName: (visit.hearingAidBrand || '—').toString(), // “Who Sold”
              advanceAmount: Number(visit.bookingAdvanceAmount || 0),
              bookingDateRaw: (visit.bookingDate || '').toString(),
            });
          }
        });
      });

      normalizedSales.sort((a, b) => b.date.getTime() - a.date.getTime());
      normalizedBookings.sort((a, b) => b.date.getTime() - a.date.getTime());

      setSales(normalizedSales);
      setBookings(normalizedBookings);
    } catch (err) {
      console.error('Failed to fetch sales reports:', err);
      setSales([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (!inRange(s.date, dateFromObj, dateToObj)) return false;
      if (centerFilter !== 'all') {
        // For sales collection, centerName is branch string, so allow both id or name filter
        if ((s.centerId || '') !== centerFilter && s.centerName !== centerFilter) return false;
      }
      if (execFilter !== 'all' && s.executiveName !== execFilter) return false;
      return true;
    });
  }, [sales, dateFromObj, dateToObj, centerFilter, execFilter]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (!inRange(b.date, dateFromObj, dateToObj)) return false;
      if (centerFilter !== 'all' && (b.centerId || '') !== centerFilter && b.centerName !== centerFilter) return false;
      if (execFilter !== 'all' && b.executiveName !== execFilter) return false;
      return true;
    });
  }, [bookings, dateFromObj, dateToObj, centerFilter, execFilter]);

  const centerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    centers.forEach(c => seen.set(c.id, centerNameById.get(c.id) || c.id));
    // Also include branch strings from sales collection, because those aren’t center ids
    sales
      .filter(s => s.source === 'sales')
      .forEach(s => {
        const name = (s.centerName || '').toString().trim();
        if (name) seen.set(name, name);
      });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [centers, centerNameById, sales]);

  const execOptions = useMemo(() => {
    const set = new Set<string>();
    sales.forEach(s => set.add((s.executiveName || '—').toString()));
    bookings.forEach(b => set.add((b.executiveName || '—').toString()));
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [sales, bookings]);

  const centerWise = useMemo(() => {
    const map = new Map<string, { center: string; count: number; total: number }>();
    filteredSales.forEach(s => {
      const key = s.centerId || s.centerName || '—';
      const name = s.centerName || (s.centerId ? (centerNameById.get(s.centerId) || s.centerId) : '—');
      const prev = map.get(key) || { center: name, count: 0, total: 0 };
      map.set(key, { center: name, count: prev.count + 1, total: prev.total + (s.total || 0) });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales, centerNameById]);

  const execWise = useMemo(() => {
    const map = new Map<string, { executive: string; count: number; total: number }>();
    filteredSales.forEach(s => {
      const key = s.executiveName || '—';
      const prev = map.get(key) || { executive: key, count: 0, total: 0 };
      map.set(key, { executive: key, count: prev.count + 1, total: prev.total + (s.total || 0) });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const totals = useMemo(() => {
    const subtotal = filteredSales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
    const gst = filteredSales.reduce((sum, s) => sum + (s.gstAmount || 0), 0);
    const total = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
    return { subtotal, gst, total };
  }, [filteredSales]);

  const exportCenterWise = () => {
    const headers = ['Center', 'Sales Count', 'Total Sales'];
    const rows = centerWise.map(r => [r.center, r.count, r.total]);
    downloadCsv(`center-wise-sales-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  const exportExecWise = () => {
    const headers = ['Executive', 'Sales Count', 'Total Sales'];
    const rows = execWise.map(r => [r.executive, r.count, r.total]);
    downloadCsv(`executive-wise-sales-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  const exportBookings = () => {
    const headers = ['Booking Date', 'Patient', 'Center', 'Executive', 'Advance Amount', 'Enquiry Id'];
    const rows = filteredBookings.map(b => [
      b.date.toLocaleDateString(),
      b.patientName,
      b.centerName,
      b.executiveName,
      b.advanceAmount,
      b.enquiryId,
    ]);
    downloadCsv(`booked-report-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  const exportSalesLines = () => {
    const headers = ['Date', 'Patient', 'Center', 'Executive', 'Subtotal', 'GST', 'Total', 'Source', 'Id'];
    const rows = filteredSales.map(s => [
      s.date.toLocaleDateString(),
      s.patientName,
      s.centerName,
      s.executiveName,
      s.subtotal,
      s.gstAmount,
      s.total,
      s.source,
      s.id,
    ]);
    downloadCsv(`sales-lines-${dateFrom || 'all'}-to-${dateTo || 'all'}.csv`, headers, rows);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={2.5}>
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2.5}>
            <TextField
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="center-filter-label">Center</InputLabel>
              <Select
                labelId="center-filter-label"
                label="Center"
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {centerOptions.map(c => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="exec-filter-label">Executive</InputLabel>
              <Select
                labelId="exec-filter-label"
                label="Executive"
                value={execFilter}
                onChange={(e) => setExecFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {execOptions.map(name => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchAll}
              sx={{ height: 40 }}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="sales reports tabs"
        >
          <Tab label="Center-wise Sales" />
          <Tab label="Executive-wise Sales" />
          <Tab label="Booked Report" />
          <Tab label="All Sales Lines" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Center-wise Sales</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCenterWise}>
              Export CSV
            </Button>
          </Box>
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Center</TableCell>
                  <TableCell align="right">Sales Count</TableCell>
                  <TableCell align="right">Total Sales</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {centerWise.length ? (
                  <>
                    {centerWise.map(r => (
                      <TableRow key={r.center} hover>
                        <TableCell>{r.center}</TableCell>
                        <TableCell align="right">{r.count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(r.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {filteredSales.length}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.total)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      No sales found for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Executive-wise Sales</Typography>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportExecWise}>
              Export CSV
            </Button>
          </Box>
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Executive</TableCell>
                  <TableCell align="right">Sales Count</TableCell>
                  <TableCell align="right">Total Sales</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {execWise.length ? (
                  <>
                    {execWise.map(r => (
                      <TableRow key={r.executive} hover>
                        <TableCell>{r.executive}</TableCell>
                        <TableCell align="right">{r.count}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(r.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {filteredSales.length}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totals.total)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                      No sales found for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box>
              <Typography variant="h6">Booked Report</Typography>
              <Typography variant="body2" color="text.secondary">
                Shows hearing-aid bookings/advance entries captured in enquiries.
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportBookings}>
              Export CSV
            </Button>
          </Box>
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell>Executive</TableCell>
                  <TableCell align="right">Advance</TableCell>
                  <TableCell>Enquiry</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBookings.length ? (
                  filteredBookings.map(b => (
                    <TableRow key={b.id} hover>
                      <TableCell>{b.date.toLocaleDateString()}</TableCell>
                      <TableCell>{b.patientName}</TableCell>
                      <TableCell>{b.centerName}</TableCell>
                      <TableCell>{b.executiveName}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(b.advanceAmount)}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={b.enquiryId} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      No bookings found for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 3 && (
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box>
              <Typography variant="h6">All Sales Lines</Typography>
              <Typography variant="body2" color="text.secondary">
                Combined from `sales` collection + enquiry visit sales.
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportSalesLines}>
              Export CSV
            </Button>
          </Box>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Subtotal
                </Typography>
                <Typography variant="h6">{formatCurrency(totals.subtotal)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total GST
                </Typography>
                <Typography variant="h6">{formatCurrency(totals.gst)}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Sales
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {formatCurrency(totals.total)}
                </Typography>
              </Grid>
            </Grid>
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="caption" color="text.secondary">
              Records: {filteredSales.length}
            </Typography>
          </Paper>
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell>Executive</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSales.length ? (
                  filteredSales.map(s => (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.date.toLocaleDateString()}</TableCell>
                      <TableCell>{s.patientName}</TableCell>
                      <TableCell>{s.centerName}</TableCell>
                      <TableCell>{s.executiveName}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatCurrency(s.total)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={s.source === 'sales' ? 'Sales' : 'Enquiry'}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      No sales found for this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

