/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid as MuiGrid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
  BookmarkAdded as BookmarkAddedIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getEnquiryStatusMeta } from '@/utils/enquiryStatus';
import { fetchAllCenters, getCenterLabel } from '@/utils/centerUtils';
import EnquiryProfileLink from '@/components/common/EnquiryProfileLink';
import { getBookingAdvancePaidDateForReport as getBookingAdvancePaidDate } from '@/utils/bookingAdvancePaidDate';

const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

const escapeCsv = (value: any) => {
  const s = (value ?? '').toString();
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const downloadCsv = (fileName: string, headers: string[], rows: any[][]) => {
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
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

function norm(str?: string | null) {
  return (str || '').toString().trim().toLowerCase();
}

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

/** Visit is a HA booking row and not a sale visit on the same row. */
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
  const products = Array.isArray(visit.products) ? visit.products : [];
  const first = products[0];
  const model =
    String(visit.hearingAidModel || ha.quotation || first?.name || '').trim() || '—';
  const brand = String(visit.hearingAidBrand || ha.whoSold || first?.company || '').trim() || '—';
  const bookingDate = String(
    visit.bookingDate || ha.bookingDate || visit.visitDate || ''
  ).trim();
  const bookingAdvance =
    Number(visit.bookingAdvanceAmount ?? ha.bookingAdvanceAmount ?? 0) || 0;
  const bookingQty = Math.max(1, Math.floor(Number(visit.bookingQuantity ?? 1)) || 1);
  const unitSelling =
    Number(
      visit.bookingSellingPrice ??
        ha.bookingSellingPrice ??
        ha.grossSalesBeforeTax ??
        0
    ) || 0;
  const unitMrpRaw = Number(
    first?.mrp ?? visit.hearingAidPrice ?? ha.mrp ?? visit.bookingMRP ?? ha.bookingMRP ?? 0,
  );
  const grossMrp = Number(visit.grossMRP ?? ha.grossMRP ?? 0);
  const unitMrp =
    unitMrpRaw ||
    (bookingQty > 0 && grossMrp > 0 ? grossMrp / bookingQty : grossMrp > 0 ? grossMrp : 0);

  return {
    bookingDate: bookingDate || '—',
    brand,
    model,
    unitMrp,
    bookingQty,
    unitSelling,
    bookingAdvance,
  };
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

type Row = {
  id: string;
  name: string;
  phone: string;
  email: string;
  assignedTo: string;
  centerId: string;
  centerDisplay: string;
  bookingDate: string;
  brand: string;
  model: string;
  unitMrp: number;
  qty: number;
  unitSelling: number;
  /** MRP × qty — weight for weighted avg discount. */
  lineMrp: number;
  /** (unit MRP − unit selling) × qty when MRP &gt; 0. */
  lineDiscountRupee: number;
  advance: number;
  advancePaidDate: string;
};

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export default function BookedEnquiriesReportTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, centersList] = await Promise.all([
        getDocs(collection(db, 'enquiries')),
        fetchAllCenters(),
      ]);
      const list: Row[] = [];

      for (const d of snap.docs) {
        const e: any = d.data();
        if (!isLiveBookedEnquiry({ ...e, id: d.id })) continue;

        const schedules = getSchedules(e);
        const bv = pickLatestBookingVisit(schedules);
        if (!bv) continue;

        const det = extractBookingDetails(bv);
        const centerId = (e.center || '').toString().trim();
        const um = Number(det.unitMrp) || 0;
        const us = Number(det.unitSelling) || 0;
        const q = Math.max(1, Math.floor(Number(det.bookingQty) || 1));
        const lineMrp = um > 0 ? um * q : 0;
        const lineDiscountRupee = um > 0 ? Math.max(0, um - us) * q : 0;

        list.push({
          id: d.id,
          name: (e.name || e.patientName || e.fullName || '—').toString(),
          phone: (e.phone || '').toString(),
          email: (e.email || '').toString(),
          assignedTo: (e.assignedTo || '').toString(),
          centerId,
          centerDisplay: getCenterLabel(centerId, centersList),
          bookingDate: det.bookingDate,
          brand: det.brand,
          model: det.model,
          unitMrp: det.unitMrp,
          qty: det.bookingQty,
          unitSelling: det.unitSelling,
          lineMrp,
          lineDiscountRupee,
          advance: det.bookingAdvance,
          advancePaidDate:
            det.bookingAdvance > 0
              ? getBookingAdvancePaidDate({ ...e, id: d.id }, bv)
              : '—',
        });
      }

      list.sort((a, b) => a.name.localeCompare(b.name));
      setRows(list);
    } catch (err) {
      console.error('Booked report: failed to fetch enquiries', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const assignedToOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const v = (r.assignedTo || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const search = norm(searchText);
    return rows.filter((r) => {
      if (assignedToFilter !== 'all' && norm(r.assignedTo) !== norm(assignedToFilter)) {
        return false;
      }
      if (search) {
        const haystack = [
          r.name,
          r.phone,
          r.email,
          r.assignedTo,
          r.id,
          r.brand,
          r.model,
          r.bookingDate,
          r.centerDisplay,
          r.centerId,
          r.advancePaidDate,
        ]
          .map((v) => (v || '').toString())
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [rows, assignedToFilter, searchText]);

  const exportCsv = () => {
    const headers = [
      'Enquiry ID',
      'Name',
      'Phone',
      'Email',
      'Center',
      'Assigned To',
      'Booking date',
      'Company',
      'Model',
      'MRP (unit)',
      'Qty',
      'Selling price (unit)',
      'Discount % vs MRP',
      'Booking advance',
      'Advance paid date',
    ];
    const out = filtered.map((r) => {
      const um = Number(r.unitMrp) || 0;
      const us = Number(r.unitSelling) || 0;
      const rowPct = um > 0 ? (100 * Math.max(0, um - us)) / um : '';
      return [
        r.id,
        r.name,
        r.phone,
        r.email,
        r.centerDisplay,
        r.assignedTo,
        r.bookingDate,
        r.brand,
        r.model,
        String(r.unitMrp),
        String(r.qty),
        String(r.unitSelling),
        rowPct === '' ? '' : `${Number(rowPct).toFixed(1)}%`,
        String(r.advance),
        r.advancePaidDate,
      ];
    });
    downloadCsv('booked-enquiries-report.csv', headers, out);
  };

  const summary = useMemo(() => {
    const count = filtered.length;
    const sumSelling = filtered.reduce(
      (s, r) => s + (Number(r.unitSelling) || 0) * (Number(r.qty) || 0),
      0,
    );
    const sumAdvance = filtered.reduce((s, r) => s + (Number(r.advance) || 0), 0);
    const sumLineMrp = filtered.reduce((s, r) => s + (r.lineMrp || 0), 0);
    const sumLineDiscount = filtered.reduce((s, r) => s + (r.lineDiscountRupee || 0), 0);
    const avgDiscountPct =
      sumLineMrp > 0 ? (100 * sumLineDiscount) / sumLineMrp : null;
    return { count, sumSelling, sumAdvance, sumLineMrp, avgDiscountPct };
  }, [filtered]);

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
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="booked-assigned-label">Assigned To</InputLabel>
              <Select
                labelId="booked-assigned-label"
                label="Assigned To"
                value={assignedToFilter}
                onChange={(e) => setAssignedToFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {assignedToOptions.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Name, phone, model, booking date…"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchRows}
              sx={{ height: 40 }}
            >
              Refresh
            </Button>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={exportCsv}
              sx={{ height: 40 }}
            >
              Export CSV
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} variant="outlined">
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BookmarkAddedIcon color="primary" />
            <Box>
              <Typography variant="h6">Booked Report</Typography>
              <Typography variant="body2" color="text.secondary">
                Active enquiries with a hearing-aid booking (latest booking visit per enquiry).
                Excludes sold / not interested / inactive.
              </Typography>
            </Box>
          </Box>
          <Chip
            label={`${filtered.length} record${filtered.length === 1 ? '' : 's'}`}
            color="primary"
            variant="outlined"
          />
        </Box>

        <Box sx={{ px: 2, pb: 2 }}>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Summary (filtered)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Bookings
                </Typography>
                <Typography variant="h6">{summary.count}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Total selling (qty × unit)
                </Typography>
                <Typography variant="h6">{formatMoney(summary.sumSelling)}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Total advance
                </Typography>
                <Typography variant="h6">{formatMoney(summary.sumAdvance)}</Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="caption" color="text.secondary">
                  Avg. discount vs MRP
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }} title="Σ(unit MRP − unit selling) × qty ÷ Σ(MRP × qty)">
                  {summary.avgDiscountPct != null ? `${summary.avgDiscountPct.toFixed(1)}%` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Weighted by booking line value
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>

        <TableContainer sx={{ maxHeight: 640, width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '15%' }}>Name</TableCell>
                <TableCell sx={{ width: '10%' }}>Phone</TableCell>
                <TableCell sx={{ width: '12%' }}>Center</TableCell>
                <TableCell sx={{ width: '11%' }}>Assigned</TableCell>
                <TableCell sx={{ width: '10%' }}>Booking date</TableCell>
                <TableCell sx={{ width: '24%' }}>Product</TableCell>
                <TableCell align="right" sx={{ width: '5%' }}>
                  Qty
                </TableCell>
                <TableCell align="right" sx={{ width: '8%' }}>
                  Selling
                </TableCell>
                <TableCell align="right" sx={{ width: '7%' }}>
                  Disc. %
                </TableCell>
                <TableCell align="right" sx={{ width: '11%' }}>
                  Advance
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length ? (
                filtered.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
                      <EnquiryProfileLink enquiryId={r.id}>{r.name}</EnquiryProfileLink>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{r.phone || '—'}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
                      {r.centerDisplay || '—'}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-word' }}>
                      {r.assignedTo || '—'}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{r.bookingDate}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
                        {r.brand}
                      </Typography>
                      <Typography variant="body2" color="text.primary" sx={{ mt: 0.25 }}>
                        {r.model}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        MRP {r.unitMrp > 0 ? formatMoney(r.unitMrp) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                      {r.qty}
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                      {formatMoney(r.unitSelling)}
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                      {r.unitMrp > 0
                        ? `${((100 * Math.max(0, r.unitMrp - r.unitSelling)) / r.unitMrp).toFixed(1)}%`
                        : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ verticalAlign: 'top' }}>
                      {r.advance > 0 ? (
                        <>
                          <Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
                            {formatMoney(r.advance)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Paid {r.advancePaidDate}
                          </Typography>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                    No booked enquiries match this filter.
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
