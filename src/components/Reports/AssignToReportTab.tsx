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
import { Download as DownloadIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Avoid MUI Grid generic type noise by wrapping (consistent with other modules)
const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

type NormalizedEnquiry = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  assignedTo?: string;
  telecaller?: string;
  reference?: string | string[];
  center?: string;
  status?: string;
  createdAt?: Date | null;
};

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

function norm(str?: string | null) {
  return (str || '').toString().trim().toLowerCase();
}

export default function AssignToReportTab() {
  const [loading, setLoading] = useState(true);
  const [enquiries, setEnquiries] = useState<NormalizedEnquiry[]>([]);

  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'enquiries'));
      const list: NormalizedEnquiry[] = snap.docs.map(d => {
        const e: any = d.data();
        let createdAt: Date | null = null;
        if (e.createdAt?.toDate) {
          createdAt = e.createdAt.toDate();
        } else if (e.createdAt?._seconds) {
          createdAt = new Date(e.createdAt._seconds * 1000);
        }

        return {
          id: d.id,
          name: (e.name || e.patientName || e.fullName || '—').toString(),
          phone: (e.phone || '').toString(),
          email: (e.email || '').toString(),
          assignedTo: (e.assignedTo || '').toString(),
          telecaller: (e.telecaller || '').toString(),
          reference: e.reference,
          center: (e.center || '').toString(),
          status: (e.status || '').toString(),
          createdAt,
        };
      });

      // Sort newest first
      list.sort((a, b) => {
        const ta = a.createdAt?.getTime() ?? 0;
        const tb = b.createdAt?.getTime() ?? 0;
        return tb - ta;
      });

      setEnquiries(list);
    } catch (err) {
      console.error('Failed to fetch enquiries for Assign To Report:', err);
      setEnquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const assignedToOptions = useMemo(() => {
    const set = new Set<string>();
    enquiries.forEach(e => {
      const v = (e.assignedTo || '').toString().trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [enquiries]);

  const filtered = useMemo(() => {
    const search = norm(searchText);
    return enquiries.filter(e => {
      if (assignedToFilter !== 'all' && norm(e.assignedTo) !== norm(assignedToFilter)) {
        return false;
      }

      if (search) {
        const haystack = [
          e.name,
          e.phone,
          e.email,
          e.assignedTo,
          e.telecaller,
          Array.isArray(e.reference) ? e.reference.join(', ') : e.reference,
          e.status,
          e.center,
        ]
          .map(v => (v || '').toString())
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [enquiries, assignedToFilter, searchText]);

  const exportCsv = () => {
    const headers = [
      'Enquiry ID',
      'Created At',
      'Name',
      'Phone',
      'Email',
      'Assigned To',
      'Telecaller',
      'Reference',
      'Center',
      'Status',
    ];
    const rows = filtered.map(e => [
      e.id,
      e.createdAt ? e.createdAt.toLocaleString() : '',
      e.name,
      e.phone || '',
      e.email || '',
      e.assignedTo || '',
      e.telecaller || '',
      Array.isArray(e.reference) ? e.reference.join(' | ') : (e.reference || ''),
      e.center || '',
      e.status || '',
    ]);
    downloadCsv('assign-to-report.csv', headers, rows);
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
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel id="assigned-filter-label">Assigned To</InputLabel>
              <Select
                labelId="assigned-filter-label"
                label="Assigned To"
                value={assignedToFilter}
                onChange={(e) => setAssignedToFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                {assignedToOptions.map(name => (
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
              label="Search (name, phone, email, reference)"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Grid>

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
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
        <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">Assign To Report</Typography>
            <Typography variant="body2" color="text.secondary">
              View enquiries grouped by who they were assigned to.
            </Typography>
          </Box>
          <Chip
            label={`${filtered.length} record${filtered.length === 1 ? '' : 's'}`}
            color="primary"
            variant="outlined"
          />
        </Box>

        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Created At</TableCell>
                <TableCell>Enquiry ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Telecaller</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length ? (
                filtered.map(e => (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.createdAt ? e.createdAt.toLocaleString() : '—'}</TableCell>
                    <TableCell>{e.id}</TableCell>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{e.phone || '—'}</TableCell>
                    <TableCell>{e.email || '—'}</TableCell>
                    <TableCell>{e.assignedTo || 'Not assigned'}</TableCell>
                    <TableCell>{e.telecaller || '—'}</TableCell>
                    <TableCell>
                      {Array.isArray(e.reference)
                        ? e.reference.map((ref) => (
                            <Chip
                              key={ref}
                              label={ref}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))
                        : (e.reference || '—')}
                    </TableCell>
                    <TableCell>{e.status || '—'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                    No enquiries found for this filter.
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

