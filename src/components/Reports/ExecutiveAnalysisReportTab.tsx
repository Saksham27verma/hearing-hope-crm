'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
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
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { db } from '@/firebase/config';
import { getEnquiryStatusMeta } from '@/utils/enquiryStatus';
import EnquiryProfileLink from '@/components/common/EnquiryProfileLink';

type EnquiryStatusKey =
  | 'sold'
  | 'in_process'
  | 'bought_elsewhere'
  | 'not_interested'
  | 'tests_only';

type EnquiryDoc = {
  id: string;
  name: string;
  phone: string;
  assignedTo: string;
  createdAt: Date | null;
  statusKey: EnquiryStatusKey | null;
};

type ExecutiveRow = {
  executive: string;
  assignedCount: number;
  soldCount: number;
  inProcessCount: number;
  lostCount: number;
  irrelevantCount: number;
  testsOnlyCount: number;
};

const CHART_COLORS = {
  soldCount: '#2e7d32',
  inProcessCount: '#1565c0',
  lostCount: '#ed6c02',
  irrelevantCount: '#616161',
  testsOnlyCount: '#7b1fa2',
} as const;

const todayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthStartIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const parseDateStart = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseDateEnd = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value !== null) {
    const withToDate = value as { toDate?: () => Date };
    if (typeof withToDate.toDate === 'function') {
      const d = withToDate.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const withSeconds = value as { seconds?: number; _seconds?: number };
    const seconds = withSeconds.seconds ?? withSeconds._seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
};

const normalizeStatus = (rawKey: string): EnquiryStatusKey | null => {
  if (rawKey === 'sold') return 'sold';
  if (rawKey === 'in_process') return 'in_process';
  if (rawKey === 'bought_elsewhere') return 'bought_elsewhere';
  if (rawKey === 'not_interested') return 'not_interested';
  if (rawKey === 'tests_only') return 'tests_only';
  return null;
};

const statusLabel = (status: EnquiryStatusKey | null): string => {
  if (status === 'sold') return 'Sold';
  if (status === 'in_process') return 'In Process';
  if (status === 'bought_elsewhere') return 'Lost (Bought Elsewhere)';
  if (status === 'not_interested') return 'Irrelevant';
  if (status === 'tests_only') return 'Tests Only';
  return 'Other';
};

const escapeCsv = (value: string | number) => {
  const s = String(value ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const downloadCsv = (fileName: string, headers: string[], rows: Array<Array<string | number>>) => {
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

export default function ExecutiveAnalysisReportTab() {
  const [loading, setLoading] = useState<boolean>(true);
  const [enquiries, setEnquiries] = useState<EnquiryDoc[]>([]);
  const [fromDate, setFromDate] = useState<string>(monthStartIso());
  const [toDate, setToDate] = useState<string>(todayIso());
  const [executiveFilter, setExecutiveFilter] = useState<string>('all');

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'enquiries'));
      const normalized: EnquiryDoc[] = snap.docs.map((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>;
        const statusMeta = getEnquiryStatusMeta(raw);
        return {
          id: docSnap.id,
          name: String(raw.name || raw.patientName || raw.fullName || '—'),
          phone: String(raw.phone || ''),
          assignedTo: String(raw.assignedTo || '').trim() || 'Unassigned',
          createdAt: asDate(raw.createdAt),
          statusKey: normalizeStatus(statusMeta.key),
        };
      });
      setEnquiries(normalized);
    } catch (error) {
      console.error('Failed to fetch enquiries for Executive Analysis report:', error);
      setEnquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const filteredEnquiries = useMemo(() => {
    const start = parseDateStart(fromDate);
    const end = parseDateEnd(toDate);
    return enquiries.filter((enquiry) => {
      if (!enquiry.createdAt) return false;
      const t = enquiry.createdAt.getTime();
      if (start && t < start.getTime()) return false;
      if (end && t > end.getTime()) return false;
      return true;
    });
  }, [enquiries, fromDate, toDate]);

  const executiveOptions = useMemo(() => {
    return Array.from(new Set(filteredEnquiries.map((e) => e.assignedTo)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [filteredEnquiries]);

  const executiveFilteredEnquiries = useMemo(() => {
    if (executiveFilter === 'all') return filteredEnquiries;
    return filteredEnquiries.filter((e) => e.assignedTo === executiveFilter);
  }, [filteredEnquiries, executiveFilter]);

  const executiveRows = useMemo(() => {
    const map = new Map<string, ExecutiveRow>();
    for (const enquiry of executiveFilteredEnquiries) {
      const key = enquiry.assignedTo || 'Unassigned';
      const existing = map.get(key) || {
        executive: key,
        assignedCount: 0,
        soldCount: 0,
        inProcessCount: 0,
        lostCount: 0,
        irrelevantCount: 0,
        testsOnlyCount: 0,
      };

      existing.assignedCount += 1;
      if (enquiry.statusKey === 'sold') existing.soldCount += 1;
      if (enquiry.statusKey === 'in_process') existing.inProcessCount += 1;
      if (enquiry.statusKey === 'bought_elsewhere') existing.lostCount += 1;
      if (enquiry.statusKey === 'not_interested') existing.irrelevantCount += 1;
      if (enquiry.statusKey === 'tests_only') existing.testsOnlyCount += 1;

      map.set(key, existing);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.assignedCount !== a.assignedCount) return b.assignedCount - a.assignedCount;
      return a.executive.localeCompare(b.executive);
    });
  }, [executiveFilteredEnquiries]);

  const totals = useMemo(
    () =>
      executiveRows.reduce(
        (acc, row) => ({
          assigned: acc.assigned + row.assignedCount,
          sold: acc.sold + row.soldCount,
          inProcess: acc.inProcess + row.inProcessCount,
          lost: acc.lost + row.lostCount,
          irrelevant: acc.irrelevant + row.irrelevantCount,
          testsOnly: acc.testsOnly + row.testsOnlyCount,
        }),
        { assigned: 0, sold: 0, inProcess: 0, lost: 0, irrelevant: 0, testsOnly: 0 }
      ),
    [executiveRows]
  );

  const exportCsv = () => {
    const headers = [
      'Executive',
      'Assigned',
      'Sold',
      'In Process',
      'Lost (Bought Elsewhere)',
      'Irrelevant (Not Interested)',
      'Tests Only',
    ];
    const rows = executiveRows.map((r) => [
      r.executive,
      r.assignedCount,
      r.soldCount,
      r.inProcessCount,
      r.lostCount,
      r.irrelevantCount,
      r.testsOnlyCount,
    ]);
    downloadCsv('executive-analysis-report.csv', headers, rows);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' }, gap: 2 }}>
          <TextField
            type="date"
            size="small"
            label="From"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            size="small"
            label="To"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="executive-filter-label">Executive</InputLabel>
            <Select
              labelId="executive-filter-label"
              label="Executive"
              value={executiveFilter}
              onChange={(e) => setExecutiveFilter(e.target.value)}
            >
              <MenuItem value="all">All Executives</MenuItem>
              {executiveOptions.map((executive) => (
                <MenuItem key={executive} value={executive}>
                  {executive}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchEnquiries} sx={{ height: 40 }}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportCsv} sx={{ height: 40 }}>
            Export CSV
          </Button>
        </Box>
      </Paper>

      <Box
        sx={{
          mb: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
          gap: 1.5,
        }}
      >
        <Chip label={`Assigned: ${totals.assigned}`} color="primary" variant="outlined" />
        <Chip label={`Sold: ${totals.sold}`} sx={{ color: CHART_COLORS.soldCount, borderColor: CHART_COLORS.soldCount }} variant="outlined" />
        <Chip label={`In Process: ${totals.inProcess}`} sx={{ color: CHART_COLORS.inProcessCount, borderColor: CHART_COLORS.inProcessCount }} variant="outlined" />
        <Chip label={`Lost: ${totals.lost}`} sx={{ color: CHART_COLORS.lostCount, borderColor: CHART_COLORS.lostCount }} variant="outlined" />
        <Chip label={`Irrelevant: ${totals.irrelevant}`} sx={{ color: CHART_COLORS.irrelevantCount, borderColor: CHART_COLORS.irrelevantCount }} variant="outlined" />
        <Chip label={`Tests Only: ${totals.testsOnly}`} sx={{ color: CHART_COLORS.testsOnlyCount, borderColor: CHART_COLORS.testsOnlyCount }} variant="outlined" />
      </Box>

      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Executive Analysis
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enquiry funnel by executive for the selected timeline.
        </Typography>
        <Box sx={{ width: '100%', height: 420, overflowX: 'auto' }}>
          <Box sx={{ width: '100%', minWidth: Math.max(640, executiveRows.length * 84), height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={executiveRows} margin={{ top: 8, right: 18, left: 0, bottom: 58 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="executive"
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={82}
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Legend />
                <Bar stackId="status" dataKey="soldCount" name="Sold" fill={CHART_COLORS.soldCount} />
                <Bar stackId="status" dataKey="inProcessCount" name="In Process" fill={CHART_COLORS.inProcessCount} />
                <Bar stackId="status" dataKey="lostCount" name="Lost" fill={CHART_COLORS.lostCount} />
                <Bar stackId="status" dataKey="irrelevantCount" name="Irrelevant" fill={CHART_COLORS.irrelevantCount} />
                <Bar stackId="status" dataKey="testsOnlyCount" name="Tests Only" fill={CHART_COLORS.testsOnlyCount} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      </Paper>

      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Detailed Records
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {executiveFilter === 'all'
            ? 'Showing all executives. Select an executive to verify only their records.'
            : `Showing detailed records for ${executiveFilter}.`}
        </Typography>
        <TableContainer sx={{ maxHeight: 420, width: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow>
                <TableCell>Created At</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Executive</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executiveFilteredEnquiries.length > 0 ? (
                executiveFilteredEnquiries
                  .slice()
                  .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
                  .map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.createdAt ? row.createdAt.toLocaleString() : '—'}</TableCell>
                      <TableCell>
                        <EnquiryProfileLink enquiryId={row.id}>{row.name || '—'}</EnquiryProfileLink>
                      </TableCell>
                      <TableCell>{row.phone || '—'}</TableCell>
                      <TableCell>{row.assignedTo}</TableCell>
                      <TableCell>{statusLabel(row.statusKey)}</TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    No records found for selected timeline/executive.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper elevation={0} variant="outlined">
        <TableContainer sx={{ maxHeight: 560, width: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow>
                <TableCell>Executive</TableCell>
                <TableCell align="right">Assigned</TableCell>
                <TableCell align="right">Sold</TableCell>
                <TableCell align="right">In Process</TableCell>
                <TableCell align="right">Lost</TableCell>
                <TableCell align="right">Irrelevant</TableCell>
                <TableCell align="right">Tests Only</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executiveRows.length > 0 ? (
                executiveRows.map((row) => (
                  <TableRow key={row.executive} hover>
                    <TableCell>{row.executive}</TableCell>
                    <TableCell align="right">{row.assignedCount}</TableCell>
                    <TableCell align="right">{row.soldCount}</TableCell>
                    <TableCell align="right">{row.inProcessCount}</TableCell>
                    <TableCell align="right">{row.lostCount}</TableCell>
                    <TableCell align="right">{row.irrelevantCount}</TableCell>
                    <TableCell align="right">{row.testsOnlyCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    No enquiries found for selected timeline.
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
