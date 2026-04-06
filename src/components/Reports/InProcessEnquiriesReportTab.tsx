/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
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
  PendingActions as PendingActionsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getEnquiryStatusMeta } from '@/utils/enquiryStatus';
import { fetchAllCenters, getCenterLabel } from '@/utils/centerUtils';
import EnquiryProfileLink from '@/components/common/EnquiryProfileLink';
import type { EnquiryJourneyStatus } from '@/utils/enquiryStatus';

const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

const IN_PROCESS_KEYS = new Set<EnquiryJourneyStatus>(['in_process', 'in_trial', 'tests_only']);

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

function getNextFollowUpDate(enquiry: any): string | null {
  const list = Array.isArray(enquiry.followUps) ? enquiry.followUps : [];
  const dates = list
    .map((f: any) => String(f?.nextFollowUpDate || '').trim())
    .filter(Boolean);
  if (!dates.length) return null;
  dates.sort();
  return dates[0];
}

function getSchedules(enquiry: any): any[] {
  if (Array.isArray(enquiry.visitSchedules) && enquiry.visitSchedules.length > 0) {
    return enquiry.visitSchedules;
  }
  if (Array.isArray(enquiry.visits) && enquiry.visits.length > 0) {
    return enquiry.visits;
  }
  return [];
}

function getLastVisitDate(enquiry: any): string | null {
  const schedules = getSchedules(enquiry);
  let max = '';
  for (const v of schedules) {
    const d = String(v?.visitDate || v?.date || '').trim();
    if (d && d > max) max = d;
  }
  return max || null;
}

/** Notes from the most recent visit (by visit date string). */
function getLatestVisitNotes(enquiry: any): string {
  const schedules = getSchedules(enquiry);
  if (!schedules.length) return '';
  const sorted = [...schedules].sort((a, b) => {
    const da = String(a?.visitDate || a?.date || '').trim();
    const db = String(b?.visitDate || b?.date || '').trim();
    return db.localeCompare(da);
  });
  const first = sorted[0];
  return String(first?.visitNotes ?? first?.notes ?? '').trim();
}

/** Chronological follow-up log (date · caller · remarks). */
function buildFollowUpsNotesText(enquiry: any): string {
  const list = Array.isArray(enquiry.followUps) ? enquiry.followUps : [];
  if (!list.length) return '';
  const sorted = [...list].sort((a, b) =>
    String(a?.date || '').localeCompare(String(b?.date || '')),
  );
  return sorted
    .map((f: any) => {
      const parts = [f.date, f.callerName, f.remarks].filter((x: string) => String(x || '').trim());
      return parts.join(' · ');
    })
    .filter(Boolean)
    .join('\n');
}

function hasAnyNotes(enquiryMessage: string, followUpNotes: string, visitNotes: string): boolean {
  return Boolean(
    enquiryMessage.trim() || followUpNotes.trim() || visitNotes.trim(),
  );
}

function isFollowUpOverdue(nextFollowUp: string | null): boolean {
  if (!nextFollowUp) return false;
  const d = nextFollowUp.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const today = new Date().toISOString().slice(0, 10);
  return d < today;
}

