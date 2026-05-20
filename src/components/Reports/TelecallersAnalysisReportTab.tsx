'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
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
import { alpha } from '@mui/material/styles';
import {
  Download as DownloadIcon,
  Phone as PhoneIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Sell as SellIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { db } from '@/firebase/config';
import {
  buildTelecallingAnalytics,
  namesMatchTelecaller,
  parseDateSafe,
  type TelecallerSummaryRow,
} from '@/lib/telecalling/telecallingAnalytics';
import { getTelecallerSelectOptions } from '@/utils/enquiryTelecallerOptions';
import { fetchStaffRecordsWithServerFallback } from '@/utils/fetchStaffForEnquiryForms';
import type { StaffRecord } from '@/utils/enquiryTelecallerOptions';

const CHART_COLORS = {
  calls: '#1565c0',
  dueCompleted: '#2e7d32',
  dueMissed: '#ed6c02',
  soldNow: '#6a1b9a',
  soldDuring: '#00838f',
  complianceHigh: '#2e7d32',
  complianceMid: '#f9a825',
  complianceLow: '#c62828',
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

const complianceBarColor = (pct: number) => {
  if (pct >= 80) return CHART_COLORS.complianceHigh;
  if (pct >= 50) return CHART_COLORS.complianceMid;
  return CHART_COLORS.complianceLow;
};

const formatPct = (v: number | null) => (v == null ? '—' : `${v}%`);

type CallerDailyReportRow = {
  telecaller: string;
  date: string;
  duesDue: number;
  duesCalled: number;
  callsLogged: number;
};

const formatDisplayDate = (ymd: string) => {
  const d = parseDateSafe(ymd);
  return d ? format(d, 'dd MMM yyyy') : ymd;
};

function ChartShell({
  title,
  subtitle,
  children,
  minHeight = 380,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  minHeight?: number;
}) {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{
        p: 0,
        mb: 2,
        overflow: 'hidden',
        borderRadius: 2,
        borderColor: 'divider',
        background: (t) =>
          t.palette.mode === 'dark'
            ? 'linear-gradient(165deg, rgba(30,40,55,0.92) 0%, rgba(18,22,28,0.98) 100%)'
            : 'linear-gradient(165deg, #f8fafc 0%, #ffffff 55%, #f1f5f9 100%)',
      }}
    >
      <Box sx={{ px: 2.5, pt: 2, pb: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {subtitle}
        </Typography>
      </Box>
      <Box sx={{ width: '100%', height: minHeight, px: 1, pb: 2 }}>{children}</Box>
    </Paper>
  );
}

export default function TelecallersAnalysisReportTab() {
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(monthStartIso());
  const [toDate, setToDate] = useState(todayIso());
  const [telecallerFilter, setTelecallerFilter] = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [enquiriesRaw, setEnquiriesRaw] = useState<Array<{ id: string; data: Record<string, unknown> }>>(
    []
  );
  const [appointmentsRaw, setAppointmentsRaw] = useState<
    Array<{ id: string; data: Record<string, unknown> }>
  >([]);
  const [centerIdToName, setCenterIdToName] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [enquiriesSnap, appointmentsSnap, centersSnap, staff] = await Promise.all([
        getDocs(collection(db, 'enquiries')),
        getDocs(collection(db, 'appointments')),
        getDocs(collection(db, 'centers')),
        fetchStaffRecordsWithServerFallback(),
      ]);

      const centerMap: Record<string, string> = {};
      centersSnap.forEach((cDoc) => {
        const nm = (cDoc.data() as { name?: string }).name?.trim();
        centerMap[cDoc.id] = nm || cDoc.id;
      });
      setCenterIdToName(centerMap);

      setEnquiriesRaw(
        enquiriesSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
      );
      setAppointmentsRaw(
        appointmentsSnap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }))
      );
      setStaffList(staff);
    } catch (error) {
      console.error('Telecallers Analysis fetch failed:', error);
      setEnquiriesRaw([]);
      setAppointmentsRaw([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const analytics = useMemo(
    () =>
      buildTelecallingAnalytics({
        enquiries: enquiriesRaw,
        appointments: appointmentsRaw,
        centerIdToName,
        fromDate,
        toDate,
      }),
    [enquiriesRaw, appointmentsRaw, centerIdToName, fromDate, toDate]
  );

  const telecallerOptions = useMemo(() => {
    const fromStaff = getTelecallerSelectOptions(staffList);
    const merged = new Set([...fromStaff, ...analytics.telecallerOptions]);
    return Array.from(merged).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [staffList, analytics.telecallerOptions]);

  const filteredCalls = useMemo(() => {
    return analytics.callEvents.filter((ev) => {
      if (telecallerFilter !== 'all' && ev.telecaller !== telecallerFilter) return false;
      if (centerFilter !== 'all' && ev.centerLabel !== centerFilter) return false;
      return true;
    });
  }, [analytics.callEvents, telecallerFilter, centerFilter]);

  const filteredDues = useMemo(() => {
    return analytics.dueObligations.filter((d) => {
      if (telecallerFilter !== 'all' && d.telecaller !== telecallerFilter) return false;
      if (centerFilter !== 'all' && d.centerLabel !== centerFilter) return false;
      return true;
    });
  }, [analytics.dueObligations, telecallerFilter, centerFilter]);

  const summaryRows = useMemo(() => {
    const map = new Map<string, TelecallerSummaryRow>();

    const ensure = (name: string): TelecallerSummaryRow => {
      const existing = map.get(name);
      if (existing) return existing;
      const row: TelecallerSummaryRow = {
        telecaller: name,
        callsLogged: 0,
        activeDays: 0,
        dueScheduled: 0,
        dueCompleted: 0,
        dueMissed: 0,
        compliancePct: null,
        overdueNow: 0,
        enquiriesTouched: 0,
        soldNowCount: 0,
        soldDuringPeriodCount: 0,
        soldNowPct: null,
        soldDuringPeriodPct: null,
      };
      map.set(name, row);
      return row;
    };

    const activeDays = new Map<string, Set<string>>();
    const touched = new Map<string, Set<string>>();
    const soldNow = new Map<string, Set<string>>();
    const soldDuring = new Map<string, Set<string>>();

    for (const ev of filteredCalls) {
      const row = ensure(ev.telecaller);
      row.callsLogged += 1;
      const days = activeDays.get(ev.telecaller) || new Set();
      days.add(ev.callDateYmd);
      activeDays.set(ev.telecaller, days);
      const t = touched.get(ev.telecaller) || new Set();
      t.add(ev.enquiryId);
      touched.set(ev.telecaller, t);
      if (ev.soldNow) {
        const s = soldNow.get(ev.telecaller) || new Set();
        s.add(ev.enquiryId);
        soldNow.set(ev.telecaller, s);
      }
      if (ev.soldDuringPeriod) {
        const s = soldDuring.get(ev.telecaller) || new Set();
        s.add(ev.enquiryId);
        soldDuring.set(ev.telecaller, s);
      }
    }

    for (const due of filteredDues) {
      const row = ensure(due.telecaller);
      row.dueScheduled += 1;
      if (due.completed) row.dueCompleted += 1;
      else row.dueMissed += 1;
      if (due.overdueNow) row.overdueNow += 1;
    }

    for (const [name, row] of map) {
      row.activeDays = activeDays.get(name)?.size ?? 0;
      row.enquiriesTouched = touched.get(name)?.size ?? 0;
      row.soldNowCount = soldNow.get(name)?.size ?? 0;
      row.soldDuringPeriodCount = soldDuring.get(name)?.size ?? 0;
      row.compliancePct =
        row.dueScheduled > 0 ? Math.round((row.dueCompleted / row.dueScheduled) * 1000) / 10 : null;
      row.soldNowPct =
        row.enquiriesTouched > 0
          ? Math.round((row.soldNowCount / row.enquiriesTouched) * 1000) / 10
          : null;
      row.soldDuringPeriodPct =
        row.enquiriesTouched > 0
          ? Math.round((row.soldDuringPeriodCount / row.enquiriesTouched) * 1000) / 10
          : null;
    }

    let rows = Array.from(map.values()).sort((a, b) => b.callsLogged - a.callsLogged);
    if (telecallerFilter !== 'all') {
      rows = rows.filter((r) => r.telecaller === telecallerFilter);
    }
    return rows;
  }, [filteredCalls, filteredDues, telecallerFilter]);

  /** Assigned telecallers who logged calls on their own assigned enquiries in this period. */
  const assignedTelecallersWithOwnCalls = useMemo(() => {
    const names = new Set<string>();
    for (const ev of filteredCalls) {
      if (!ev.assignedTelecaller) continue;
      if (!namesMatchTelecaller(ev.telecaller, ev.assignedTelecaller)) continue;
      names.add(ev.assignedTelecaller);
    }
    return names;
  }, [filteredCalls]);

  const dueStatsByAssignedTelecaller = useMemo(() => {
    const map = new Map<string, { scheduled: number; completed: number }>();
    for (const due of filteredDues) {
      const cur = map.get(due.telecaller) || { scheduled: 0, completed: 0 };
      cur.scheduled += 1;
      if (due.completed) cur.completed += 1;
      map.set(due.telecaller, cur);
    }
    return map;
  }, [filteredDues]);

  const teamTotals = useMemo(() => {
    const totalCalls = filteredCalls.length;
    const activeTelecallers = new Set(filteredCalls.map((c) => c.telecaller)).size;
    const activeDays = new Set(filteredCalls.map((c) => c.callDateYmd)).size;
    const assignedDues = filteredDues.filter((d) =>
      assignedTelecallersWithOwnCalls.has(d.telecaller)
    );
    const dueScheduled = assignedDues.length;
    const dueCompleted = assignedDues.filter((d) => d.completed).length;
    const compliancePct =
      dueScheduled > 0 ? Math.round((dueCompleted / dueScheduled) * 1000) / 10 : null;
    const soldNow = new Set(
      filteredCalls.filter((c) => c.soldNow).map((c) => c.enquiryId)
    ).size;
    const soldDuring = new Set(
      filteredCalls.filter((c) => c.soldDuringPeriod).map((c) => c.enquiryId)
    ).size;
    return {
      totalCalls,
      activeTelecallers,
      avgCallsPerDay: activeDays > 0 ? Math.round((totalCalls / activeDays) * 10) / 10 : 0,
      compliancePct,
      soldNow,
      soldDuring,
    };
  }, [filteredCalls, filteredDues, assignedTelecallersWithOwnCalls]);

  const dailyChartData = useMemo(() => {
    const byDate = new Map<string, { date: string; calls: number; duesDue: number; duesCompleted: number }>();
    for (const ev of filteredCalls) {
      const existing = byDate.get(ev.callDateYmd) || {
        date: ev.callDateYmd,
        calls: 0,
        duesDue: 0,
        duesCompleted: 0,
      };
      existing.calls += 1;
      byDate.set(ev.callDateYmd, existing);
    }
    for (const due of filteredDues) {
      const existing = byDate.get(due.dueDateYmd) || {
        date: due.dueDateYmd,
        calls: 0,
        duesDue: 0,
        duesCompleted: 0,
      };
      existing.duesDue += 1;
      if (due.completed) existing.duesCompleted += 1;
      byDate.set(due.dueDateYmd, existing);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredCalls, filteredDues]);

  const dueDisciplineChart = useMemo(
    () =>
      Array.from(assignedTelecallersWithOwnCalls)
        .map((telecaller) => {
          const stats = dueStatsByAssignedTelecaller.get(telecaller);
          const scheduled = stats?.scheduled ?? 0;
          const completed = stats?.completed ?? 0;
          return {
            telecaller,
            dueCompleted: completed,
            dueMissed: Math.max(0, scheduled - completed),
          };
        })
        .filter((r) => r.dueCompleted + r.dueMissed > 0)
        .sort((a, b) => b.dueCompleted + b.dueMissed - (a.dueCompleted + a.dueMissed)),
    [assignedTelecallersWithOwnCalls, dueStatsByAssignedTelecaller]
  );

  const complianceChart = useMemo(() => {
    const rows: Array<{ telecaller: string; compliancePct: number }> = [];
    for (const telecaller of assignedTelecallersWithOwnCalls) {
      const stats = dueStatsByAssignedTelecaller.get(telecaller);
      if (!stats || stats.scheduled === 0) continue;
      rows.push({
        telecaller,
        compliancePct: Math.round((stats.completed / stats.scheduled) * 1000) / 10,
      });
    }
    return rows.sort((a, b) => b.compliancePct - a.compliancePct);
  }, [assignedTelecallersWithOwnCalls, dueStatsByAssignedTelecaller]);

  const soldChart = useMemo(
    () =>
      summaryRows.map((r) => ({
        telecaller: r.telecaller,
        soldNow: r.soldNowCount,
        soldDuring: r.soldDuringPeriodCount,
      })),
    [summaryRows]
  );

  const callerDailyRows = useMemo(() => {
    const key = (telecaller: string, date: string) => `${telecaller}|${date}`;
    const map = new Map<string, CallerDailyReportRow>();

    const ensure = (telecaller: string, date: string): CallerDailyReportRow => {
      const k = key(telecaller, date);
      const existing = map.get(k);
      if (existing) return existing;
      const row: CallerDailyReportRow = {
        telecaller,
        date,
        duesDue: 0,
        duesCalled: 0,
        callsLogged: 0,
      };
      map.set(k, row);
      return row;
    };

    for (const due of filteredDues) {
      if (!assignedTelecallersWithOwnCalls.has(due.telecaller)) continue;
      if (telecallerFilter !== 'all' && due.telecaller !== telecallerFilter) continue;
      const row = ensure(due.telecaller, due.dueDateYmd);
      row.duesDue += 1;
      if (due.completed) row.duesCalled += 1;
    }

    for (const ev of filteredCalls) {
      if (!ev.assignedTelecaller) continue;
      if (!namesMatchTelecaller(ev.telecaller, ev.assignedTelecaller)) continue;
      if (!assignedTelecallersWithOwnCalls.has(ev.assignedTelecaller)) continue;
      if (telecallerFilter !== 'all' && ev.assignedTelecaller !== telecallerFilter) continue;
      const row = ensure(ev.assignedTelecaller, ev.callDateYmd);
      row.callsLogged += 1;
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.telecaller !== b.telecaller) return a.telecaller.localeCompare(b.telecaller);
      return b.date.localeCompare(a.date);
    });
  }, [
    filteredCalls,
    filteredDues,
    assignedTelecallersWithOwnCalls,
    telecallerFilter,
  ]);

  const callerDailyByTelecaller = useMemo(() => {
    const grouped = new Map<string, CallerDailyReportRow[]>();
    for (const row of callerDailyRows) {
      const list = grouped.get(row.telecaller) || [];
      list.push(row);
      grouped.set(row.telecaller, list);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [callerDailyRows]);

  const exportCsv = () => {
    const headers = [
      'Telecaller',
      'Calls Logged',
      'Active Days',
      'Due Scheduled',
      'Due Completed',
      'Due Missed',
      'Compliance %',
      'Overdue Now',
      'Enquiries Touched',
      'Sold Now',
      'Sold During Period',
      'Sold Now %',
      'Sold During Period %',
    ];
    const rows = summaryRows.map((r) => [
      r.telecaller,
      r.callsLogged,
      r.activeDays,
      r.dueScheduled,
      r.dueCompleted,
      r.dueMissed,
      formatPct(r.compliancePct),
      r.overdueNow,
      r.enquiriesTouched,
      r.soldNowCount,
      r.soldDuringPeriodCount,
      formatPct(r.soldNowPct),
      formatPct(r.soldDuringPeriodPct),
    ]);
    downloadCsv(`telecallers-analysis-${fromDate}-to-${toDate}.csv`, headers, rows);
  };

  const exportDailyCsv = () => {
    const headers = [
      'Telecaller',
      'Date',
      'Due on day',
      'Due called',
      'Due not called',
      'Calls logged',
    ];
    const rows = callerDailyRows.map((r) => [
      r.telecaller,
      r.date,
      r.duesDue,
      r.duesCalled,
      Math.max(0, r.duesDue - r.duesCalled),
      r.callsLogged,
    ]);
    downloadCsv(`telecallers-daily-${fromDate}-to-${toDate}.csv`, headers, rows);
  };

  const telecallingLink = (telecaller: string) =>
    `/telecalling-records?telecaller=${encodeURIComponent(telecaller)}&quickFilter=last_month_calls`;

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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(6, 1fr)' },
            gap: 2,
            alignItems: 'end',
          }}
        >
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
            <InputLabel id="tc-filter-label">Telecaller</InputLabel>
            <Select
              labelId="tc-filter-label"
              label="Telecaller"
              value={telecallerFilter}
              onChange={(e) => setTelecallerFilter(e.target.value)}
            >
              <MenuItem value="all">All Telecallers</MenuItem>
              {telecallerOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="center-filter-label">Center</InputLabel>
            <Select
              labelId="center-filter-label"
              label="Center"
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
            >
              <MenuItem value="all">All Centers</MenuItem>
              {analytics.centerOptions.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData} sx={{ height: 40 }}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={exportCsv} sx={{ height: 40 }}>
            Export CSV
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          {
            label: 'Calls Logged',
            value: teamTotals.totalCalls,
            icon: <PhoneIcon />,
            color: 'primary.main',
          },
          {
            label: 'Active Telecallers',
            value: teamTotals.activeTelecallers,
            icon: <TrendingUpIcon />,
            color: 'secondary.main',
          },
          {
            label: 'Avg Calls / Active Day',
            value: teamTotals.avgCallsPerDay,
            icon: <TrendingUpIcon />,
            color: 'info.main',
          },
          {
            label: 'Due Compliance',
            value: formatPct(teamTotals.compliancePct),
            icon: <CheckCircleIcon />,
            color: 'success.main',
          },
          {
            label: 'Sold Now (enquiries)',
            value: teamTotals.soldNow,
            icon: <SellIcon />,
            color: 'success.dark',
          },
          {
            label: 'Sold During Period',
            value: teamTotals.soldDuring,
            icon: <SellIcon />,
            color: 'warning.main',
          },
        ].map((card) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={card.label}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
              }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                      color: card.color,
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      {card.value}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.label}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {dailyChartData.length === 0 && summaryRows.length === 0 ? (
        <AlertEmpty fromDate={fromDate} toDate={toDate} />
      ) : (
        <>
          <ChartShell
            title="Daily Calls"
            subtitle={
              telecallerFilter === 'all'
                ? 'Total calls logged per day across selected telecallers.'
                : `Calls per day for ${telecallerFilter}.`
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChartData} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <RechartsTooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="calls"
                  name="Calls"
                  stroke={CHART_COLORS.calls}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartShell>

          <Grid container spacing={2}>
            <Grid item xs={12} lg={6}>
              <ChartShell
                title="Due Call Discipline"
                subtitle="Completed vs missed due obligations scheduled in the selected period."
                minHeight={360}
              >
                {dueDisciplineChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dueDisciplineChart} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="telecaller"
                        interval={0}
                        angle={-28}
                        textAnchor="end"
                        height={72}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar
                        stackId="due"
                        dataKey="dueCompleted"
                        name="Completed"
                        fill={CHART_COLORS.dueCompleted}
                      />
                      <Bar stackId="due" dataKey="dueMissed" name="Missed" fill={CHART_COLORS.dueMissed} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartMessage />
                )}
              </ChartShell>
            </Grid>
            <Grid item xs={12} lg={6}>
              <ChartShell
                title="Due Compliance %"
                subtitle="Only staff listed as Telecaller on an enquiry who logged calls on those same enquiries, with due compliance from their assigned leads only."
                minHeight={360}
              >
                {complianceChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={complianceChart}
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" />
                      <YAxis type="category" dataKey="telecaller" width={100} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={(v: number) => [`${v}%`, 'Compliance']} />
                      <Bar dataKey="compliancePct" name="Compliance %" radius={[0, 4, 4, 0]}>
                        {complianceChart.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={complianceBarColor(entry.compliancePct)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartMessage />
                )}
              </ChartShell>
            </Grid>
          </Grid>

          <ChartShell
            title="Sold Outcomes"
            subtitle="Distinct enquiries called in period: currently Sold vs became Sold during the period."
            minHeight={360}
          >
            {soldChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={soldChart} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="telecaller"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={72}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="soldNow" name="Sold Now" fill={CHART_COLORS.soldNow} />
                  <Bar dataKey="soldDuring" name="Sold During Period" fill={CHART_COLORS.soldDuring} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartMessage />
            )}
          </ChartShell>

          <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Telecaller Performance Summary
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click a telecaller name to open their records in Telecalling.
            </Typography>
            <TableContainer sx={{ maxHeight: 480, overflowX: 'auto' }}>
              <Table size="small" stickyHeader sx={{ minWidth: 1100 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Telecaller</TableCell>
                    <TableCell align="right">Calls</TableCell>
                    <TableCell align="right">Active Days</TableCell>
                    <TableCell align="right">Due Sched.</TableCell>
                    <TableCell align="right">Completed</TableCell>
                    <TableCell align="right">Compliance</TableCell>
                    <TableCell align="right">Overdue</TableCell>
                    <TableCell align="right">Touched</TableCell>
                    <TableCell align="right">Sold Now</TableCell>
                    <TableCell align="right">Sold In Period</TableCell>
                    <TableCell align="right">Sold Now %</TableCell>
                    <TableCell align="right">Sold In Period %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summaryRows.length > 0 ? (
                    summaryRows.map((row) => (
                      <TableRow key={row.telecaller} hover>
                        <TableCell>
                          <Link
                            href={telecallingLink(row.telecaller)}
                            style={{ textDecoration: 'none', color: 'inherit', fontWeight: 600 }}
                          >
                            {row.telecaller}
                          </Link>
                        </TableCell>
                        <TableCell align="right">{row.callsLogged}</TableCell>
                        <TableCell align="right">{row.activeDays}</TableCell>
                        <TableCell align="right">{row.dueScheduled}</TableCell>
                        <TableCell align="right">{row.dueCompleted}</TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={formatPct(row.compliancePct)}
                            color={
                              row.compliancePct == null
                                ? 'default'
                                : row.compliancePct >= 80
                                  ? 'success'
                                  : row.compliancePct >= 50
                                    ? 'warning'
                                    : 'error'
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {row.overdueNow > 0 ? (
                            <Chip
                              size="small"
                              icon={<WarningIcon />}
                              label={row.overdueNow}
                              color="warning"
                              variant="outlined"
                            />
                          ) : (
                            '0'
                          )}
                        </TableCell>
                        <TableCell align="right">{row.enquiriesTouched}</TableCell>
                        <TableCell align="right">{row.soldNowCount}</TableCell>
                        <TableCell align="right">{row.soldDuringPeriodCount}</TableCell>
                        <TableCell align="right">{formatPct(row.soldNowPct)}</TableCell>
                        <TableCell align="right">{formatPct(row.soldDuringPeriodPct)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 3 }}>
                        No telecaller activity in the selected range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {callerDailyRows.length > 0 && (
            <Paper elevation={0} variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  mb: 2,
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>
                    Caller-wise Daily Report
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    For each day: follow-ups due that date on their assigned enquiries, how many
                    were called (logged on or after due time), and how many calls they logged that
                    day.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={exportDailyCsv}
                >
                  Export daily CSV
                </Button>
              </Box>

              {telecallerFilter === 'all' ? (
                callerDailyByTelecaller.map(([telecaller, rows]) => (
                  <Box key={telecaller} sx={{ mb: 3 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}
                    >
                      <Link
                        href={telecallingLink(telecaller)}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {telecaller}
                      </Link>
                    </Typography>
                    <CallerDailyTable rows={rows} showTelecaller={false} />
                  </Box>
                ))
              ) : (
                <CallerDailyTable rows={callerDailyRows} showTelecaller={false} />
              )}
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

function CallerDailyTable({
  rows,
  showTelecaller,
}: {
  rows: CallerDailyReportRow[];
  showTelecaller: boolean;
}) {
  return (
    <TableContainer sx={{ maxHeight: 420, overflowX: 'auto' }}>
      <Table size="small" stickyHeader sx={{ minWidth: showTelecaller ? 640 : 520 }}>
        <TableHead>
          <TableRow>
            {showTelecaller ? <TableCell>Telecaller</TableCell> : null}
            <TableCell>Date</TableCell>
            <TableCell align="right">Due on day</TableCell>
            <TableCell align="right">Due called</TableCell>
            <TableCell align="right">Due not called</TableCell>
            <TableCell align="right">Calls logged</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const notCalled = Math.max(0, row.duesDue - row.duesCalled);
            return (
              <TableRow key={`${row.telecaller}-${row.date}`} hover>
                {showTelecaller ? <TableCell>{row.telecaller}</TableCell> : null}
                <TableCell>{formatDisplayDate(row.date)}</TableCell>
                <TableCell align="right">{row.duesDue}</TableCell>
                <TableCell align="right">
                  {row.duesCalled > 0 ? (
                    <Chip size="small" label={row.duesCalled} color="success" variant="outlined" />
                  ) : (
                    '0'
                  )}
                </TableCell>
                <TableCell align="right">
                  {notCalled > 0 ? (
                    <Chip size="small" label={notCalled} color="warning" variant="outlined" />
                  ) : (
                    '0'
                  )}
                </TableCell>
                <TableCell align="right">
                  <strong>{row.callsLogged}</strong>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function EmptyChartMessage() {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      height="100%"
      color="text.secondary"
    >
      <Typography variant="body2">No data for the selected filters.</Typography>
    </Box>
  );
}

function AlertEmpty({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  return (
    <Paper elevation={0} variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h6" gutterBottom>
        No telecalling activity found
      </Typography>
      <Typography variant="body2" color="text.secondary">
        No follow-up calls were logged between {fromDate} and {toDate}. Try widening the date range or
        confirm telecallers are logging calls on enquiries.
      </Typography>
    </Paper>
  );
}
