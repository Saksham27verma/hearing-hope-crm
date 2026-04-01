'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import {
  downloadBookingReceiptPDF,
  downloadTrialReceiptPDF,
  openBookingReceiptPDF,
  openTrialReceiptPDF,
  type EnquiryLike,
  type VisitLike,
} from '@/utils/receiptGenerator';

type ReceiptType = 'booking' | 'trial';

type ReceiptRow = {
  id: string;
  type: ReceiptType;
  enquiryId: string;
  enquiryName: string;
  phone: string;
  centerName: string;
  visitDate: string;
  visit: VisitLike;
  enquiry: EnquiryLike;
};

const formatDate = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-IN');
};

export default function ReceiptsPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | ReceiptType>('all');

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError('');

        const [enquiriesSnap, centersSnap] = await Promise.all([
          getDocs(collection(db, 'enquiries')),
          getDocs(query(collection(db, 'centers'), orderBy('name'))),
        ]);

        const centerMap = new Map<string, string>();
        centersSnap.docs.forEach((d) => {
          const c = d.data() as { name?: string };
          centerMap.set(d.id, c.name || d.id);
        });

        const next: ReceiptRow[] = [];

        enquiriesSnap.docs.forEach((docSnap) => {
          const enquiry = { id: docSnap.id, ...(docSnap.data() as any) } as EnquiryLike & Record<string, any>;
          const visits: VisitLike[] = Array.isArray(enquiry.visits) ? enquiry.visits : [];

          visits.forEach((visit: VisitLike & Record<string, any>, idx: number) => {
            const centerId = String(
              visit.centerId || enquiry.visitingCenter || enquiry.centerId || enquiry.center || ''
            ).trim();
            const centerName = centerMap.get(centerId) || centerId || '—';
            const visitDate = String(
              visit.bookingDate || visit.trialStartDate || visit.visitDate || visit.date || ''
            );

            const base = {
              enquiryId: String(enquiry.id || ''),
              enquiryName: String(enquiry.name || enquiry.patientName || enquiry.fullName || 'Unknown'),
              phone: String(enquiry.phone || enquiry.mobile || ''),
              centerName,
              visitDate,
              visit,
              enquiry,
            };

            if (visit.hearingAidBooked || Number(visit.bookingAdvanceAmount || 0) > 0) {
              next.push({
                id: `${docSnap.id}-${idx}-booking`,
                type: 'booking',
                ...base,
              });
            }
            if (visit.trialGiven || visit.hearingAidTrial) {
              next.push({
                id: `${docSnap.id}-${idx}-trial`,
                type: 'trial',
                ...base,
              });
            }
          });
        });

        next.sort((a, b) => (a.visitDate < b.visitDate ? 1 : -1));
        setRows(next);
      } catch (e) {
        console.error('Failed to load receipts:', e);
        setError('Failed to load booking/trial receipts.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== 'all' && r.type !== tab) return false;
      if (!q) return true;
      return (
        r.enquiryName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.centerName.toLowerCase().includes(q) ||
        r.enquiryId.toLowerCase().includes(q)
      );
    });
  }, [rows, search, tab]);

  const openReceipt = async (row: ReceiptRow) => {
    if (row.type === 'booking') {
      await openBookingReceiptPDF(row.enquiry, row.visit, { centerName: row.centerName });
      return;
    }
    await openTrialReceiptPDF(row.enquiry, row.visit, { centerName: row.centerName });
  };

  const downloadReceipt = async (row: ReceiptRow) => {
    if (row.type === 'booking') {
      await downloadBookingReceiptPDF(row.enquiry, row.visit, undefined, { centerName: row.centerName });
      return;
    }
    await downloadTrialReceiptPDF(row.enquiry, row.visit, undefined, { centerName: row.centerName });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={22} />
        <Typography>Loading receipts…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Booking & Trial Receipts
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Central place to view, open, and download all booking/trial receipts from CRM records.
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            size="small"
            fullWidth
            label="Search by name, phone, center, enquiry id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 40 }}
          >
            <Tab label="All" value="all" />
            <Tab label="Booking" value="booking" />
            <Tab label="Trial" value="trial" />
          </Tabs>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Patient/Enquiry</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Center</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Enquiry Id</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No receipts found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Chip
                      size="small"
                      color={row.type === 'booking' ? 'primary' : 'warning'}
                      label={row.type === 'booking' ? 'Booking' : 'Trial'}
                    />
                  </TableCell>
                  <TableCell>{row.enquiryName}</TableCell>
                  <TableCell>{row.phone || '—'}</TableCell>
                  <TableCell>{row.centerName || '—'}</TableCell>
                  <TableCell>{formatDate(row.visitDate)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{row.enquiryId}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" startIcon={<VisibilityIcon />} onClick={() => openReceipt(row)}>
                        Open
                      </Button>
                      <Button size="small" startIcon={<DownloadIcon />} onClick={() => downloadReceipt(row)}>
                        Download
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {userProfile?.role === 'audiologist' ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          You can access receipts here for read/download. Creation still happens through enquiry/staff workflows.
        </Alert>
      ) : null}
    </Box>
  );
}

