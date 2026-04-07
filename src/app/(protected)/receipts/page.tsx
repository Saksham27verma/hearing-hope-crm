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
import EnquiryProfileLink from '@/components/common/EnquiryProfileLink';
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
  receiptNumber: string;
  enquiryId: string;
  enquiryName: string;
  phone: string;
  centerName: string;
  visitDate: string;
  bookingSellingPrice: number;
  bookingAdvance: number;
  trialHearingAid: string;
  trialSecurityDeposit: number;
  trialStatus: string;
  visit: VisitLike;
  enquiry: EnquiryLike;
};

const formatDate = (v?: string) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString('en-IN');
};

const formatCurrency = (amount?: number) => {
  const value = Number(amount) || 0;
  return `₹${value.toLocaleString('en-IN')}`;
};

const normalizeTrialStatus = (visit: Record<string, unknown>): string => {
  const raw = String(visit.trialResult || '').trim().toLowerCase();
  if (raw === 'completed' || raw === 'successful' || raw === 'unsuccessful') return 'Completed';
  if (
    Boolean(visit.purchaseFromTrial) ||
    Boolean(visit.bookingFromTrial) ||
    String(visit.hearingAidStatus || '').trim().toLowerCase() === 'sold' ||
    String(visit.hearingAidStatus || '').trim().toLowerCase() === 'booked'
  ) {
    return 'Completed';
  }
  const endDate = String(visit.trialEndDate || '').trim();
  if (endDate) {
    const endTs = new Date(`${endDate}T23:59:59.999`).getTime();
    if (Number.isFinite(endTs) && endTs < Date.now()) return 'Completed';
  }
  return 'Ongoing';
};

const buildTrialDeviceLabel = (visit: Record<string, unknown>): string => {
  const parts = [
    String(visit.trialHearingAidBrand || visit.hearingAidBrand || '').trim(),
    String(visit.trialHearingAidModel || visit.hearingAidModel || '').trim(),
    String(visit.trialHearingAidType || visit.hearingAidType || '').trim(),
  ].filter(Boolean);
  if (parts.length) return parts.join(' / ');

  const products = Array.isArray(visit.products) ? visit.products : [];
  const productNames = products
    .map((p) => {
      const row = p as { name?: unknown; productName?: unknown };
      return String(row?.name || row?.productName || '').trim();
    })
    .filter(Boolean);
  if (productNames.length) return productNames.join(', ');
  return '';
};

/** Trial receipts apply only to home trials (security deposit / take-home), not in-office trials. */
function isHomeTrialVisit(visit: Record<string, unknown>): boolean {
  const v = visit as {
    trialHearingAidType?: string;
    hearingAidDetails?: { trialHearingAidType?: string };
  };
  return (
    String(v?.trialHearingAidType ?? v?.hearingAidDetails?.trialHearingAidType ?? '').toLowerCase() ===
    'home'
  );
}

const fallbackReceiptNumber = (kind: ReceiptType, visit: Record<string, unknown>): string => {
  const visitId = String(visit.id || '').trim();
  if (!visitId) return '';
  return kind === 'booking' ? `BR-${visitId}` : `TR-${visitId}`;
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
          const enquiry = {
            id: docSnap.id,
            ...(docSnap.data() as Record<string, unknown>),
          } as EnquiryLike & Record<string, unknown>;
          const visits: VisitLike[] = Array.isArray(enquiry.visits) ? enquiry.visits : [];

          visits.forEach((visit: VisitLike & Record<string, unknown>, idx: number) => {
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
              bookingSellingPrice: Number(visit.bookingSellingPrice || 0),
              bookingAdvance: Number(visit.bookingAdvanceAmount || 0),
              trialHearingAid: buildTrialDeviceLabel(visit),
              trialSecurityDeposit: Number(visit.trialHomeSecurityDepositAmount || 0),
              trialStatus: normalizeTrialStatus(visit),
              visit,
              enquiry,
            };

            if (visit.hearingAidBooked || Number(visit.bookingAdvanceAmount || 0) > 0) {
              next.push({
                id: `${docSnap.id}-${idx}-booking`,
                type: 'booking',
                receiptNumber:
                  String(visit.bookingReceiptNumber || '').trim() ||
                  fallbackReceiptNumber('booking', visit),
                ...base,
              });
            }
            if ((visit.trialGiven || visit.hearingAidTrial) && isHomeTrialVisit(visit as Record<string, unknown>)) {
              next.push({
                id: `${docSnap.id}-${idx}-trial`,
                type: 'trial',
                receiptNumber:
                  String(visit.trialReceiptNumber || '').trim() ||
                  fallbackReceiptNumber('trial', visit),
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
        r.enquiryId.toLowerCase().includes(q) ||
        r.receiptNumber.toLowerCase().includes(q)
      );
    });
  }, [rows, search, tab]);

  const openReceipt = async (row: ReceiptRow) => {
    if (row.type === 'booking') {
      await openBookingReceiptPDF(row.enquiry, row.visit, {
        centerName: row.centerName,
        receiptNumber: row.receiptNumber,
      });
      return;
    }
    await openTrialReceiptPDF(row.enquiry, row.visit, {
      centerName: row.centerName,
      receiptNumber: row.receiptNumber,
    });
  };

  const downloadReceipt = async (row: ReceiptRow) => {
    if (row.type === 'booking') {
      await downloadBookingReceiptPDF(row.enquiry, row.visit, undefined, {
        centerName: row.centerName,
        receiptNumber: row.receiptNumber,
      });
      return;
    }
    await downloadTrialReceiptPDF(row.enquiry, row.visit, undefined, {
      centerName: row.centerName,
      receiptNumber: row.receiptNumber,
    });
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
            label="Search by name, phone, center, enquiry id, receipt number"
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
              <TableCell>Receipt #</TableCell>
              <TableCell>Receipt Details</TableCell>
              <TableCell>Trial Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
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
                  <TableCell>
                    <EnquiryProfileLink enquiryId={row.enquiryId}>{row.enquiryName}</EnquiryProfileLink>
                  </TableCell>
                  <TableCell>{row.phone || '—'}</TableCell>
                  <TableCell>{row.centerName || '—'}</TableCell>
                  <TableCell>{formatDate(row.visitDate)}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {row.receiptNumber || '—'}
                </TableCell>
                  <TableCell>
                    {row.type === 'booking' ? (
                      <Box>
                        <Typography variant="body2">
                          Selling Price: {formatCurrency(row.bookingSellingPrice)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Advance: {formatCurrency(row.bookingAdvance)}
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        <Typography variant="body2">
                          Hearing Aid: {row.trialHearingAid || '—'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Security Deposit: {formatCurrency(row.trialSecurityDeposit)}
                        </Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.type === 'trial' ? (
                      <Chip
                        size="small"
                        color={row.trialStatus === 'Completed' ? 'success' : 'warning'}
                        label={row.trialStatus}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
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