function isFollowUpDueWithinDays(nextFollowUp: string | null, days: number): boolean {
  if (!nextFollowUp) return false;
  const raw = nextFollowUp.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const target = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(target.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return target >= start && target <= end;
}

type Row = {
  id: string;
  name: string;
  phone: string;
  email: string;
  assignedTo: string;
  telecaller: string;
  centerId: string;
  center: string;
  reference: string;
  createdAt: Date | null;
  journeyKey: EnquiryJourneyStatus;
  journeyLabel: string;
  journeyColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  journeySource: 'manual' | 'auto';
  nextFollowUp: string | null;
  lastVisit: string | null;
  enquiryMessage: string;
  followUpNotes: string;
  lastVisitNotes: string;
};

export default function InProcessEnquiriesReportTab() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [journeyFilter, setJourneyFilter] = useState<string>('all');
  const [telecallerFilter, setTelecallerFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [requireNextFollowUp, setRequireNextFollowUp] = useState(false);
  const [overdueFollowUpOnly, setOverdueFollowUpOnly] = useState(false);
  const [dueWithin7DaysOnly, setDueWithin7DaysOnly] = useState(false);
  const [hasNotesOnly, setHasNotesOnly] = useState(false);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, centersList] = await Promise.all([
        getDocs(collection(db, 'enquiries')),
        fetchAllCenters(),
      ]);
      const list: Row[] = snap.docs.map((d) => {
        const e: any = d.data();
        let createdAt: Date | null = null;
        if (e.createdAt?.toDate) {
          createdAt = e.createdAt.toDate();
        } else if (e.createdAt?._seconds) {
          createdAt = new Date(e.createdAt._seconds * 1000);
        }

        const meta = getEnquiryStatusMeta({ ...e, id: d.id });
        const ref = Array.isArray(e.reference)
          ? e.reference.join(' | ')
          : String(e.reference || '');
        const centerId = (e.center || '').toString().trim();
        const enquiryMessage = String(e.message || '').trim();
        const followUpNotes = buildFollowUpsNotesText(e);
        const lastVisitNotes = getLatestVisitNotes(e);

        return {
          id: d.id,
          name: (e.name || e.patientName || e.fullName || '—').toString(),
          phone: (e.phone || '').toString(),
          email: (e.email || '').toString(),
          assignedTo: (e.assignedTo || '').toString(),
          telecaller: (e.telecaller || '').toString(),
          centerId,
          center: getCenterLabel(centerId, centersList),
          reference: ref,
          createdAt,
          journeyKey: meta.key,
          journeyLabel: meta.label,
          journeyColor: meta.color,
          journeySource: meta.source,
          nextFollowUp: getNextFollowUpDate(e),
          lastVisit: getLastVisitDate(e),
          enquiryMessage,
          followUpNotes,
          lastVisitNotes,
        };
      });

      const pipeline = list.filter((r) => IN_PROCESS_KEYS.has(r.journeyKey));
      pipeline.sort((a, b) => {
        const ta = a.createdAt?.getTime() ?? 0;
        const tb = b.createdAt?.getTime() ?? 0;
        return tb - ta;
      });
      setRows(pipeline);
    } catch (err) {
      console.error('In-process report: failed to fetch enquiries', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const assignedToOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const v = (r.assignedTo || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const centerOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.centerId) map.set(r.centerId, r.center || r.centerId);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const telecallerOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const v = (r.telecaller || '').trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const journeyOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.journeyKey, r.journeyLabel));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const search = norm(searchText);
    return rows.filter((r) => {
      if (assignedToFilter !== 'all' && norm(r.assignedTo) !== norm(assignedToFilter)) {
        return false;
      }
      if (centerFilter !== 'all' && r.centerId !== centerFilter) return false;
      if (journeyFilter !== 'all' && r.journeyKey !== journeyFilter) return false;
      if (telecallerFilter !== 'all' && norm(r.telecaller) !== norm(telecallerFilter)) {
        return false;
      }
      if (requireNextFollowUp && !r.nextFollowUp) return false;
      if (overdueFollowUpOnly && !isFollowUpOverdue(r.nextFollowUp)) return false;
      if (dueWithin7DaysOnly && !isFollowUpDueWithinDays(r.nextFollowUp, 7)) return false;
      if (hasNotesOnly && !hasAnyNotes(r.enquiryMessage, r.followUpNotes, r.lastVisitNotes)) {
        return false;
      }

      if (search) {
        const haystack = [
          r.name,
          r.phone,
          r.email,
          r.assignedTo,
          r.telecaller,
          r.reference,
          r.id,
          r.journeyLabel,
          r.center,
          r.enquiryMessage,
          r.followUpNotes,
          r.lastVisitNotes,
        ]
          .map((v) => (v || '').toString())
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [
    rows,
    assignedToFilter,
    centerFilter,
    journeyFilter,
    telecallerFilter,
    searchText,
    requireNextFollowUp,
    overdueFollowUpOnly,
    dueWithin7DaysOnly,
    hasNotesOnly,
  ]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const withFollowUp = filtered.filter((r) => !!r.nextFollowUp).length;
    const overdue = filtered.filter((r) => isFollowUpOverdue(r.nextFollowUp)).length;
    return { total, withFollowUp, overdue };
  }, [filtered]);

  const exportCsv = () => {
    const headers = [
      'Enquiry ID',
      'Journey',
      'Tag source',
      'Created At',
      'Name',
      'Phone',
      'Email',
      'Enquiry message',
      'Follow-up notes',
      'Last visit notes',
      'Next follow-up',
      'Last visit',
      'Assigned To',
      'Telecaller',
      'Center',
      'Reference',
    ];
    const out = filtered.map((r) => [
      r.id,
      r.journeyLabel,
      r.journeySource === 'manual' ? 'Manual' : 'Automatic',
      r.createdAt ? r.createdAt.toLocaleString() : '',
      r.name,
      r.phone,
      r.email,
      r.enquiryMessage,
      r.followUpNotes,
      r.lastVisitNotes,
      r.nextFollowUp || '',
      r.lastVisit || '',
      r.assignedTo,
      r.telecaller,
      r.center,
      r.reference,
    ]);
    downloadCsv('in-process-enquiries-report.csv', headers, out);
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
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="inproc-assigned-label">Assigned To</InputLabel>
              <Select
                labelId="inproc-assigned-label"
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

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="inproc-center-label">Center</InputLabel>
              <Select
                labelId="inproc-center-label"
                label="Center"
                value={centerFilter}
                onChange={(e) => setCenterFilter(e.target.value)}
              >
                <MenuItem value="all">All centers</MenuItem>
                {centerOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="inproc-journey-label">Journey</InputLabel>
              <Select
                labelId="inproc-journey-label"
                label="Journey"
                value={journeyFilter}
                onChange={(e) => setJourneyFilter(e.target.value)}
              >
                <MenuItem value="all">All stages</MenuItem>
                {journeyOptions.map(([key, label]) => (
                  <MenuItem key={key} value={key}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel id="inproc-tc-label">Telecaller</InputLabel>
              <Select
                labelId="inproc-tc-label"
                label="Telecaller"
                value={telecallerFilter}
                onChange={(e) => setTelecallerFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {telecallerOptions.map((name) => (
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
              placeholder="Name, phone, notes, journey…"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchEnquiries}
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

          <Grid item xs={12}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Follow-up &amp; notes
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={requireNextFollowUp}
                    onChange={(e) => setRequireNextFollowUp(e.target.checked)}
                  />
                }
                label="Has next follow-up date"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={overdueFollowUpOnly}
                    onChange={(e) => setOverdueFollowUpOnly(e.target.checked)}
                  />
                }
                label="Follow-up overdue"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={dueWithin7DaysOnly}
                    onChange={(e) => setDueWithin7DaysOnly(e.target.checked)}
                  />
                }
                label="Due in next 7 days"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={hasNotesOnly}
                    onChange={(e) => setHasNotesOnly(e.target.checked)}
                  />
                }
                label="Has message / notes"
              />
            </Box>
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
            <PendingActionsIcon color="primary" />
            <Box>
              <Typography variant="h6">In-process &amp; follow-up</Typography>
              <Typography variant="body2" color="text.secondary">
                New, in process, and in-trial enquiries (excludes Booked, Sold, Completed, Not
                interested). Uses the same journey logic as the enquiries list.
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
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary">
                  In scope
                </Typography>
                <Typography variant="h6">{summary.total}</Typography>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary">
                  With next follow-up date
                </Typography>
                <Typography variant="h6">{summary.withFollowUp}</Typography>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Typography variant="caption" color="text.secondary">
                  Overdue follow-up (in filtered set)
                </Typography>
                <Typography variant="h6">{summary.overdue}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>

        <TableContainer sx={{ maxHeight: 600, width: '100%', overflowX: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '10%' }}>Journey</TableCell>
                <TableCell sx={{ width: '10%' }}>Name</TableCell>
                <TableCell sx={{ width: '8%' }}>Phone</TableCell>
                <TableCell sx={{ width: '28%' }}>Messages &amp; notes</TableCell>
                <TableCell sx={{ width: '8%' }}>Next follow-up</TableCell>
                <TableCell sx={{ width: '8%' }}>Last visit</TableCell>
                <TableCell sx={{ width: '8%' }}>Assigned</TableCell>
                <TableCell sx={{ width: '10%' }}>Center</TableCell>
                <TableCell sx={{ width: '10%' }}>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length ? (
                filtered.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      <Chip
                        label={r.journeyLabel}
                        color={r.journeyColor}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      {r.journeySource === 'manual' && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Manual tag
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ wordBreak: 'break-word', verticalAlign: 'top' }}>
                      <EnquiryProfileLink enquiryId={r.id}>{r.name}</EnquiryProfileLink>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{r.phone || '—'}</TableCell>
                    <TableCell
                      sx={{
                        verticalAlign: 'top',
                        maxWidth: 360,
                        wordBreak: 'break-word',
                      }}
                    >
                      <Box
                        sx={{
                          maxHeight: 200,
                          overflow: 'auto',
                          pr: 0.5,
                          fontSize: '0.8125rem',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" display="block">
                          Enquiry message
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                          {r.enquiryMessage || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Follow-up log
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                          {r.followUpNotes || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Last visit notes
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {r.lastVisitNotes || '—'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{r.nextFollowUp || '—'}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{r.lastVisit || '—'}</TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>{r.assignedTo || '—'}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-word', verticalAlign: 'top' }}>
                      {r.center || '—'}
                    </TableCell>
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {r.createdAt ? r.createdAt.toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                    No enquiries match this filter.
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
