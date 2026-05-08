'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  Button,
  Chip,
  Divider,
  Avatar,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardContent,
  CircularProgress,
  styled,
  alpha,
  Grid as MuiGrid,
  Stack,
  Tabs,
  Tab,
  Snackbar,
  Alert,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Link,
  Menu,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  ContactPage as ContactPageIcon,
  Notes as NotesIcon,
  EventNote as EventNoteIcon,
  Visibility as VisibilityIcon,
  MedicalServices as MedicalServicesIcon,
  Hearing as HearingIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Edit as EditIcon,
  Receipt as ReceiptIcon,
  Download as DownloadIcon,
  AccessTime as TimeIcon,
  CalendarMonth as CalendarIcon,
  Share as ShareIcon,
  Add as AddIcon,
  Close as CloseIcon,
  PhoneInTalk as PhoneInTalkIcon,
  PictureAsPdf as PictureAsPdfIcon,
} from '@mui/icons-material';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  Timestamp,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import {
  openBookingReceiptPDF,
  downloadBookingReceiptPDF,
  openTrialReceiptPDF,
  downloadTrialReceiptPDF,
  openPaymentAcknowledgmentPDF,
  downloadPaymentAcknowledgmentPDF,
} from '@/utils/receiptGenerator';
import { getEnquiryPaymentLedgerLines } from '@/utils/enquiryPaymentLedger';
import { convertSaleToInvoiceData, enquiryVisitToInvoiceSalePayload } from '@/utils/pdfGenerator';
import InvoicePrintConfirmModal from '@/components/sales-invoicing/InvoicePrintConfirmModal';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import { getCanonicalInvoiceNumberForEnquiryVisit } from '@/lib/sales-invoicing/enquiryVisitInvoiceSync';
import {
  ENQUIRY_STATUS_OPTIONS,
  getEnquiryStatusMeta,
  parseJourneyStatusOverride,
  type EnquiryJourneyStatus,
} from '@/utils/enquiryStatus';
import { db } from '@/firebase/config';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { logActivity, computeChanges } from '@/lib/activityLogger';
import PureToneAudiogram from '@/components/enquiries/PureToneAudiogram';
import RefreshDataButton from '@/components/common/RefreshDataButton';
import {
  getTelecallerSelectOptions,
  collectTelecallerExtrasFromEnquiry,
  pickDefaultTelecallerName,
  type StaffRecord,
} from '@/utils/enquiryTelecallerOptions';
import { fetchStaffRecordsWithServerFallback } from '@/utils/fetchStaffForEnquiryForms';
import { sumHearingTestEntryPrices } from '@/lib/hearingTestPricing';
import { sumEntProcedurePrices } from '@/lib/entServicePricing';
import { netPayableAfterHearingAidExchange } from '@/lib/sales-invoicing/enquiryPayments';
import { formatPtaTestDateForDisplay } from '@/lib/ptaIntegration';
import { HotEnquiryBadgeChip } from '@/components/enquiries/HotEnquiryIndicator';

const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

/**
 * Robustly format an enquiry timestamp value as a localized date string.
 * Firestore values can arrive in many shapes depending on how they were
 * written (client SDK Timestamp, admin SDK serialization, Date, ISO string,
 * or raw millis). Returns the provided fallback when the value cannot be
 * parsed into a valid date so the UI never renders "Invalid Date".
 */
function formatEnquiryDate(value: unknown, fallback = '—'): string {
  if (value == null || value === '') return fallback;
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else if (typeof value === 'string') {
    const parsed = new Date(value);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (typeof value === 'object') {
    const v = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
      nanoseconds?: number;
      _nanoseconds?: number;
    };
    if (typeof v.toDate === 'function') {
      try {
        date = v.toDate();
      } catch {
        date = null;
      }
    } else if (typeof v.seconds === 'number') {
      date = new Date(v.seconds * 1000);
    } else if (typeof v._seconds === 'number') {
      date = new Date(v._seconds * 1000);
    }
  }
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString();
}

/** Home trials: duration/dates/result and trial receipts; in-office trials do not. */
function isHomeTrialVisit(visit: any): boolean {
  return (
    String(
      visit?.trialHearingAidType ?? visit?.hearingAidDetails?.trialHearingAidType ?? ''
    ).toLowerCase() === 'home'
  );
}

const PageShell = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(3),
  background:
    theme.palette.mode === 'dark'
      ? `
    radial-gradient(circle at top left, ${alpha(theme.palette.primary.main, 0.14)}, transparent 30%),
    radial-gradient(circle at top right, ${alpha(theme.palette.warning.main, 0.1)}, transparent 26%),
    linear-gradient(180deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.background.paper, 0.85)} 42%, ${theme.palette.background.default} 100%)
  `
      : `
    radial-gradient(circle at top left, rgba(245,124,0,0.10), transparent 28%),
    radial-gradient(circle at top right, rgba(255,193,7,0.10), transparent 24%),
    linear-gradient(180deg, #fffaf5 0%, #f7f8fb 38%, #f5f7fb 100%)
  `,
}));

const InfoCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: theme.spacing(2.25),
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 16px 42px rgba(0, 0, 0, 0.45)'
      : '0 16px 42px rgba(15, 23, 42, 0.06)',
  border:
    theme.palette.mode === 'dark'
      ? `1px solid ${alpha(theme.palette.common.white, 0.1)}`
      : '1px solid rgba(148, 163, 184, 0.16)',
  background:
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.background.paper, 0.96)
      : 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(10px)',
  overflow: 'hidden',
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.82rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1.75),
}));

const SectionHeading = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
      mb: 2.25,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        sx={(theme) => ({
          width: 38,
          height: 38,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
          color: 'primary.main',
          border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.18)}`,
        })}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1, color: 'text.primary' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  </Box>
);

const MetricCard = ({ label, value, accent = '#f57c00' }: { label: string; value: string; accent?: string }) => (
  <Paper
    variant="outlined"
    sx={(theme) => ({
      p: 2,
      borderRadius: 2.25,
      bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.18 : 0.04),
      borderColor: alpha(accent, theme.palette.mode === 'dark' ? 0.35 : 0.15),
      boxShadow: 'none',
    })}
  >
    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
      {label}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 800, color: accent, lineHeight: 1.1 }}>
      {value}
    </Typography>
  </Paper>
);

const InfoRow = ({ icon, label, value, color = 'text.primary' }: any) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.25 }}>
      <Box
        sx={(theme) => ({
          color: 'primary.main',
          mt: 0.2,
          width: 34,
          height: 34,
          borderRadius: 1.75,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.08),
          border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.3 : 0.12)}`,
          flexShrink: 0,
        })}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body1" color={color} sx={{ fontWeight: 600, lineHeight: 1.5 }}>
          {Array.isArray(value) ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {value.map((item, index) => (
                <Chip
                  key={index}
                  label={item}
                  size="small"
                  variant="outlined"
                  sx={(theme) => ({
                    borderRadius: 1.5,
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.04),
                  })}
                />
              ))}
            </Stack>
          ) : (
            value
          )}
        </Typography>
      </Box>
    </Box>
  );
};

export default function EnquiryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [activeVisitTab, setActiveVisitTab] = useState(0);
  const [shareSnackbar, setShareSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });
  const [addFollowUpOpen, setAddFollowUpOpen] = useState(false);
  const [addFollowUpSaving, setAddFollowUpSaving] = useState(false);
  const [newFollowUp, setNewFollowUp] = useState({
    date: '',
    remarks: '',
    nextFollowUpDate: '',
    callerName: '',
  });
  const [followUpFeedback, setFollowUpFeedback] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [telecallerDialogOptions, setTelecallerDialogOptions] = useState<string[]>([]);
  const [enquiryAppointments, setEnquiryAppointments] = useState<any[]>([]);
  const [invoicePdfOpen, setInvoicePdfOpen] = useState(false);
  const [invoicePdfData, setInvoicePdfData] = useState<ReturnType<typeof convertSaleToInvoiceData> | null>(null);

  const fetchEnquiry = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const enquiryDoc = await getDoc(doc(db, 'enquiries', id));

      if (enquiryDoc.exists()) {
        const enquiryData = enquiryDoc.data();
        setEnquiry({
          id: enquiryDoc.id,
          ...enquiryData
        });
      } else {
        setError('Enquiry not found');
      }
    } catch (err: any) {
      console.error('Error fetching enquiry:', err);
      setError(err.message || 'Failed to load enquiry details');
    } finally {
      setLoading(false);
    }
  };

  const fetchCenters = async () => {
    try {
      const q = query(collection(db, 'centers'), orderBy('name'));
      const snap = await getDocs(q);
      setCenters(snap.docs.map(d => ({ id: d.id, name: (d.data() as { name?: string })?.name || d.id })));
    } catch (e) {
      console.error('Error fetching centers:', e);
    }
  };

  const fetchEnquiryAppointments = async (id: string) => {
    try {
      const q = query(collection(db, 'appointments'), where('enquiryId', '==', id));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      list.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
      setEnquiryAppointments(list);
    } catch (e) {
      console.error('Error fetching appointments:', e);
      setEnquiryAppointments([]);
    }
  };

  const handleRefresh = async () => {
    if (!resolvedParams || refreshing) return;
    try {
      setRefreshing(true);
      await Promise.all([
        fetchEnquiry(resolvedParams.id),
        fetchCenters(),
        fetchEnquiryAppointments(resolvedParams.id),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const [journeyMenuAnchor, setJourneyMenuAnchor] = useState<null | HTMLElement>(null);
  const [journeyStatusSaving, setJourneyStatusSaving] = useState(false);
  const [hotEnquirySaving, setHotEnquirySaving] = useState(false);

  const saveHotEnquiryFlag = async (nextHot: boolean) => {
    if (!resolvedParams?.id || !enquiry || userProfile?.role === 'audiologist') return;
    setHotEnquirySaving(true);
    try {
      const ref = doc(db, 'enquiries', resolvedParams.id);
      await updateDoc(ref, { hotEnquiry: nextHot, updatedAt: serverTimestamp() });
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'UPDATE',
        module: 'Enquiries',
        entityId: resolvedParams.id,
        entityName: enquiry?.name || enquiry?.phone || 'Enquiry',
        description: nextHot ? 'Marked enquiry as hot (priority lead)' : 'Removed hot enquiry mark',
        metadata: { hotEnquiry: nextHot },
      }, user);
      setEnquiry({ ...enquiry, hotEnquiry: nextHot });
      setFollowUpFeedback({
        open: true,
        message: nextHot ? 'Marked as hot enquiry' : 'Hot mark removed',
        severity: 'success',
      });
    } catch (e) {
      console.error(e);
      setFollowUpFeedback({
        open: true,
        message: 'Could not update hot enquiry',
        severity: 'error',
      });
    } finally {
      setHotEnquirySaving(false);
    }
  };

  const saveJourneyStatusOverride = async (next: EnquiryJourneyStatus | 'auto') => {
    if (!resolvedParams?.id || !enquiry || userProfile?.role === 'audiologist') return;
    setJourneyStatusSaving(true);
    try {
      const ref = doc(db, 'enquiries', resolvedParams.id);
      const journeyStatusOverride = next === 'auto' ? null : next;
      await updateDoc(ref, { journeyStatusOverride, updatedAt: serverTimestamp() });
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'STATUS_CHANGE',
        module: 'Enquiries',
        entityId: resolvedParams.id,
        entityName: enquiry?.name || enquiry?.phone || 'Enquiry',
        description: `Journey tag changed to "${next === 'auto' ? 'auto (follows visits)' : next}" for ${enquiry?.name || enquiry?.phone || 'patient'}`,
        changes: computeChanges(
          { journeyStatusOverride: enquiry?.journeyStatusOverride ?? null },
          { journeyStatusOverride: journeyStatusOverride ?? null },
        ),
        metadata: { journeyStatus: next },
      }, user);
      setEnquiry({ ...enquiry, journeyStatusOverride });
      setJourneyMenuAnchor(null);
      setFollowUpFeedback({
        open: true,
        message:
          next === 'auto'
            ? 'Tag follows visits again (until set manually)'
            : 'Journey tag updated',
        severity: 'success',
      });
    } catch (e) {
      console.error(e);
      setFollowUpFeedback({
        open: true,
        message: 'Could not update journey tag',
        severity: 'error',
      });
    } finally {
      setJourneyStatusSaving(false);
    }
  };

  const shareProfileLink = () => {
    if (typeof window === 'undefined' || !resolvedParams?.id) return;
    const url = `${window.location.origin}/interaction/enquiries/${resolvedParams.id}`;
    const done = (ok: boolean) =>
      setShareSnackbar({
        open: true,
        message: ok ? 'Profile link copied to clipboard' : 'Could not copy — copy the URL from the address bar',
      });
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
    } else {
      done(false);
    }
  };

  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    };
    resolveParams();
  }, [params]);
  
  useEffect(() => {
    if (!resolvedParams) return;
    fetchEnquiry(resolvedParams.id);
  }, [resolvedParams]);

  useEffect(() => {
    if (!resolvedParams?.id) return;
    void fetchEnquiryAppointments(resolvedParams.id);
  }, [resolvedParams?.id]);

  useEffect(() => {
    fetchCenters();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchStaffRecordsWithServerFallback();
        if (!cancelled) setStaffList(list);
      } catch (e) {
        console.error('Error fetching staff for telecaller list:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!addFollowUpOpen) return;
    const options = getTelecallerSelectOptions(
      staffList,
      undefined,
      [...collectTelecallerExtrasFromEnquiry(enquiry), userProfile?.displayName]
    );
    setTelecallerDialogOptions(options);
    setNewFollowUp((prev) => ({
      ...prev,
      callerName: options.includes(prev.callerName)
        ? prev.callerName
        : pickDefaultTelecallerName(options, {
            displayName: userProfile?.displayName,
            enquiryTelecaller: enquiry?.telecaller,
          }),
    }));
  }, [staffList, addFollowUpOpen, userProfile?.displayName, enquiry]);
  
  const visits = enquiry?.visits || enquiry?.visitSchedules || [];
  const hasVisits = visits.length > 0;
  const followUpsList = Array.isArray(enquiry?.followUps) ? enquiry.followUps : [];
  const enquiryCreatedByLabel =
    enquiry?.createdByName || enquiry?.createdByEmail || enquiry?.createdByUid || null;

  const formatFollowUpDateCell = (value: string | undefined) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  const openAddFollowUpDialog = () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const options = getTelecallerSelectOptions(
      staffList,
      undefined,
      [...collectTelecallerExtrasFromEnquiry(enquiry), userProfile?.displayName]
    );
    setTelecallerDialogOptions(options);
    const callerName = pickDefaultTelecallerName(options, {
      displayName: userProfile?.displayName,
      enquiryTelecaller: enquiry?.telecaller,
    });
    setNewFollowUp({
      date: new Date().toISOString().split('T')[0],
      remarks: '',
      nextFollowUpDate: nextWeek,
      callerName,
    });
    setAddFollowUpOpen(true);
  };

  const handleSaveFollowUp = async () => {
    if (!resolvedParams?.id || !enquiry) return;
    if (!newFollowUp.callerName.trim()) {
      setFollowUpFeedback({
        open: true,
        message: 'Select who made the call (telecaller list).',
        severity: 'error',
      });
      return;
    }
    try {
      setAddFollowUpSaving(true);
      const followUpData = {
        ...newFollowUp,
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `fu-${Date.now()}`,
        createdAt: Timestamp.now(),
      };
      const updated = [...followUpsList, followUpData];
      await updateDoc(doc(db, 'enquiries', resolvedParams.id), { followUps: updated });
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'FOLLOW_UP',
        module: 'Telecalling',
        entityId: resolvedParams.id,
        entityName: enquiry?.name || enquiry?.phone || 'Enquiry',
        description: `Telecall logged for ${enquiry?.name || enquiry?.phone || 'patient'} by ${newFollowUp.callerName || 'staff'}${newFollowUp.remarks ? ` — "${newFollowUp.remarks}"` : ''}`,
        changes: {
          followUp: {
            before: null,
            after: {
              callerName: newFollowUp.callerName,
              date: newFollowUp.date,
              remarks: newFollowUp.remarks,
              nextFollowUpDate: newFollowUp.nextFollowUpDate,
            },
          },
        },
        metadata: {
          callerName: newFollowUp.callerName,
          remarks: newFollowUp.remarks,
          nextFollowUpDate: newFollowUp.nextFollowUpDate,
        },
      }, user);
      setEnquiry({ ...enquiry, followUps: updated });
      setAddFollowUpOpen(false);
      setFollowUpFeedback({ open: true, message: 'Call logged successfully', severity: 'success' });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Could not save call';
      setFollowUpFeedback({ open: true, message, severity: 'error' });
    } finally {
      setAddFollowUpSaving(false);
    }
  };

  const paymentEntries = getEnquiryPaymentLedgerLines(enquiry);
  const hasPayments = paymentEntries.length > 0 || Boolean(enquiry?.financialSummary);

  const hasValue = (value: any) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return value !== 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
  };

  /** True when this visit is explicitly a booking (or clearly booking-related), not trial-only. */
  const visitIsBookingService = (v: any) =>
    !!(
      v?.hearingAidBooked ||
      (Array.isArray(v?.medicalServices) && v.medicalServices.includes('hearing_aid_booked')) ||
      v?.medicalService === 'hearing_aid_booked'
    );

  /**
   * Booking Details block only for real booking visits.
   * Trial-only visits must not show it: `bookingSellingPrice` / other fields can be filled from
   * `grossSalesBeforeTax` when loading from Firestore, which looked like random booking data.
   */
  const visitShowsBookingDetails = (v: any) => {
    if (!v) return false;
    const isBooking = visitIsBookingService(v);
    const isSaleOnly = !!v.hearingAidSale && !isBooking && !v.bookingFromTrial;
    const trialOnly = !!v.hearingAidTrial && !isBooking && !v.bookingFromTrial;
    if (isSaleOnly) return false;
    if (trialOnly) return false;
    if (isBooking) return true;
    if (v.bookingFromTrial) return true;
    if (Number(v.bookingAdvanceAmount) > 0) return true;
    if (Number(v.bookingSellingPrice) > 0) return true;
    if (hasValue(v.bookingDate)) return true;
    if (Number(v.bookingQuantity) > 1) return true;
    return false;
  };

  // Receipt data
  const bookingReceipts = visits
    .map((visit: any, index: number) => ({ visit, index }))
    .filter(
      ({ visit }: { visit: any }) =>
        (visit.hearingAidBooked && !visit.hearingAidSale) ||
        (visit.bookingFromTrial && Number(visit.bookingAdvanceAmount) > 0)
    );
  const trialReceipts = visits
    .map((visit: any, index: number) => ({ visit, index }))
    .filter(
      ({ visit }: { visit: any }) =>
        (visit.trialGiven || visit.hearingAidTrial) && isHomeTrialVisit(visit)
    );
  const saleInvoiceReceipts = visits
    .map((visit: any, index: number) => ({ visit, index }))
    .filter(
      ({ visit }: { visit: any }) =>
        (visit.hearingAidSale || visit.purchaseFromTrial) &&
        ((Array.isArray(visit.products) && visit.products.length > 0) || hasValue(visit.salesAfterTax))
    );
  const hasReceipts =
    bookingReceipts.length > 0 ||
    trialReceipts.length > 0 ||
    saleInvoiceReceipts.length > 0 ||
    paymentEntries.length > 0;

  const getCenterName = (visit?: any) => {
    const centerId =
      visit?.centerId || enquiry.visitingCenter || (enquiry as { center?: string }).center;
    return centerId ? (centers.find(c => c.id === centerId)?.name) || undefined : undefined;
  };

  const getVisitInvoiceNumber = async (visitIndex: number): Promise<string> => {
    const visitsKey = Array.isArray(enquiry?.visits) ? 'visits' : 'visitSchedules';
    const visitList = Array.isArray(enquiry?.[visitsKey]) ? [...enquiry[visitsKey]] : [];
    const currentVisit = visitList[visitIndex] || {};
    const existing = normalizeInvoiceNumberString(currentVisit.invoiceNumber);
    if (saleHasBillableInvoiceNumber(existing)) {
      return existing;
    }
    if (resolvedParams?.id) {
      const fromCanonicalSale = await getCanonicalInvoiceNumberForEnquiryVisit(db, resolvedParams.id, visitIndex);
      if (saleHasBillableInvoiceNumber(fromCanonicalSale.invoiceNumber)) return fromCanonicalSale.invoiceNumber;
    }
    throw new Error('Invoice number is missing for this visit');
  };

  const formatCurrency = (value?: number) =>
    hasValue(value) ? `₹${Number(value).toLocaleString('en-IN')}` : undefined;

  const getVisitDateLabel = (visit: any) => {
    if (!visit?.visitDate && !visit?.date) return 'Not scheduled';
    return new Date(visit.visitDate || visit.date).toLocaleDateString();
  };

  const getVisitServices = (visit: any) => {
    const services: Array<{ label: string; color: 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'error' | 'default' }> = [];
    if (visit.hearingTest) services.push({ label: 'Hearing Test', color: 'info' });
    if (
      visit.entService ||
      (Array.isArray(visit.medicalServices) && visit.medicalServices.includes('ent_service'))
    ) {
      services.push({ label: 'ENT service', color: 'secondary' });
    }
    if (visit.hearingAidTrial || visit.trialGiven) services.push({ label: 'Trial', color: 'warning' });
    if (
      visit.hearingAidBooked ||
      (Array.isArray(visit.medicalServices) && visit.medicalServices.includes('hearing_aid_booked')) ||
      visit.bookingFromTrial ||
      (hasValue(visit.bookingAdvanceAmount) && !(visit.hearingAidTrial && !visit.hearingAidBooked && !visit.bookingFromTrial))
    ) {
      services.push({ label: 'Booking', color: 'primary' });
    }
    if (visit.hearingAidSale || visit.purchaseFromTrial) services.push({ label: 'Sale', color: 'success' });
    if (visit.accessory) services.push({ label: 'Accessory', color: 'secondary' });
    if (visit.programming) services.push({ label: 'Programming', color: 'default' });
    if (visit.repair) services.push({ label: 'Repair', color: 'error' });
    if (visit.counselling) services.push({ label: 'Counselling', color: 'default' });
    return services;
  };

  const getBookingTotal = (visit: any) =>
    (Number(visit?.bookingSellingPrice) || 0) * (Number(visit?.bookingQuantity) || 1);

  /** Units per sale line; amounts on stored products are per unit (matches enquiry form). */
  const saleLineQty = (product: { quantity?: number }) => {
    const q = Math.floor(Number(product.quantity));
    if (!Number.isFinite(q) || q < 1) return 1;
    return Math.min(9999, q);
  };

  const calculateDerivedTotalDue = () => {
    let total = 0;
    visits.forEach((visit: any) => {
      if (visit.hearingTest) {
        const ht = sumHearingTestEntryPrices(visit);
        if (ht > 0) total += ht;
      }
      if (
        visit.entService ||
        (Array.isArray(visit.medicalServices) && visit.medicalServices.includes('ent_service'))
      ) {
        const entAmt = sumEntProcedurePrices(visit);
        if (entAmt > 0) total += entAmt;
      }
      if (visit.hearingAidBooked && !visit.hearingAidSale) {
        total += getBookingTotal(visit);
      } else if (visit.hearingAidSale || visit.purchaseFromTrial) {
        total += netPayableAfterHearingAidExchange(visit as Record<string, unknown>);
      }
      if (visit.accessory && !visit.accessoryFOC) {
        total += (Number(visit.accessoryAmount) || 0) * (Number(visit.accessoryQuantity) || 1);
      }
      if (visit.programming) {
        total += Number(visit.programmingAmount) || 0;
      }
      if (visit.visitType === 'home') {
        total += Math.max(0, Number(visit.homeVisitCharges) || 0);
      }
    });
    return total;
  };

  const totalDue = Number(enquiry?.financialSummary?.totalDue ?? calculateDerivedTotalDue());
  // Always derive paid amount from actual payment entries, not planned booking advances.
  const totalPaid = paymentEntries.reduce((sum: number, payment: any) => sum + (Number(payment.amount) || 0), 0);
  const pendingAmount = Math.max(
    0,
    totalDue - totalPaid
  );
  const paymentStatus = pendingAmount <= 0 ? 'fully_paid' : totalPaid > 0 ? 'partial' : 'pending';
  const journeyStatus = useMemo(() => getEnquiryStatusMeta(enquiry), [enquiry]);

  const appointmentStats = useMemo(() => {
    const now = Date.now();
    let completed = 0;
    let cancelled = 0;
    let upcoming = 0;
    let pastScheduled = 0;
    enquiryAppointments.forEach((a: any) => {
      const st = a.status === 'completed' ? 'completed' : a.status === 'cancelled' ? 'cancelled' : 'scheduled';
      const t = new Date(a.start).getTime();
      if (st === 'completed') completed += 1;
      else if (st === 'cancelled') cancelled += 1;
      else if (t >= now) upcoming += 1;
      else pastScheduled += 1;
    });
    return { completed, cancelled, upcoming, pastScheduled, total: enquiryAppointments.length };
  }, [enquiryAppointments]);

  const getEnquiryAppointmentStatus = (a: any) =>
    a.status === 'completed' ? 'completed' : a.status === 'cancelled' ? 'cancelled' : 'scheduled';

  const getVisitAmount = (visit: any) => {
    if (!visit) return undefined;
    if (visit.hearingAidBooked && !visit.hearingAidSale) {
      return getBookingTotal(visit) || visit.bookingAdvanceAmount || visit.hearingAidPrice;
    }
    if (visit.hearingAidSale || visit.purchaseFromTrial) {
      if (Number(visit.salesAfterTax) > 0 || Number(visit.exchangeCreditAmount) > 0) {
        return netPayableAfterHearingAidExchange(visit as Record<string, unknown>);
      }
      return visit.salesAfterTax || visit.hearingAidPrice;
    }
    const homeCharges =
      visit.visitType === 'home' ? Math.max(0, Number(visit.homeVisitCharges) || 0) : 0;
    return (
      visit.totalVisitAmount ||
      visit.accessoryAmount ||
      visit.programmingAmount ||
      visit.repairAmount ||
      visit.counsellingAmount ||
      sumHearingTestEntryPrices(visit) ||
      sumEntProcedurePrices(visit) ||
      (homeCharges > 0 ? homeCharges : undefined)
    );
  };

  useEffect(() => {
    if (activeVisitTab >= visits.length) {
      setActiveVisitTab(0);
    }
  }, [activeVisitTab, visits.length]);

  const activeVisit = visits[activeVisitTab];
  const activeVisitAudiogramData =
    activeVisit?.hearingTestDetails?.audiogramData || activeVisit?.audiogramData;
  const activeVisitExternalPta =
    activeVisit?.hearingTestDetails?.externalPtaReport || activeVisit?.externalPtaReport;

  const activeVisitHearingTestTypesLabel = useMemo(() => {
    const v = activeVisit;
    if (!v) return '';
    const ent = v.hearingTestDetails?.hearingTestEntries ?? v.hearingTestEntries;
    if (Array.isArray(ent) && ent.length > 0) {
      const parts = ent.map((e: any) => e?.testType).filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
    const t = v.hearingTestDetails?.testType ?? v.testType;
    return typeof t === 'string' ? t : '';
  }, [activeVisit]);

  const activeVisitHearingTestEntries = useMemo(() => {
    const v = activeVisit;
    if (!v) return [] as { id?: string; testType?: string; price?: number; testPrice?: number }[];
    const ent = v.hearingTestDetails?.hearingTestEntries ?? v.hearingTestEntries;
    return Array.isArray(ent) ? ent : [];
  }, [activeVisit]);

  const activeVisitEntProcedureEntries = useMemo(() => {
    const v = activeVisit;
    if (!v) return [] as { id?: string; procedureType?: string; price?: number; procedurePrice?: number }[];
    const rows = v.entServiceDetails?.entProcedureEntries ?? v.entProcedureEntries;
    return Array.isArray(rows) ? rows : [];
  }, [activeVisit]);

  const activeVisitEntTypesLabel = useMemo(() => {
    const v = activeVisit;
    if (!v) return '';
    const rows = v.entServiceDetails?.entProcedureEntries ?? v.entProcedureEntries;
    if (Array.isArray(rows) && rows.length > 0) {
      const parts = rows.map((e: any) => e?.procedureType).filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
    const line = v.entServiceDetails?.procedureTypesLine;
    return typeof line === 'string' ? line : '';
  }, [activeVisit]);

  const showEntVisitSection =
    Boolean(activeVisit?.entService) ||
    (Array.isArray(activeVisit?.medicalServices) && activeVisit.medicalServices.includes('ent_service')) ||
    activeVisitEntProcedureEntries.length > 0 ||
    hasValue(activeVisitEntTypesLabel) ||
    hasValue(activeVisit?.entServiceDetails?.doneBy ?? activeVisit?.entProcedureDoneBy);

  const renderVisitField = (label: string, value: any, color: string = 'text.primary') => {
    if (!hasValue(value)) return null;
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 500, color }}>
          {value}
        </Typography>
      </Box>
    );
  };

  const getHomeTrialSecurityDepositAmount = (visit: any) => {
    const ha = visit?.hearingAidDetails || {};
    const amount = Number(visit?.trialHomeSecurityDepositAmount ?? ha.trialHomeSecurityDepositAmount);
    return Number.isFinite(amount) ? amount : 0;
  };

  if (!resolvedParams || loading || authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error || !enquiry) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" color="error" gutterBottom>
              {error || 'Enquiry not found'}
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push('/interaction/enquiries')}
              sx={{ mt: 2 }}
            >
              Back to Enquiries
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <PageShell>
      <Box sx={{ maxWidth: 1520, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/interaction/enquiries')}
          sx={(theme) => ({
            borderRadius: 99,
            borderColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.16) : alpha('#0f172a', 0.12),
            color: 'text.primary',
            bgcolor:
              theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.85)
                : 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(10px)',
          })}
        >
          Back to Enquiries
        </Button>
        
        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
          <RefreshDataButton
            onClick={handleRefresh}
            loading={refreshing}
            sx={(theme) => ({
              borderRadius: 99,
              bgcolor:
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.paper, 0.85)
                  : 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(10px)',
            })}
          />
          {resolvedParams && (
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={shareProfileLink}
              sx={(theme) => ({
                borderRadius: 99,
                borderColor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.16) : alpha('#0f172a', 0.12),
                color: 'text.primary',
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.background.paper, 0.85)
                    : 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(10px)',
              })}
            >
              Share profile
            </Button>
          )}
          {userProfile?.role !== 'audiologist' && resolvedParams && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => router.push(`/interaction/enquiries/edit/${resolvedParams.id}`)}
              sx={{ bgcolor: '#f57c00', '&:hover': { bgcolor: '#e65100' }, borderRadius: 99, px: 2.25, boxShadow: '0 10px 26px rgba(245,124,0,0.26)' }}
            >
              Edit Enquiry
            </Button>
          )}
        </Box>
      </Box>
      
      {/* Patient Header */}
      <Paper
        sx={(theme) => ({
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          background:
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${theme.palette.background.paper} 42%, ${alpha(theme.palette.warning.main, 0.08)} 100%)`
              : 'linear-gradient(135deg, #fff7ed 0%, #ffffff 40%, #fffdf8 100%)',
          border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.14)}`,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 24px 60px rgba(0, 0, 0, 0.45)'
              : '0 24px 60px rgba(15, 23, 42, 0.08)',
        })}
      >
        <Box
          sx={(theme) => ({
            position: 'absolute',
            inset: 0,
            background:
              theme.palette.mode === 'dark'
                ? `
              radial-gradient(circle at 10% 10%, ${alpha(theme.palette.primary.main, 0.22)}, transparent 32%),
              radial-gradient(circle at 88% 16%, ${alpha(theme.palette.warning.main, 0.14)}, transparent 26%)
            `
                : `
              radial-gradient(circle at 10% 10%, rgba(245,124,0,0.16), transparent 30%),
              radial-gradient(circle at 88% 16%, rgba(255,193,7,0.12), transparent 24%)
            `,
            pointerEvents: 'none',
          })}
        />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <Avatar sx={{ bgcolor: '#f57c00', width: 76, height: 76, boxShadow: '0 16px 32px rgba(245,124,0,0.24)' }}>
            <PersonIcon sx={{ fontSize: 38 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <SectionLabel>Patient Profile</SectionLabel>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0 }}>
                {enquiry.name || 'Patient Name'}
              </Typography>
              {enquiry.hotEnquiry && <HotEnquiryBadgeChip />}
            </Box>
            {userProfile?.role !== 'audiologist' && (
              <FormControlLabel
                sx={{ mb: 1.5, ml: 0, alignItems: 'center' }}
                control={
                  <Switch
                    checked={!!enquiry.hotEnquiry}
                    disabled={hotEnquirySaving}
                    onChange={(_, c) => void saveHotEnquiryFlag(c)}
                    color="warning"
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={600} color="text.secondary">
                    Hot enquiry (priority lead)
                  </Typography>
                }
              />
            )}
            {enquiry.customerName && (
              <Typography
                variant="body2"
                sx={(theme) => ({
                  fontWeight: 700,
                  mb: 1,
                  color: theme.palette.mode === 'dark' ? theme.palette.warning.light : '#92400e',
                })}
              >
                Customer Name: {enquiry.customerName}
              </Typography>
            )}
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
              Enquiry journey, visits (test, trial, booking, sale lines), receipts, invoices, and payments in one place.
              Use Share profile to copy this page URL for your team.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {enquiry.phone && userProfile?.role !== 'audiologist' && (
                <Chip 
                  icon={<PhoneIcon />} 
                  label={enquiry.phone} 
                  variant="outlined" 
                  size="small"
                  sx={(theme) => ({
                    borderRadius: 99,
                    bgcolor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.1)
                        : 'rgba(255,255,255,0.75)',
                  })}
                />
              )}
              {enquiry.email && (
                <Chip 
                  icon={<EmailIcon />} 
                  label={enquiry.email} 
                  variant="outlined" 
                  size="small"
                  sx={(theme) => ({
                    borderRadius: 99,
                    bgcolor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.common.white, 0.1)
                        : 'rgba(255,255,255,0.75)',
                  })}
                />
              )}
              <Tooltip
                title={
                  userProfile?.role === 'audiologist'
                    ? journeyStatus.label
                    : journeyStatus.source === 'manual'
                      ? 'Manual tag — click to change or reset to automatic'
                      : 'From visits & lead outcome — click to set tag manually if needed'
                }
              >
                <Chip
                  label={journeyStatusSaving ? 'Saving…' : journeyStatus.label}
                  color={journeyStatus.color}
                  size="small"
                  onClick={
                    userProfile?.role === 'audiologist'
                      ? undefined
                      : (e) => setJourneyMenuAnchor(e.currentTarget)
                  }
                  sx={{
                    borderRadius: 99,
                    fontWeight: 700,
                    cursor: userProfile?.role === 'audiologist' ? 'default' : 'pointer',
                  }}
                />
              </Tooltip>
              <Menu
                anchorEl={journeyMenuAnchor}
                open={Boolean(journeyMenuAnchor)}
                onClose={() => !journeyStatusSaving && setJourneyMenuAnchor(null)}
              >
                <MenuItem
                  disabled={journeyStatusSaving}
                  selected={!parseJourneyStatusOverride(enquiry?.journeyStatusOverride)}
                  onClick={() => saveJourneyStatusOverride('auto')}
                >
                  Automatic (from visits & lead outcome)
                </MenuItem>
                <Divider />
                {ENQUIRY_STATUS_OPTIONS.map((opt) => (
                  <MenuItem
                    key={opt.value}
                    disabled={journeyStatusSaving}
                    selected={parseJourneyStatusOverride(enquiry?.journeyStatusOverride) === opt.value}
                    onClick={() => saveJourneyStatusOverride(opt.value)}
                  >
                    {opt.label}
                  </MenuItem>
                ))}
              </Menu>
            </Stack>
          </Box>

          <Grid container spacing={1.5} sx={{ width: { xs: '100%', md: 320 }, m: 0 }}>
            <Grid item xs={6}>
              <MetricCard label="Created" value={formatEnquiryDate(enquiry.createdAt)} />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Visits" value={String(visits.length)} accent="#0ea5e9" />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Calls" value={String(followUpsList.length)} accent="#7c3aed" />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Pending" value={formatCurrency(pendingAmount) || '₹0'} accent={pendingAmount > 0 ? '#dc2626' : '#16a34a'} />
            </Grid>
            <Grid item xs={6}>
              <MetricCard
                label="Payment Status"
                value={paymentStatus === 'fully_paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Pending'}
                accent={paymentStatus === 'fully_paid' ? '#16a34a' : paymentStatus === 'partial' ? '#d97706' : '#dc2626'}
              />
            </Grid>
          </Grid>
        </Box>
      </Paper>

      <Grid container spacing={3.2}>
        {/* Left Column */}
        <Grid item xs={12} md={7}>
          {/* Basic Information */}
          <InfoCard>
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <SectionHeading icon={<PersonIcon fontSize="small" />} title="Patient Information" subtitle="Core details entered in the form" />
              
              <Grid container spacing={2}>
                {enquiry.customerName && (
                  <Grid item xs={12} sm={6}>
                    <InfoRow
                      icon={<PersonIcon fontSize="small" />}
                      label="Customer Name"
                      value={enquiry.customerName}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <InfoRow 
                    icon={<HomeIcon fontSize="small" />} 
                    label="Address" 
                    value={enquiry.address} 
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <InfoRow 
                    icon={<ContactPageIcon fontSize="small" />} 
                    label="Reference Source" 
                    value={Array.isArray(enquiry.reference) ? enquiry.reference : enquiry.reference ? [enquiry.reference] : null} 
                  />
                </Grid>
                {enquiryCreatedByLabel && (
                  <Grid item xs={12} sm={6}>
                    <InfoRow
                      icon={<PersonIcon fontSize="small" />}
                      label="Enquiry Created By"
                      value={enquiryCreatedByLabel}
                    />
                  </Grid>
                )}
                {(enquiry.assignedTo || enquiry.telecaller) && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <InfoRow 
                        icon={<PersonIcon fontSize="small" />} 
                        label="Assigned To" 
                        value={enquiry.assignedTo} 
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <InfoRow 
                        icon={<PhoneIcon fontSize="small" />} 
                        label="Telecaller" 
                        value={enquiry.telecaller} 
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </InfoCard>

          {/* Enquiry Details */}
          {(enquiry.subject || enquiry.message) && (
            <InfoCard>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <SectionHeading icon={<NotesIcon fontSize="small" />} title="Enquiry Details" subtitle="Patient concern and context" />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <InfoRow 
                      icon={<EventNoteIcon fontSize="small" />} 
                      label="Subject" 
                      value={enquiry.subject} 
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Paper
                      variant="outlined"
                      sx={(theme) => ({
                        p: 2,
                        borderRadius: 2.25,
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? alpha(theme.palette.common.white, 0.06)
                            : alpha('#0f172a', 0.015),
                        borderColor:
                          theme.palette.mode === 'dark'
                            ? alpha(theme.palette.common.white, 0.12)
                            : alpha('#0f172a', 0.08),
                      })}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                        Message / Notes
                      </Typography>
                      <Typography variant="body1" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {enquiry.message}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </InfoCard>
          )}

          {/* Visits */}
          {hasVisits && (
            <InfoCard>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <SectionHeading icon={<VisibilityIcon fontSize="small" />} title="Visit History" subtitle="Open each visit to see only the entered details" />

                <Tabs
                  value={activeVisitTab}
                  onChange={(_, value) => setActiveVisitTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={(theme) => ({
                    mb: 3,
                    minHeight: 0,
                    '& .MuiTab-root': {
                      alignItems: 'flex-start',
                      textTransform: 'none',
                      minHeight: 78,
                      borderRadius: 3,
                      mr: 1,
                      px: 1.75,
                      py: 1.25,
                      border: '1px solid',
                      borderColor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.12)
                          : alpha('#0f172a', 0.08),
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.common.white, 0.06)
                          : 'rgba(255,255,255,0.78)',
                      color: 'text.primary',
                    },
                    '& .Mui-selected': {
                      bgcolor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.primary.main, 0.18)
                          : '#fff4e8',
                      borderColor: alpha(theme.palette.primary.main, 0.45),
                      boxShadow:
                        theme.palette.mode === 'dark'
                          ? `0 10px 24px ${alpha(theme.palette.primary.main, 0.2)}`
                          : '0 10px 24px rgba(245,124,0,0.10)',
                    },
                    '& .MuiTabs-indicator': {
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: theme.palette.primary.main,
                    },
                  })}
                >
                  {visits.map((visit: any, index: number) => (
                    <Tab
                      key={visit.id || index}
                      label={
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            Visit {index + 1}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {getVisitDateLabel(visit)}
                            {visit.visitTime ? ` · ${visit.visitTime}` : ''}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </Tabs>

                {activeVisit && (
                  <Box>
                    <Paper
                      variant="outlined"
                      sx={(theme) => ({
                        p: { xs: 2, md: 2.5 },
                        borderRadius: 3,
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? alpha(theme.palette.background.paper, 0.95)
                            : 'rgba(255,255,255,0.8)',
                        borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.16),
                        boxShadow:
                          theme.palette.mode === 'dark'
                            ? 'none'
                            : 'inset 0 1px 0 rgba(255,255,255,0.7)',
                      })}
                    >
                      <Grid container spacing={2.5}>
                        <Grid item xs={12} md={8}>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                            {getVisitServices(activeVisit).map((service) => (
                              <Chip
                                key={service.label}
                                label={service.label}
                                size="small"
                                color={service.color}
                                sx={{ borderRadius: 99, fontWeight: 700 }}
                              />
                            ))}
                            {getVisitServices(activeVisit).length === 0 && (
                              <Chip label="Visit recorded" size="small" variant="outlined" sx={{ borderRadius: 99 }} />
                            )}
                          </Stack>

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              {renderVisitField('Visit Date', getVisitDateLabel(activeVisit))}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              {renderVisitField('Visit Time', activeVisit.visitTime)}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              {renderVisitField('Visit Type', activeVisit.visitType === 'center' ? 'Center Visit' : activeVisit.visitType === 'home' ? 'Home Visit' : undefined)}
                            </Grid>
                            {activeVisit.visitType === 'home' && (
                              <Grid item xs={12} sm={6}>
                                {renderVisitField(
                                  'Visit Charges',
                                  `₹${Math.max(0, Number(activeVisit.homeVisitCharges) || 0).toLocaleString('en-IN')}`
                                )}
                              </Grid>
                            )}
                            <Grid item xs={12} sm={6}>
                              {renderVisitField('Center', getCenterName(activeVisit))}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              {renderVisitField(
                                'Recorded By',
                                activeVisit.createdByName ||
                                  activeVisit.createdByEmail ||
                                  activeVisit.createdByUid ||
                                  activeVisit.updatedByName ||
                                  activeVisit.updatedByEmail ||
                                  activeVisit.updatedByUid
                              )}
                            </Grid>
                          </Grid>
                        </Grid>

                        <Grid item xs={12} md={4}>
                          <MetricCard label="Visit Amount" value={formatCurrency(getVisitAmount(activeVisit)) || '—'} />
                        </Grid>
                      </Grid>
                    </Paper>

                    <Box sx={{ mt: 3, display: 'grid', gap: 2 }}>
                      {(activeVisit.hearingTest ||
                        hasValue(activeVisitHearingTestTypesLabel) ||
                        hasValue(activeVisit.testDoneBy) ||
                        hasValue(activeVisit.testResults) ||
                        hasValue(activeVisit.recommendations) ||
                        activeVisitAudiogramData ||
                        hasValue(activeVisitExternalPta?.viewUrl)) && (
                        <Paper
                      variant="outlined"
                      sx={(theme) => ({
                        p: 2.5,
                        borderRadius: 3,
                        bgcolor:
                          theme.palette.mode === 'dark'
                            ? alpha(theme.palette.info.main, 0.12)
                            : 'rgba(255,255,255,0.84)',
                        borderColor: alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.28 : 0.14),
                      })}
                    >
                          <SectionHeading icon={<MedicalServicesIcon fontSize="small" />} title="Hearing Test" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Test type(s)', activeVisitHearingTestTypesLabel)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Done By', activeVisit.testDoneBy)}</Grid>
                            {activeVisitHearingTestEntries.filter((e) => String(e?.testType || '').trim()).map(
                              (e, idx) => (
                                <Grid item xs={12} sm={6} key={String(e.id ?? `${e.testType}-${idx}`)}>
                                  {renderVisitField(
                                    String(e.testType || 'Test').trim() || 'Test',
                                    formatCurrency(Number(e.price ?? e.testPrice) || 0)
                                  )}
                                </Grid>
                              )
                            )}
                            {activeVisitHearingTestEntries.filter((e) => String(e?.testType || '').trim()).length >
                              1 && (
                              <Grid item xs={12} sm={6}>
                                {renderVisitField(
                                  'Total (tests)',
                                  formatCurrency(sumHearingTestEntryPrices(activeVisit))
                                )}
                              </Grid>
                            )}
                            {activeVisitHearingTestEntries.filter((e) => String(e?.testType || '').trim())
                              .length === 0 &&
                              hasValue(sumHearingTestEntryPrices(activeVisit)) && (
                                <Grid item xs={12} sm={6}>
                                  {renderVisitField('Price', formatCurrency(sumHearingTestEntryPrices(activeVisit)))}
                                </Grid>
                              )}
                            <Grid item xs={12}>{renderVisitField('Results', activeVisit.testResults)}</Grid>
                            <Grid item xs={12}>{renderVisitField('Recommendations', activeVisit.recommendations)}</Grid>
                          </Grid>
                          {(activeVisitExternalPta?.viewUrl || activeVisitAudiogramData) && (
                            <Grid
                              container
                              spacing={2}
                              sx={{
                                mt: 2,
                                alignItems: 'flex-start',
                              }}
                            >
                              {activeVisitExternalPta?.viewUrl && (
                                <Grid
                                  item
                                  xs={12}
                                  md={activeVisitAudiogramData ? 6 : 12}
                                >
                                  <Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                      PTA report (external)
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                                      {activeVisitExternalPta.patientLabel || activeVisitExternalPta.reportId}
                                    </Typography>
                                    {activeVisitExternalPta.testDate && (
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                        Test date: {formatPtaTestDateForDisplay(activeVisitExternalPta.testDate)}
                                      </Typography>
                                    )}
                                    <Link
                                      href={activeVisitExternalPta.viewUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      variant="body2"
                                    >
                                      Open PTA report in new tab
                                    </Link>
                                    {activeVisitExternalPta.audiogramData &&
                                    typeof activeVisitExternalPta.audiogramData === 'object' &&
                                    Object.keys(activeVisitExternalPta.audiogramData).length > 0 ? (
                                      <Box
                                        sx={{
                                          mt: 2,
                                          maxWidth: activeVisitAudiogramData ? '100%' : 720,
                                          mx: activeVisitAudiogramData ? 0 : 'auto',
                                        }}
                                      >
                                        <Typography
                                          variant="subtitle2"
                                          sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}
                                        >
                                          Audiogram (from PTA)
                                        </Typography>
                                        <PureToneAudiogram
                                          data={activeVisitExternalPta.audiogramData as any}
                                          onChange={() => {}}
                                          editable={false}
                                          readOnly={true}
                                          compact
                                        />
                                      </Box>
                                    ) : (
                                      <Box sx={{ mt: 2 }}>
                                        <Typography
                                          variant="subtitle2"
                                          sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}
                                        >
                                          PTA audiogram preview
                                        </Typography>
                                        <Box
                                          sx={{
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            border: 1,
                                            borderColor: 'divider',
                                            height: { xs: 260, sm: 300 },
                                            bgcolor: 'grey.100',
                                            maxWidth: '100%',
                                          }}
                                        >
                                          <Box
                                            component="iframe"
                                            title={`PTA report ${activeVisitExternalPta.reportId}`}
                                            src={activeVisitExternalPta.embedUrl || activeVisitExternalPta.viewUrl}
                                            sx={{
                                              width: '100%',
                                              height: '100%',
                                              border: 0,
                                              display: 'block',
                                            }}
                                            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                                          />
                                        </Box>
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          component="div"
                                          sx={{ mt: 1 }}
                                        >
                                          Embedded PTA report. If this stays blank, your PTA app may block iframes (
                                          <Box component="span" sx={{ fontFamily: 'monospace' }}>
                                            X-Frame-Options
                                          </Box>
                                          ) — use &quot;Open PTA report&quot; above, or add an embed URL (
                                          <Box component="span" sx={{ fontFamily: 'monospace' }}>
                                            embedUrl
                                          </Box>
                                          ) in the list API.
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                </Grid>
                              )}
                              {activeVisitAudiogramData && (
                                <Grid
                                  item
                                  xs={12}
                                  md={activeVisitExternalPta?.viewUrl ? 6 : 12}
                                >
                                  <Box
                                    sx={{
                                      maxWidth: activeVisitExternalPta?.viewUrl ? '100%' : 720,
                                      mx: activeVisitExternalPta?.viewUrl ? 0 : 'auto',
                                    }}
                                  >
                                    <Typography
                                      variant="subtitle2"
                                      sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}
                                    >
                                      Audiogram (CRM)
                                    </Typography>
                                    <PureToneAudiogram
                                      data={activeVisitAudiogramData}
                                      onChange={() => {}}
                                      editable={false}
                                      readOnly={true}
                                      compact
                                    />
                                  </Box>
                                </Grid>
                              )}
                            </Grid>
                          )}
                        </Paper>
                      )}

                      {showEntVisitSection && (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2.5,
                            borderRadius: 3,
                            bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)'),
                            borderColor: alpha('#7c3aed', 0.18),
                          }}
                        >
                          <SectionHeading icon={<MedicalServicesIcon fontSize="small" />} title="ENT service" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              {renderVisitField('Procedure(s)', activeVisitEntTypesLabel)}
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              {renderVisitField(
                                'Done by',
                                activeVisit.entServiceDetails?.doneBy ?? activeVisit.entProcedureDoneBy
                              )}
                            </Grid>
                            {activeVisitEntProcedureEntries
                              .filter((e) => String(e?.procedureType || '').trim())
                              .map((e, idx) => (
                                <Grid item xs={12} sm={6} key={String(e.id ?? `${e.procedureType}-${idx}`)}>
                                  {renderVisitField(
                                    String(e.procedureType || 'Procedure').trim() || 'Procedure',
                                    formatCurrency(Number(e.price ?? e.procedurePrice) || 0)
                                  )}
                                </Grid>
                              ))}
                            {activeVisitEntProcedureEntries.filter((e) => String(e?.procedureType || '').trim())
                              .length > 1 && (
                              <Grid item xs={12} sm={6}>
                                {renderVisitField(
                                  'Total (ENT)',
                                  formatCurrency(sumEntProcedurePrices(activeVisit))
                                )}
                              </Grid>
                            )}
                            {activeVisitEntProcedureEntries.filter((e) => String(e?.procedureType || '').trim())
                              .length === 0 &&
                              hasValue(sumEntProcedurePrices(activeVisit)) && (
                                <Grid item xs={12} sm={6}>
                                  {renderVisitField('Price', formatCurrency(sumEntProcedurePrices(activeVisit)))}
                                </Grid>
                              )}
                          </Grid>
                        </Paper>
                      )}

                      {(activeVisit.trialGiven ||
                        activeVisit.hearingAidTrial ||
                        hasValue(activeVisit.trialStartDate) ||
                        hasValue(activeVisit.trialHearingAidBrand) ||
                        hasValue(activeVisit.trialHearingAidModel) ||
                        hasValue(activeVisit.trialSerialNumber) ||
                        getHomeTrialSecurityDepositAmount(activeVisit) > 0) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)'), borderColor: alpha('#f59e0b', 0.18) }}>
                          <SectionHeading icon={<HearingIcon fontSize="small" />} title="Trial Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Brand', activeVisit.trialHearingAidBrand || activeVisit.hearingAidBrand)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Model', activeVisit.trialHearingAidModel || activeVisit.hearingAidModel)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Type', activeVisit.trialHearingAidType || activeVisit.hearingAidType)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Serial Number', activeVisit.trialSerialNumber)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Ear', activeVisit.whichEar)}</Grid>
                            {isHomeTrialVisit(activeVisit) && (
                              <>
                                <Grid item xs={12} sm={6}>
                                  {renderVisitField(
                                    'Duration',
                                    hasValue(activeVisit.trialDuration)
                                      ? `${activeVisit.trialDuration} days`
                                      : undefined
                                  )}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  {renderVisitField('Start Date', activeVisit.trialStartDate)}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  {renderVisitField('End Date', activeVisit.trialEndDate)}
                                </Grid>
                              </>
                            )}
                            {(() => {
                              const agreed = getHomeTrialSecurityDepositAmount(activeVisit);
                              if (!isHomeTrialVisit(activeVisit) || agreed <= 0) return null;
                              const trialPaymentCandidates = [
                                ...(Array.isArray(enquiry?.payments) ? enquiry.payments : []),
                                ...(Array.isArray(enquiry?.paymentRecords) ? enquiry.paymentRecords : []),
                              ];
                              const payList = trialPaymentCandidates.filter((p: any) => {
                                const isTrialDeposit =
                                  p.paymentFor === 'trial_home_security_deposit' ||
                                  p.paymentType === 'staff_trial_request';
                                if (!isTrialDeposit) return false;
                                const rid = p.relatedVisitId;
                                if (rid !== undefined && rid !== null && String(rid) !== '') {
                                  return String(rid) === String(activeVisit.id ?? '');
                                }
                                return visits.length === 1;
                              });
                              return (
                                <>
                                  <Grid item xs={12} sm={6}>
                                    {renderVisitField('Security deposit (agreed)', formatCurrency(agreed))}
                                  </Grid>
                                  {payList.length > 0 ? (
                                    <Grid item xs={12}>
                                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                                        Recorded payments
                                      </Typography>
                                      <Stack spacing={0.75}>
                                        {payList.map((p: any, idx: number) => (
                                          <Typography key={p.id || idx} variant="body2">
                                            {formatCurrency(Number(p.amount))} · {p.paymentMode || p.paymentMethod || '—'}
                                            {p.referenceNumber ? ` · Ref: ${p.referenceNumber}` : ''}
                                            {p.remarks ? ` · ${p.remarks}` : ''}
                                            {p.paymentDate ? ` · ${p.paymentDate}` : ''}
                                          </Typography>
                                        ))}
                                      </Stack>
                                    </Grid>
                                  ) : (
                                    <Grid item xs={12}>
                                      <Typography variant="body2" color="text.secondary">
                                        No payment logged yet — record it in the enquiry form under Payments & Billing.
                                      </Typography>
                                    </Grid>
                                  )}
                                </>
                              );
                            })()}
                            {isHomeTrialVisit(activeVisit) && (
                              <Grid item xs={12} sm={6}>
                                {renderVisitField('Result', activeVisit.trialResult)}
                              </Grid>
                            )}
                            {isHomeTrialVisit(activeVisit) && activeVisit.trialResult === 'unsuccessful' && (
                              <>
                                <Grid item xs={12} sm={6}>
                                  {renderVisitField('Refund Amount', formatCurrency(activeVisit.trialRefundAmount))}
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  {renderVisitField('Refund Date', activeVisit.trialRefundDate)}
                                </Grid>
                              </>
                            )}
                            <Grid item xs={12}>{renderVisitField('Notes', activeVisit.trialNotes)}</Grid>
                          </Grid>
                        </Paper>
                      )}

                      {visitShowsBookingDetails(activeVisit) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)'), borderColor: alpha('#6366f1', 0.14) }}>
                          <SectionHeading icon={<ReceiptIcon fontSize="small" />} title="Booking Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Brand', activeVisit.hearingAidBrand)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Model', activeVisit.hearingAidModel)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Type', activeVisit.hearingAidType)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Ear', activeVisit.whichEar)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Booking Date', activeVisit.bookingDate)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Advance Amount', formatCurrency(activeVisit.bookingAdvanceAmount))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Selling price (per unit)', formatCurrency(activeVisit.bookingSellingPrice))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Quantity', hasValue(activeVisit.bookingQuantity) ? String(activeVisit.bookingQuantity) : undefined)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('MRP (per unit)', formatCurrency(activeVisit.hearingAidPrice))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Booking Total', formatCurrency(getBookingTotal(activeVisit)))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Balance Amount', formatCurrency(Math.max(getBookingTotal(activeVisit) - (Number(activeVisit.bookingAdvanceAmount) || 0), 0)))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Warranty', activeVisit.warranty)}</Grid>
                          </Grid>
                        </Paper>
                      )}

                      {((activeVisit.hearingAidSale || activeVisit.purchaseFromTrial) &&
                        (hasValue(activeVisit.salesAfterTax) ||
                          hasValue(activeVisit.grossSalesBeforeTax) ||
                          hasValue(activeVisit.taxAmount) ||
                          (Array.isArray(activeVisit.products) && activeVisit.products.length > 0))) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)'), borderColor: alpha('#16a34a', 0.15) }}>
                          <SectionHeading icon={<CurrencyRupeeIcon fontSize="small" />} title="Sale Details" />
                          <Grid container spacing={2} sx={{ mb: Array.isArray(activeVisit.products) && activeVisit.products.length > 0 ? 2 : 0 }}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Sale Date', activeVisit.purchaseDate)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Total', formatCurrency(activeVisit.salesAfterTax || activeVisit.hearingAidPrice))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Gross Before Tax', formatCurrency(activeVisit.grossSalesBeforeTax))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Tax Amount', formatCurrency(activeVisit.taxAmount))}</Grid>
                          </Grid>
                          {Array.isArray(activeVisit.products) && activeVisit.products.length > 0 && (
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.25, overflow: 'hidden' }}>
                              <Table size="small">
                                <TableHead sx={{ bgcolor: alpha('#16a34a', 0.06) }}>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Serial</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Per unit (incl. GST)</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Line total</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {activeVisit.products.map((product: any, productIndex: number) => (
                                    <TableRow key={product.id || productIndex}>
                                      <TableCell>{product.name || product.productName || '—'}</TableCell>
                                      <TableCell align="right">{saleLineQty(product)}</TableCell>
                                      <TableCell>{product.serialNumber || '—'}</TableCell>
                                      <TableCell align="right">
                                        {formatCurrency(product.finalAmount ?? product.sellingPrice ?? product.mrp) || '—'}
                                      </TableCell>
                                      <TableCell align="right">
                                        {formatCurrency(
                                          (Number(product.finalAmount ?? product.sellingPrice ?? 0) || 0) *
                                            saleLineQty(product)
                                        ) || '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                        </Paper>
                      )}

                      {(activeVisit.accessory ||
                        hasValue(activeVisit.accessoryName) ||
                        hasValue(activeVisit.accessoryAmount) ||
                        hasValue(activeVisit.accessoryDetails)) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)') }}>
                          <SectionHeading icon={<NotesIcon fontSize="small" />} title="Accessory Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Accessory', activeVisit.accessoryName)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Quantity', hasValue(activeVisit.accessoryQuantity) ? String(activeVisit.accessoryQuantity) : undefined)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Amount', activeVisit.accessoryFOC ? 'Free of Cost' : formatCurrency(activeVisit.accessoryAmount))}</Grid>
                            <Grid item xs={12}>{renderVisitField('Details', activeVisit.accessoryDetails)}</Grid>
                          </Grid>
                        </Paper>
                      )}

                      {(activeVisit.programming ||
                        hasValue(activeVisit.programmingReason) ||
                        hasValue(activeVisit.programmingAmount) ||
                        hasValue(activeVisit.programmingDoneBy)) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)') }}>
                          <SectionHeading icon={<MedicalServicesIcon fontSize="small" />} title="Programming Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Hearing Aid', activeVisit.hearingAidName)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Done By', activeVisit.programmingDoneBy)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Amount', formatCurrency(activeVisit.programmingAmount))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Purchase Date', activeVisit.hearingAidPurchaseDate)}</Grid>
                            <Grid item xs={12}>{renderVisitField('Reason', activeVisit.programmingReason)}</Grid>
                          </Grid>
                        </Paper>
                      )}

                      {(activeVisit.repair ||
                        hasValue(activeVisit.repairReason) ||
                        hasValue(activeVisit.repairType) ||
                        hasValue(activeVisit.repairAmount) ||
                        hasValue(activeVisit.repairStatus)) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)') }}>
                          <SectionHeading icon={<MedicalServicesIcon fontSize="small" />} title="Repair Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Repair Type', activeVisit.repairType)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Status', activeVisit.repairStatus)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Amount', formatCurrency(activeVisit.repairAmount))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Completed Date', activeVisit.repairCompletedDate)}</Grid>
                            <Grid item xs={12}>{renderVisitField('Reason', activeVisit.repairReason)}</Grid>
                            <Grid item xs={12}>{renderVisitField('Notes', activeVisit.repairNotes || activeVisit.repairDescription)}</Grid>
                          </Grid>
                        </Paper>
                      )}

                      {(activeVisit.counselling ||
                        hasValue(activeVisit.counsellingType) ||
                        hasValue(activeVisit.counsellingAmount) ||
                        hasValue(activeVisit.counsellingDoneBy)) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)') }}>
                          <SectionHeading icon={<NotesIcon fontSize="small" />} title="Counselling Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Type', activeVisit.counsellingType)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Done By', activeVisit.counsellingDoneBy)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Duration', hasValue(activeVisit.counsellingDuration) ? `${activeVisit.counsellingDuration} minutes` : undefined)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Amount', formatCurrency(activeVisit.counsellingAmount))}</Grid>
                            <Grid item xs={12}>{renderVisitField('Notes', activeVisit.counsellingNotes || activeVisit.counsellingTopics || activeVisit.counsellingRecommendations)}</Grid>
                          </Grid>
                        </Paper>
                      )}

                      {(hasValue(activeVisit.visitNotes) || hasValue(activeVisit.notes)) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.96) : 'rgba(255,255,255,0.84)') }}>
                          <SectionHeading icon={<NotesIcon fontSize="small" />} title="Notes" />
                          <Grid container spacing={2}>
                            <Grid item xs={12}>{renderVisitField('Visit Notes', activeVisit.visitNotes)}</Grid>
                            <Grid item xs={12}>{renderVisitField('Additional Notes', activeVisit.notes)}</Grid>
                          </Grid>
                        </Paper>
                      )}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </InfoCard>
          )}

          {/* Scheduled appointments (scheduler) */}
          <InfoCard>
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 2,
                  flexWrap: 'wrap',
                  mb: 2,
                }}
              >
                <SectionHeading
                  icon={<CalendarIcon fontSize="small" />}
                  title="Appointments"
                  subtitle={`${appointmentStats.total} total · ${appointmentStats.completed} completed · ${appointmentStats.cancelled} cancelled · ${appointmentStats.upcoming} upcoming`}
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => router.push('/appointments')}
                  sx={{ borderRadius: 99, flexShrink: 0, mt: { xs: 0, sm: 0.5 } }}
                >
                  Open scheduler
                </Button>
              </Box>
              {appointmentStats.pastScheduled > 0 && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1.5, fontWeight: 600 }}>
                  {appointmentStats.pastScheduled} past slot(s) still marked scheduled — mark completed or cancel in the
                  scheduler.
                </Typography>
              )}
              {enquiryAppointments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No appointments linked to this enquiry yet. Schedule from the appointment scheduler after selecting this
                  patient.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.25, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: alpha('#0f172a', 0.03) }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {enquiryAppointments.map((appt: any) => {
                        const st = getEnquiryAppointmentStatus(appt);
                        const start = appt.start ? new Date(appt.start) : null;
                        const when =
                          start && !Number.isNaN(start.getTime())
                            ? `${start.toLocaleDateString()} · ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : '—';
                        return (
                          <TableRow key={appt.id}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{when}</TableCell>
                            <TableCell>{appt.type === 'home' ? 'Home' : 'Center'}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={st === 'cancelled' ? 'Cancelled' : st === 'completed' ? 'Completed' : 'Scheduled'}
                                color={st === 'cancelled' ? 'default' : st === 'completed' ? 'success' : 'primary'}
                                variant={st === 'scheduled' ? 'filled' : 'outlined'}
                                sx={{ fontWeight: 700, borderRadius: 99 }}
                              />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 220, color: 'text.secondary' }}>
                              <Typography variant="body2" noWrap title={appt.notes || ''}>
                                {appt.notes || '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </InfoCard>

          {/* Call History */}
          <InfoCard>
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <SectionHeading
                icon={<PhoneIcon fontSize="small" />}
                title="Call History"
                subtitle={`${followUpsList.length} follow-up ${followUpsList.length === 1 ? 'entry' : 'entries'}`}
              />
              {userProfile?.role !== 'audiologist' && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={openAddFollowUpDialog}
                    sx={{
                      borderRadius: 99,
                      bgcolor: '#7c3aed',
                      '&:hover': { bgcolor: '#6d28d9' },
                      boxShadow: '0 8px 22px rgba(124,58,237,0.25)',
                    }}
                  >
                    Log call
                  </Button>
                </Box>
              )}

              {followUpsList.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  {userProfile?.role === 'audiologist'
                    ? 'No calls logged yet.'
                    : 'No calls logged yet. Use Log call to add one without opening edit mode.'}
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.25, overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: alpha('#0f172a', 0.03) }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Next Call</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Called By</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {followUpsList.map((followUp: any, index: number) => (
                        <TableRow key={followUp.id || index}>
                          <TableCell>{formatFollowUpDateCell(followUp.date)}</TableCell>
                          <TableCell>{followUp.remarks ?? '—'}</TableCell>
                          <TableCell>{formatFollowUpDateCell(followUp.nextFollowUpDate)}</TableCell>
                          <TableCell>{followUp.callerName || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </InfoCard>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={5}>
          <Box
            sx={{
              position: { md: 'sticky' },
              top: { md: 24 },
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              alignItems: 'start',
            }}
          >
          {/* Receipts */}
          {hasReceipts && (
            <InfoCard sx={{ gridColumn: { md: '1 / -1' } }}>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <SectionHeading
                  icon={<ReceiptIcon fontSize="small" />}
                  title="Receipts & invoices"
                  subtitle="Booking and trial receipts, payment acknowledgment, plus sales invoices (PDF)"
                />
                <Stack spacing={2}>
                  {bookingReceipts.map(({ visit, index }: { visit: any; index: number }) => (
                    <Paper key={`booking-${index}`} variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: alpha('#4f46e5', 0.03), borderColor: alpha('#4f46e5', 0.12) }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Chip label="Booking Receipt" size="small" color="primary" sx={{ borderRadius: 99, fontWeight: 700 }} />
                        <Typography variant="caption" color="text.secondary">
                          {visit.bookingDate || visit.visitDate || '—'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                        {[visit.hearingAidBrand, visit.hearingAidModel].filter(Boolean).join(' ') || 'Booked Device'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                        MRP (per unit): {visit.hearingAidPrice ? `₹${Number(visit.hearingAidPrice).toLocaleString('en-IN')}` : '—'}
                        {' · '}
                        Qty: {Number(visit.bookingQuantity) || 1}
                        {' · '}
                        Selling (per unit):{' '}
                        {visit.bookingSellingPrice
                          ? `₹${Number(visit.bookingSellingPrice).toLocaleString('en-IN')}`
                          : '—'}
                        {' · '}
                        Balance due:{' '}
                        {visit.bookingSellingPrice
                          ? `₹${Math.max(
                              (Number(visit.bookingSellingPrice) || 0) * (Number(visit.bookingQuantity) || 1) -
                                Number(visit.bookingAdvanceAmount || 0),
                              0
                            ).toLocaleString('en-IN')}`
                          : '—'}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => openBookingReceiptPDF(enquiry, visit, { centerName: getCenterName(visit) })}
                          sx={{ borderRadius: 99 }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => downloadBookingReceiptPDF(enquiry, visit, undefined, { centerName: getCenterName(visit) })}
                          sx={{ borderRadius: 99 }}
                        >
                          Download
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                  
                  {trialReceipts.map(({ visit, index }: { visit: any; index: number }) => (
                    <Paper key={`trial-${index}`} variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: alpha('#f59e0b', 0.035), borderColor: alpha('#f59e0b', 0.12) }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Chip label="Trial Receipt" size="small" color="warning" sx={{ borderRadius: 99, fontWeight: 700 }} />
                        <Typography variant="caption" color="text.secondary">
                          {visit.trialStartDate || visit.visitDate || '—'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                        {[visit.trialHearingAidBrand, visit.trialHearingAidModel, visit.hearingAidBrand, visit.hearingAidModel].filter(Boolean).join(' ') || 'Trial Device'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                        {isHomeTrialVisit(visit) ? 'Home Trial' : 'Clinic / In-office Trial'}
                        {isHomeTrialVisit(visit) && visit.trialDuration ? ` · ${visit.trialDuration} days` : ''}
                        {isHomeTrialVisit(visit) && visit.trialSerialNumber ? ` · ${visit.trialSerialNumber}` : ''}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => openTrialReceiptPDF(enquiry, visit, { centerName: getCenterName(visit) })}
                          sx={{ borderRadius: 99 }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() => downloadTrialReceiptPDF(enquiry, visit, undefined, { centerName: getCenterName(visit) })}
                          sx={{ borderRadius: 99 }}
                        >
                          Download
                        </Button>
                      </Stack>
                    </Paper>
                  ))}

                  {paymentEntries.length > 0 && (
                    <Paper
                      key="payment-acknowledgment"
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: alpha('#0f766e', 0.04),
                        borderColor: alpha('#0f766e', 0.15),
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Chip
                          label="Payment acknowledgment"
                          size="small"
                          color="success"
                          sx={{ borderRadius: 99, fontWeight: 700 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {paymentEntries.length} entr{paymentEntries.length === 1 ? 'y' : 'ies'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                        All recorded payments with mode and references (PDF).
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() =>
                            openPaymentAcknowledgmentPDF(enquiry, {
                              centerName: getCenterName(Array.isArray(visits) ? visits[0] : undefined),
                            })
                          }
                          sx={{ borderRadius: 99 }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          onClick={() =>
                            downloadPaymentAcknowledgmentPDF(enquiry, undefined, {
                              centerName: getCenterName(Array.isArray(visits) ? visits[0] : undefined),
                            })
                          }
                          sx={{ borderRadius: 99 }}
                        >
                          Download
                        </Button>
                      </Stack>
                    </Paper>
                  )}

                  {saleInvoiceReceipts.map(({ visit, index }: { visit: any; index: number }) => (
                    <Paper
                      key={`sale-inv-${index}`}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: alpha('#16a34a', 0.04),
                        borderColor: alpha('#16a34a', 0.14),
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Chip label="Sales invoice" size="small" color="success" sx={{ borderRadius: 99, fontWeight: 700 }} />
                        <Typography variant="caption" color="text.secondary">
                          {visit.purchaseDate || visit.visitDate || '—'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>
                        {Array.isArray(visit.products) && visit.products.length > 0
                          ? visit.products
                              .map((p: any) => p.name || p.productName)
                              .filter(Boolean)
                              .join(', ') || 'Hearing aid sale'
                          : 'Hearing aid sale'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>
                        Total (incl. GST):{' '}
                        {visit.salesAfterTax != null && visit.salesAfterTax !== ''
                          ? `₹${Number(visit.salesAfterTax).toLocaleString('en-IN')}`
                          : '—'}
                        {visit.taxAmount != null && visit.taxAmount !== '' && Number(visit.taxAmount) > 0
                          ? ` · Tax: ₹${Number(visit.taxAmount).toLocaleString('en-IN')}`
                          : ''}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<PictureAsPdfIcon />}
                          onClick={async () => {
                            try {
                              const invoiceNumber = await getVisitInvoiceNumber(index);
                              const payload = enquiryVisitToInvoiceSalePayload(enquiry, {
                                ...visit,
                                invoiceNumber,
                              });
                              setInvoicePdfData(convertSaleToInvoiceData(payload));
                              setInvoicePdfOpen(true);
                            } catch (e) {
                              console.error('Failed to prepare invoice PDF number:', e);
                              setFollowUpFeedback({
                                open: true,
                                message: 'Invoice number is missing. Ask admin to set it in Sales & Invoicing.',
                                severity: 'error',
                              });
                            }
                          }}
                          sx={{ borderRadius: 99 }}
                        >
                          Invoice PDF…
                        </Button>
                        <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mt: 0.5 }}>
                          Same template picker as Sales &amp; Invoicing — choose an Invoice Manager template, then open, download, or print.
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </InfoCard>
          )}

          {/* Payment Summary */}
          {hasPayments && (
            <InfoCard>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <SectionHeading icon={<CurrencyRupeeIcon fontSize="small" />} title="Payment Summary" subtitle="Recorded payment entries" />
                
                <Stack spacing={1.5}>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={4}>
                      <MetricCard label="Total Due" value={formatCurrency(totalDue) || '₹0'} accent="#2563eb" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <MetricCard label="Paid" value={formatCurrency(totalPaid) || '₹0'} accent="#0f766e" />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <MetricCard label="Pending" value={formatCurrency(pendingAmount) || '₹0'} accent={pendingAmount > 0 ? '#dc2626' : '#16a34a'} />
                    </Grid>
                  </Grid>

                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2.25,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      bgcolor: alpha(
                        paymentStatus === 'fully_paid' ? '#16a34a' : paymentStatus === 'partial' ? '#d97706' : '#dc2626',
                        0.06
                      ),
                      borderColor: alpha(
                        paymentStatus === 'fully_paid' ? '#16a34a' : paymentStatus === 'partial' ? '#d97706' : '#dc2626',
                        0.18
                      ),
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
                      Payment Status
                    </Typography>
                    <Chip
                      label={paymentStatus === 'fully_paid' ? 'Fully Paid' : paymentStatus === 'partial' ? 'Partially Paid' : 'Pending'}
                      color={paymentStatus === 'fully_paid' ? 'success' : paymentStatus === 'partial' ? 'warning' : 'error'}
                      sx={{ borderRadius: 99, fontWeight: 700 }}
                    />
                  </Paper>

                  {paymentEntries.map((payment: any, index: number) => (
                    <Paper
                      key={payment.id != null ? String(payment.id) : `pay-${index}`}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2.25,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 2,
                        bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.94) : 'rgba(255,255,255,0.8)'),
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {payment.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {payment.date || '—'}
                          {payment.mode ? ` · ${String(payment.mode).toUpperCase()}` : ''}
                        </Typography>
                        {payment.actorName ? (
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.35 }}>
                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                              Recorded by:{' '}
                            </Box>
                            {payment.actorName}
                          </Typography>
                        ) : null}
                        {payment.referenceNumber ? (
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                              Reference:{' '}
                            </Box>
                            {payment.referenceNumber}
                          </Typography>
                        ) : null}
                        {payment.remarks ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            sx={{ mt: 0.35, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          >
                            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                              Remarks:{' '}
                            </Box>
                            {payment.remarks}
                          </Typography>
                        ) : null}
                      </Box>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 800, color: '#0f766e', flexShrink: 0, alignSelf: 'center' }}
                      >
                        ₹{(payment.amount || 0).toLocaleString()}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </CardContent>
            </InfoCard>
          )}

          {/* Quick Stats */}
          <InfoCard>
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
              <SectionHeading icon={<CalendarIcon fontSize="small" />} title="Quick Stats" subtitle="At-a-glance profile summary" />
              
              <Stack spacing={1.5}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.94) : 'rgba(255,255,255,0.8)') }}>
                  <Typography variant="body2" color="text.secondary">Total Visits</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{visits.length}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.94) : 'rgba(255,255,255,0.8)') }}>
                  <Typography variant="body2" color="text.secondary">Follow-up Calls</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{followUpsList.length}</Typography>
                </Paper>
                {enquiry.followUpDate && (
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.94) : 'rgba(255,255,255,0.8)') }}>
                    <Typography variant="body2" color="text.secondary">Next Follow-up</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {new Date(enquiry.followUpDate).toLocaleDateString()}
                    </Typography>
                  </Paper>
                )}
                
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.94) : 'rgba(255,255,255,0.8)') }}>
                  <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatEnquiryDate(enquiry.updatedAt, 'Never')}
                  </Typography>
                </Paper>
              </Stack>
            </CardContent>
          </InfoCard>
          </Box>
        </Grid>
      </Grid>
      </Box>

      <Dialog
        open={addFollowUpOpen}
        onClose={() => !addFollowUpSaving && setAddFollowUpOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{
          backdrop: { sx: { backdropFilter: 'blur(6px)' } },
        }}
        PaperProps={{
          elevation: 0,
          sx: {
            borderRadius: 4,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: alpha('#7c3aed', 0.22),
            boxShadow: '0 24px 64px rgba(91, 33, 182, 0.18), 0 0 0 1px rgba(255,255,255,0.06) inset',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            background: 'linear-gradient(125deg, #7c3aed 0%, #6d28d9 42%, #5b21b6 100%)',
            color: '#fff',
            px: 3,
            py: 2.75,
            pr: 5,
          }}
        >
          <IconButton
            aria-label="Close"
            onClick={() => !addFollowUpSaving && setAddFollowUpOpen(false)}
            disabled={addFollowUpSaving}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'rgba(255,255,255,0.92)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Stack direction="row" alignItems="flex-start" spacing={1.75}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.28)',
                flexShrink: 0,
              }}
            >
              <PhoneInTalkIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Log call
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.75, opacity: 0.92, lineHeight: 1.5, maxWidth: 420 }}>
                Record a follow-up the same way as in edit enquiry — telecallers come from your staff list and role
                settings.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ p: 0, bgcolor: alpha('#7c3aed', 0.03) }}>
          <Stack spacing={2.5} sx={{ p: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Call date"
                  type="date"
                  value={newFollowUp.date}
                  onChange={(e) => setNewFollowUp((s) => ({ ...s, date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                  required
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.95)' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Next follow-up"
                  type="date"
                  value={newFollowUp.nextFollowUpDate}
                  onChange={(e) => setNewFollowUp((s) => ({ ...s, nextFollowUpDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.95)' } }}
                />
              </Grid>
            </Grid>

            <FormControl
              fullWidth
              size="small"
              required
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(255,255,255,0.95)' } }}
            >
              <InputLabel id="log-call-caller-label">Call done by</InputLabel>
              <Select
                labelId="log-call-caller-label"
                label="Call done by"
                value={
                  telecallerDialogOptions.includes(newFollowUp.callerName) ? newFollowUp.callerName : ''
                }
                onChange={(e) =>
                  setNewFollowUp((s) => ({ ...s, callerName: String(e.target.value) }))
                }
              >
                {telecallerDialogOptions.map((name) => (
                  <MenuItem key={name} value={name} sx={{ borderRadius: 1, mx: 0.5, my: 0.25 }}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Remarks / notes"
              placeholder="What was discussed? Outcome, objections, next steps…"
              value={newFollowUp.remarks}
              onChange={(e) => setNewFollowUp((s) => ({ ...s, remarks: e.target.value }))}
              fullWidth
              multiline
              minRows={3}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.95)',
                  alignItems: 'flex-start',
                },
              }}
            />

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
              Same list as <strong>Edit enquiry</strong> → follow-up “Call done by”: active staff whose job role is
              included for telecallers. Use the pencil icon there to change which roles appear (saved in this browser).
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            gap: 1,
            bgcolor: 'rgba(255,255,255,0.92)',
            borderTop: '1px solid',
            borderColor: alpha('#7c3aed', 0.12),
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={() => setAddFollowUpOpen(false)}
            disabled={addFollowUpSaving}
            sx={{ borderRadius: 99, px: 2.25, textTransform: 'none', fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveFollowUp()}
            disabled={addFollowUpSaving || !newFollowUp.callerName.trim() || !newFollowUp.date}
            sx={{
              borderRadius: 99,
              px: 2.75,
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#7c3aed',
              boxShadow: '0 10px 28px rgba(124,58,237,0.35)',
              '&:hover': { bgcolor: '#6d28d9' },
            }}
          >
            {addFollowUpSaving ? 'Saving…' : 'Save call'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={shareSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setShareSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShareSnackbar((s) => ({ ...s, open: false }))}
          severity={shareSnackbar.message.startsWith('Could not') ? 'warning' : 'success'}
          sx={{ width: '100%' }}
        >
          {shareSnackbar.message}
        </Alert>
      </Snackbar>

      <Snackbar
        open={followUpFeedback.open}
        autoHideDuration={5000}
        onClose={() => setFollowUpFeedback((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setFollowUpFeedback((s) => ({ ...s, open: false }))}
          severity={followUpFeedback.severity}
          sx={{ width: '100%' }}
        >
          {followUpFeedback.message}
        </Alert>
      </Snackbar>

      {invoicePdfData && (
        <InvoicePrintConfirmModal
          open={invoicePdfOpen}
          onClose={() => {
            setInvoicePdfOpen(false);
            setInvoicePdfData(null);
          }}
          invoiceData={invoicePdfData}
          userId={user?.uid}
          extraPdfActions
        />
      )}
    </PageShell>
  );
}