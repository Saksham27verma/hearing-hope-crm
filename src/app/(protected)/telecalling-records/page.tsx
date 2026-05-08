'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  Collapse,
  Stack,
  Divider,
  Avatar,
  TablePagination,
  CircularProgress,
  Alert,
  Tooltip,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  OutlinedInput,
} from '@mui/material';
import type { ChipProps } from '@mui/material/Chip';
import MuiLink from '@mui/material/Link';
import { alpha } from '@mui/material/styles';
import Link from 'next/link';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  Visibility as PreviewIcon,
  Add as AddIcon,
  OpenInNew as OpenInNewIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { collection, getDocs, getDoc, query, orderBy, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { addHours, addMinutes, endOfDay, format, isWithinInterval, parse, parseISO, startOfDay } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { getEnquiryStatusMeta, type EnquiryStatusChipColor } from '@/utils/enquiryStatus';
import { HotEnquiryBadgeChip } from '@/components/enquiries/HotEnquiryIndicator';
import {
  getAllActiveStaffDisplayNames,
  collectTelecallerExtrasFromEnquiry,
  pickDefaultTelecallerName,
  type StaffRecord,
} from '@/utils/enquiryTelecallerOptions';
import { fetchStaffRecordsWithServerFallback } from '@/utils/fetchStaffForEnquiryForms';

interface FollowUp {
  id: string;
  date: string;
  dateTime?: string;
  remarks: string;
  nextFollowUpDate: string;
  nextFollowUpDateTime?: string;
  callerName: string;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
}

interface Enquiry {
  id?: string;
  name?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  subject?: string;
  message?: string;
  notes?: string;
  status?: string;
  assignedTo?: string;
  telecaller?: string;
  center?: string;
  visitingCenter?: string;
  reference?: string | string[];
  journeyStatusOverride?: string | null;
  enquiryType?: string;
  source?: string;
  priority?: string;
  visitorType?: string;
  companyName?: string;
  contactPerson?: string;
  purposeOfVisit?: string;
  visits?: unknown[];
  visitSchedules?: unknown[];
  financialSummary?: { paymentStatus?: string; totalDue?: number };
  leadOutcome?: string;
  hotEnquiry?: boolean;
  /** Patient information section — optional scheduled follow-up (YYYY-MM-DD). */
  followUpDate?: string;
  followUps?: FollowUp[];
  createdAt?: { seconds: number; nanoseconds?: number };
  updatedAt?: { seconds: number; nanoseconds?: number };
}

interface TelecallingRecord {
  id: string;
  enquiryId: string;
  enquiryName: string;
  enquiryPhone: string;
  enquiryEmail?: string;
  enquirySubject?: string;
  assignedTo?: string;
  /** Reference(s) from enquiry — shown on row and in preview */
  referenceList: string[];
  /** Journey status label (CRM parity with enquiries list) */
  journeyLabel: string;
  hotEnquiry: boolean;
  journeyChipColor: EnquiryStatusChipColor;
  journeySource: 'manual' | 'auto';
  /** Firestore `centers` doc id from enquiry `visitingCenter` / `center` */
  centerId?: string;
  centerLabel?: string;
  /** Total follow-up rows on this enquiry (for context) */
  totalFollowUpsOnEnquiry: number;
  followUpId: string;
  followUpDate: string;
  followUpDateTime?: string;
  telecaller: string;
  remarks: string;
  nextFollowUpDate: string;
  nextFollowUpDateTime?: string;
  createdAt: Date;
  /** Logged call vs date-only from enquiry patient section */
  recordSource?: 'followup_log' | 'patient_info' | 'appointment_due';
  /** True when this enquiry already has a call logged today. */
  hasCallLoggedToday?: boolean;
}

function refList(ref: Enquiry['reference']): string[] {
  if (Array.isArray(ref)) return ref.filter(Boolean).map(String);
  if (ref) return [String(ref)];
  return [];
}

function chipColor(color: EnquiryStatusChipColor): ChipProps['color'] {
  return color;
}

function resolveCenterDisplay(centerId: string | undefined, map: Record<string, string>): string | undefined {
  const id = (centerId || '').trim();
  if (!id) return undefined;
  return map[id] || id;
}

function formatFirestoreTimestamp(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate().toLocaleString();
    } catch {
      return '—';
    }
  }
  const sec = (value as { seconds?: number })?.seconds;
  if (typeof sec === 'number') return new Date(sec * 1000).toLocaleString();
  return '—';
}

function previewString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    return t || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function PreviewDetailRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  );
}

function normalizeYmd(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().slice(0, 10);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateInputValue(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

function toDateTimeInputValue(value: Date): string {
  return format(value, "yyyy-MM-dd'T'HH:mm");
}

function atTenAm(value: Date): Date {
  const d = new Date(value);
  d.setHours(10, 0, 0, 0);
  return d;
}

function isSameDayValue(a: Date, b: Date): boolean {
  return format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd');
}

function normalizeNextFollowUpDefault(nextValue: Date, callValue: Date): Date {
  if (isSameDayValue(nextValue, callValue)) return nextValue;
  return atTenAm(nextValue);
}

function isNotInterestedEnquiry(
  statusLabel: string,
  enquiryData: Enquiry
): boolean {
  const statusNorm = String(statusLabel || '').trim().toLowerCase();
  const legacyStatusNorm = String(enquiryData.status || '').trim().toLowerCase();
  const leadOutcomeNorm = String(enquiryData.leadOutcome || '').trim().toLowerCase();
  return (
    statusNorm.includes('not interested') ||
    legacyStatusNorm.includes('not interested') ||
    leadOutcomeNorm.includes('not interested')
  );
}

function toWhatsAppHref(phone: string | undefined): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function parseDateSafe(raw: string | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;

  // Prefer date-fns parsing to avoid browser-dependent UTC shifts for strings like `YYYY-MM-DDTHH:mm`.
  try {
    // `datetime-local` value (no timezone).
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) {
      const d = parse(t.slice(0, 16), "yyyy-MM-dd'T'HH:mm", new Date());
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // Date-only (YYYY-MM-DD) should be treated as local day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const d = parse(t, 'yyyy-MM-dd', new Date());
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const p = parseISO(t);
    if (!Number.isNaN(p.getTime())) return p;
  } catch {
    // fall through
  }

  const fallback = new Date(t);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function pickFollowUpDateTime(followUp: FollowUp): Date | null {
  return parseDateSafe(followUp.dateTime) || parseDateSafe(followUp.date);
}

function pickNextFollowUpDateTime(followUp: FollowUp): Date | null {
  return parseDateSafe(followUp.nextFollowUpDateTime) || parseDateSafe(followUp.nextFollowUpDate);
}

function pickRecordFollowUpDateTime(record: TelecallingRecord): Date | null {
  return parseDateSafe(record.followUpDateTime) || parseDateSafe(record.followUpDate);
}

function pickRecordNextFollowUpDateTime(record: TelecallingRecord): Date | null {
  return parseDateSafe(record.nextFollowUpDateTime) || parseDateSafe(record.nextFollowUpDate);
}

function readVisitDateTime(visit: unknown): Date | null {
  if (!visit || typeof visit !== 'object') return null;
  const v = visit as Record<string, unknown>;
  const candidates = ['visitDate', 'date', 'appointmentDate', 'start', 'scheduledAt', 'bookingDate'];
  for (const key of candidates) {
    const d = parseDateSafe(typeof v[key] === 'string' ? (v[key] as string) : undefined);
    if (d) return d;
  }
  return null;
}

function isCancelledVisit(visit: unknown): boolean {
  if (!visit || typeof visit !== 'object') return false;
  const v = visit as Record<string, unknown>;
  const status = String(v.status || v.visitStatus || '').toLowerCase();
  return status.includes('cancel');
}

const REMARK_PRESETS = [
  'Patient cut the call',
  'Patient not interested',
  'Call back later',
  'No response',
] as const;

function firestoreTimeToDate(data: Enquiry): Date {
  const u = data.updatedAt;
  const c = data.createdAt;
  if (u && typeof u === 'object' && 'seconds' in u) {
    return new Date(u.seconds * 1000);
  }
  if (c && typeof c === 'object' && 'seconds' in c) {
    return new Date(c.seconds * 1000);
  }
  return new Date();
}

export default function TelecallingRecordsPage() {
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const [records, setRecords] = useState<TelecallingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TelecallingRecord[]>([]);
  const [enquiryById, setEnquiryById] = useState<Record<string, Record<string, unknown>>>({});
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [centerIdToName, setCenterIdToName] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewEnquiryId, setPreviewEnquiryId] = useState<string | null>(null);
  const [logEnquiryId, setLogEnquiryId] = useState<string | null>(null);
  const [addFollowUpSaving, setAddFollowUpSaving] = useState(false);
  const [telecallerDialogOptions, setTelecallerDialogOptions] = useState<string[]>([]);
  const [newFollowUp, setNewFollowUp] = useState({
    date: '',
    dateTime: '',
    remarks: '',
    nextFollowUpDate: '',
    nextFollowUpDateTime: '',
    callerName: '',
  });
  const [selectedRemarkPreset, setSelectedRemarkPreset] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTelecaller, setSelectedTelecaller] = useState('');
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [selectedJourneys, setSelectedJourneys] = useState<string[]>([]);
  const [followUpDateFrom, setFollowUpDateFrom] = useState<Date | null>(null);
  const [followUpDateTo, setFollowUpDateTo] = useState<Date | null>(null);
  const [nextFollowUpDateFrom, setNextFollowUpDateFrom] = useState<Date | null>(null);
  const [nextFollowUpDateTo, setNextFollowUpDateTo] = useState<Date | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    const quick = (searchParams.get('quickFilter') || '').trim();
    const telecaller = (searchParams.get('telecaller') || '').trim();
    const center = (searchParams.get('center') || '').trim();
    const validQuickFilters = new Set([
      '',
      'hot_enquiries',
      'today_calls',
      'yesterday_calls',
      'last_week_calls',
      'last_month_calls',
      'all_due_calls',
      'due_today',
      'due_tomorrow',
      'due_this_week',
    ]);
    if (quick && validQuickFilters.has(quick)) {
      setQuickFilter(quick);
      // When deep-linking from notifications, keep date filters clear.
      setFollowUpDateFrom(null);
      setFollowUpDateTo(null);
      setNextFollowUpDateFrom(null);
      setNextFollowUpDateTo(null);
    }
    if (telecaller) {
      setSelectedTelecaller(telecaller);
    }
    if (center) {
      setSelectedCenter(center);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchStaffRecordsWithServerFallback();
        if (!cancelled) setStaffList(list);
      } catch (e) {
        console.error('Error fetching staff for telecalling log dialog:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!logEnquiryId) return;
    const snap = enquiryById[logEnquiryId] as Enquiry | undefined;
    const now = new Date();
    const nextWeek = atTenAm(addHours(now, 24 * 7));
    const options = getAllActiveStaffDisplayNames(staffList, [
      ...collectTelecallerExtrasFromEnquiry(snap ?? null),
      userProfile?.displayName,
    ]);
    setTelecallerDialogOptions(options);
    const callerName = pickDefaultTelecallerName(options, {
      displayName: userProfile?.displayName,
      enquiryTelecaller: snap?.telecaller,
    });
    setNewFollowUp({
      date: toDateInputValue(now),
      dateTime: toDateTimeInputValue(now),
      remarks: '',
      nextFollowUpDate: toDateInputValue(nextWeek),
      nextFollowUpDateTime: toDateTimeInputValue(nextWeek),
      callerName,
    });
    setSelectedRemarkPreset('');
  }, [logEnquiryId, staffList, enquiryById, userProfile?.displayName]);

  // Fetch data
  const fetchTelecallingRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      // console.log('Fetching telecalling records...');

      const centerMap: Record<string, string> = {};
      try {
        const centersSnap = await getDocs(query(collection(db, 'centers'), orderBy('name')));
        centersSnap.forEach((cDoc) => {
          const nm = (cDoc.data() as { name?: string }).name?.trim();
          centerMap[cDoc.id] = nm || cDoc.id;
        });
      } catch (centersErr) {
        console.warn('Could not load centers for name resolution:', centersErr);
      }
      setCenterIdToName(centerMap);

      const enquiriesRef = collection(db, 'enquiries');
      let enquiriesSnapshot;
      
      try {
        // Try with orderBy first
        const enquiriesQuery = query(enquiriesRef, orderBy('createdAt', 'desc'));
        enquiriesSnapshot = await getDocs(enquiriesQuery);
      } catch (indexError) {
        console.warn('OrderBy query failed, falling back to simple query:', indexError);
        // Fallback to simple query without ordering
        enquiriesSnapshot = await getDocs(enquiriesRef);
      }

      // console.log(`Found ${enquiriesSnapshot.docs.length} enquiries`);

      const allRecords: TelecallingRecord[] = [];
      const nextSnapshots: Record<string, Record<string, unknown>> = {};

      enquiriesSnapshot.forEach((docSnap) => {
        try {
          const enquiryData = docSnap.data() as Enquiry;
          const enquiryId = docSnap.id;
          const rawForStatus = { ...enquiryData, id: enquiryId } as Record<string, unknown>;
          nextSnapshots[enquiryId] = rawForStatus;

          const statusMeta = getEnquiryStatusMeta(rawForStatus);
          if (isNotInterestedEnquiry(statusMeta.label, enquiryData)) {
            return;
          }
          const referenceList = refList(enquiryData.reference);
          const followList = Array.isArray(enquiryData.followUps) ? enquiryData.followUps : [];
          const totalFu = followList.length;
          const now = new Date();
          const hasCallLoggedToday = followList.some((fu) => {
            const callTime = pickFollowUpDateTime(fu);
            return callTime ? isSameLocalDay(callTime, now) : false;
          });
          const centerId = (enquiryData.visitingCenter || enquiryData.center || '').trim();
          const centerLabel = centerId ? resolveCenterDisplay(centerId, centerMap) : undefined;
          const subjectLine =
            (enquiryData.subject && String(enquiryData.subject).trim()) ||
            (enquiryData.message && String(enquiryData.message).trim()) ||
            '';

          const rowContext = {
            referenceList,
            journeyLabel: statusMeta.label,
                hotEnquiry: enquiryData.hotEnquiry === true,
            journeyChipColor: statusMeta.color,
            journeySource: statusMeta.source,
            centerId: centerId || undefined,
            centerLabel,
            totalFollowUpsOnEnquiry: totalFu,
            hasCallLoggedToday,
          };

          if (followList.length > 0) {
            followList.forEach((followUp, index) => {
              try {
                // Handle different timestamp formats
                let createdAtDate = pickFollowUpDateTime(followUp) || new Date();
                if (followUp.createdAt) {
                  if (typeof followUp.createdAt === 'object' && 'seconds' in followUp.createdAt) {
                    createdAtDate = new Date(followUp.createdAt.seconds * 1000);
                  } else {
                    createdAtDate = new Date(followUp.createdAt as string | number | Date);
                  }
                }

                const record: TelecallingRecord = {
                  id: `${enquiryId}_${followUp.id || index}`,
                  enquiryId,
                  enquiryName: enquiryData.name || 'Unknown',
                  enquiryPhone: enquiryData.phone || '',
                  enquiryEmail: enquiryData.email || '',
                  enquirySubject: subjectLine,
                  assignedTo: enquiryData.assignedTo || '',
                  ...rowContext,
                  followUpId: followUp.id || `followup_${index}`,
                  followUpDate: followUp.date || '',
                  followUpDateTime: followUp.dateTime || '',
                  telecaller:
                    (followUp.callerName || enquiryData.telecaller || enquiryData.assignedTo || 'Unknown').trim() ||
                    'Unknown',
                  remarks: followUp.remarks || '',
                  nextFollowUpDate: followUp.nextFollowUpDate || '',
                  nextFollowUpDateTime: followUp.nextFollowUpDateTime || '',
                  createdAt: createdAtDate,
                  recordSource: 'followup_log',
                };

                allRecords.push(record);
              } catch (followUpError) {
                console.error(`Error processing follow-up ${index} for enquiry ${enquiryId}:`, followUpError);
              }
            });
          }

          /** Patient information "Follow-up Date" — show in telecalling when no follow-up row already uses that next date. */
          const patientFollowYmd = normalizeYmd(enquiryData.followUpDate);
          if (patientFollowYmd) {
            const alreadyCovered = followList.some((fu) => normalizeYmd(fu.nextFollowUpDate) === patientFollowYmd);
            if (!alreadyCovered) {
              const createdAtDate = firestoreTimeToDate(enquiryData);
              allRecords.push({
                id: `${enquiryId}_patientFollowUp`,
                enquiryId,
                enquiryName: enquiryData.name || 'Unknown',
                enquiryPhone: enquiryData.phone || '',
                enquiryEmail: enquiryData.email || '',
                enquirySubject: subjectLine,
                assignedTo: enquiryData.assignedTo || '',
                ...rowContext,
                totalFollowUpsOnEnquiry: totalFu,
                followUpId: 'patient_followup_info',
                followUpDate: '',
                followUpDateTime: '',
                telecaller: (enquiryData.telecaller || enquiryData.assignedTo || 'Unassigned').trim() || 'Unassigned',
                remarks: 'Follow-up date from patient information (enquiry form). No call logged yet.',
                nextFollowUpDate: patientFollowYmd,
                nextFollowUpDateTime: patientFollowYmd,
                createdAt: createdAtDate,
                recordSource: 'patient_info',
              });
            }
          }

          const schedules = Array.isArray(enquiryData.visitSchedules) ? enquiryData.visitSchedules : [];
          schedules.forEach((visit, index) => {
            if (isCancelledVisit(visit)) return;
            const appointmentAt = readVisitDateTime(visit);
            if (!appointmentAt) return;
            const dueAt = addMinutes(appointmentAt, -30);
            const dueIso = toDateTimeInputValue(dueAt);
            const alreadyCoveredByFollowUp = followList.some((fu) => {
              const next = pickNextFollowUpDateTime(fu);
              return next ? Math.abs(next.getTime() - dueAt.getTime()) < 60 * 1000 : false;
            });
            if (alreadyCoveredByFollowUp) return;
            allRecords.push({
              id: `${enquiryId}_appointment_due_${index}`,
              enquiryId,
              enquiryName: enquiryData.name || 'Unknown',
              enquiryPhone: enquiryData.phone || '',
              enquiryEmail: enquiryData.email || '',
              enquirySubject: subjectLine,
              assignedTo: enquiryData.assignedTo || '',
              ...rowContext,
              followUpId: `appointment_due_${index}`,
              followUpDate: '',
              followUpDateTime: '',
              telecaller: (enquiryData.telecaller || enquiryData.assignedTo || 'Unassigned').trim() || 'Unassigned',
              remarks: 'Appointment reminder call due 30 minutes before scheduled appointment.',
              nextFollowUpDate: toDateInputValue(dueAt),
              nextFollowUpDateTime: dueIso,
              createdAt: dueAt,
              recordSource: 'appointment_due',
            });
          });
        } catch (docError) {
          console.error(`Error processing enquiry document ${docSnap.id}:`, docError);
        }
      });

      // Sort: today's pending due calls first, then by due time, then recency.
      const today = new Date();
      const startToday = startOfDay(today);
      const endToday = endOfDay(today);
      const priority = (record: TelecallingRecord): number => {
        const next = pickRecordNextFollowUpDateTime(record);
        if (!next) return 1;
        const isDueToday = isWithinInterval(next, { start: startToday, end: endToday });
        if (isDueToday && !record.hasCallLoggedToday) return 0;
        return 1;
      };
      allRecords.sort((a, b) => {
        const pa = priority(a);
        const pb = priority(b);
        if (pa !== pb) return pa - pb;
        if (pa === 0 && pb === 0) {
          const ta = pickRecordNextFollowUpDateTime(a)?.getTime() || 0;
          const tb = pickRecordNextFollowUpDateTime(b)?.getTime() || 0;
          return ta - tb;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      setEnquiryById(nextSnapshots);
      setRecords(allRecords);
    } catch (err) {
      console.error('Error fetching telecalling records:', err);
      setError(`Failed to fetch telecalling records: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelecallingRecords();
  }, []);

  // Get unique telecallers
  const uniqueTelecallers = useMemo(() => {
    const telecallers = [...new Set(records.map(record => record.telecaller).filter(Boolean))];
    return telecallers.sort();
  }, [records]);
  const uniqueReferences = useMemo(() => {
    const refs = new Set<string>();
    records.forEach((record) => {
      record.referenceList.forEach((r) => {
        const t = String(r || '').trim();
        if (t) refs.add(t);
      });
    });
    return [...refs].sort((a, b) => a.localeCompare(b));
  }, [records]);
  const uniqueJourneys = useMemo(() => {
    const journeys = new Set<string>();
    records.forEach((record) => {
      const t = String(record.journeyLabel || '').trim();
      if (t) journeys.add(t);
    });
    return [...journeys].sort((a, b) => a.localeCompare(b));
  }, [records]);
  const uniqueCenterIds = useMemo(() => {
    const ids = new Set<string>();
    records.forEach((record) => {
      const id = (record.centerId || '').trim();
      if (id) ids.add(id);
    });
    return [...ids].sort((a, b) => {
      const na = (centerIdToName[a] || a).toLowerCase();
      const nb = (centerIdToName[b] || b).toLowerCase();
      return na.localeCompare(nb);
    });
  }, [records, centerIdToName]);

  // Quick filter functions
  const getDateRange = (filterType: string) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    const lastMonth = new Date(today);
    lastMonth.setMonth(today.getMonth() - 1);
    
    const thisWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday as start
    thisWeekStart.setDate(diff);
    
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

    switch (filterType) {
      case 'today_calls': return { from: today, to: today, type: 'followUp' };
      case 'yesterday_calls': return { from: yesterday, to: yesterday, type: 'followUp' };
      case 'last_week_calls': return { from: lastWeek, to: today, type: 'followUp' };
      case 'last_month_calls': return { from: lastMonth, to: today, type: 'followUp' };
      case 'due_today': return { from: today, to: today, type: 'nextFollowUp' };
      case 'due_tomorrow': return { from: tomorrow, to: tomorrow, type: 'nextFollowUp' };
      case 'due_this_week': return { from: thisWeekStart, to: thisWeekEnd, type: 'nextFollowUp' };
      case 'all_due_calls': return { from: new Date(2020, 0, 1), to: new Date(2030, 11, 31), type: 'nextFollowUp', showAllDue: true };
      default: return null;
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = records;

    // Quick filter
    if (quickFilter) {
      const dateRange = getDateRange(quickFilter);
      if (dateRange) {
        filtered = filtered.filter(record => {
          const recordDate =
            dateRange.type === 'followUp'
              ? pickRecordFollowUpDateTime(record)
              : pickRecordNextFollowUpDateTime(record);
          if (!recordDate) return false;
          const inRange = isWithinInterval(recordDate, { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) });
          if (!inRange) return false;
          if (quickFilter === 'due_today' && record.hasCallLoggedToday) return false;
          return true;
        });
      }
    }
    if (quickFilter === 'hot_enquiries') {
      filtered = filtered.filter((record) => record.hotEnquiry === true);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((record) => {
        const refHay = record.referenceList.join(' ').toLowerCase();
        return (
          record.enquiryName.toLowerCase().includes(term) ||
          record.enquiryPhone.includes(term) ||
          record.telecaller.toLowerCase().includes(term) ||
          record.remarks.toLowerCase().includes(term) ||
          record.enquirySubject?.toLowerCase().includes(term) ||
          record.enquiryEmail?.toLowerCase().includes(term) ||
          (record.assignedTo || '').toLowerCase().includes(term) ||
          record.journeyLabel.toLowerCase().includes(term) ||
          refHay.includes(term) ||
          (record.centerLabel || '').toLowerCase().includes(term)
        );
      });
    }

    // Telecaller filter
    if (selectedTelecaller) {
      filtered = filtered.filter(record => record.telecaller === selectedTelecaller);
    }
    if (selectedCenter) {
      filtered = filtered.filter((record) => (record.centerId || '').trim() === selectedCenter);
    }
    if (selectedReferences.length > 0) {
      const selected = new Set(selectedReferences.map((r) => r.toLowerCase()));
      filtered = filtered.filter((record) =>
        record.referenceList.some((r) => selected.has(String(r || '').toLowerCase()))
      );
    }
    if (selectedJourneys.length > 0) {
      const selected = new Set(selectedJourneys.map((j) => j.toLowerCase()));
      filtered = filtered.filter((record) => selected.has(String(record.journeyLabel || '').toLowerCase()));
    }

    // Follow-up date range filter (only if not using quick filter)
    if (!quickFilter && (followUpDateFrom || followUpDateTo)) {
      filtered = filtered.filter(record => {
        const recordDate = pickRecordFollowUpDateTime(record);
        if (!recordDate) return true;
        if (followUpDateFrom && followUpDateTo) {
          return isWithinInterval(recordDate, { start: startOfDay(followUpDateFrom), end: endOfDay(followUpDateTo) });
        } else if (followUpDateFrom) {
          return recordDate >= startOfDay(followUpDateFrom);
        } else if (followUpDateTo) {
          return recordDate <= endOfDay(followUpDateTo);
        }
        return true;
      });
    }

    // Next follow-up date range filter (only if not using quick filter)
    if (!quickFilter && (nextFollowUpDateFrom || nextFollowUpDateTo)) {
      filtered = filtered.filter(record => {
        const recordDate = pickRecordNextFollowUpDateTime(record);
        if (!recordDate) return true;
        if (nextFollowUpDateFrom && nextFollowUpDateTo) {
          return isWithinInterval(recordDate, {
            start: startOfDay(nextFollowUpDateFrom),
            end: endOfDay(nextFollowUpDateTo),
          });
        } else if (nextFollowUpDateFrom) {
          return recordDate >= startOfDay(nextFollowUpDateFrom);
        } else if (nextFollowUpDateTo) {
          return recordDate <= endOfDay(nextFollowUpDateTo);
        }
        return true;
      });
    }

    setFilteredRecords(filtered);
    setPage(0); // Reset to first page when filters change
  }, [records, searchTerm, selectedTelecaller, selectedCenter, selectedReferences, selectedJourneys, quickFilter, followUpDateFrom, followUpDateTo, nextFollowUpDateFrom, nextFollowUpDateTo]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTelecaller('');
    setSelectedCenter('');
    setSelectedReferences([]);
    setSelectedJourneys([]);
    setQuickFilter('');
    setFollowUpDateFrom(null);
    setFollowUpDateTo(null);
    setNextFollowUpDateFrom(null);
    setNextFollowUpDateTo(null);
  };

  const openLogCallDialog = (enquiryId: string) => {
    setLogEnquiryId(enquiryId);
  };

  const handleSaveFollowUpFromTelecalling = async () => {
    if (!logEnquiryId) return;
    if (!newFollowUp.callerName.trim()) {
      setSnackbar({
        open: true,
        message: 'Select who made the call (telecaller).',
        severity: 'error',
      });
      return;
    }
    setAddFollowUpSaving(true);
    try {
      const ref = doc(db, 'enquiries', logEnquiryId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw new Error('Enquiry not found');
      }
      const data = snap.data() as Enquiry;
      const prev = Array.isArray(data.followUps) ? data.followUps : [];
      const now = new Date();
      const followUpData = {
        ...newFollowUp,
        date: newFollowUp.dateTime ? newFollowUp.dateTime.slice(0, 10) : newFollowUp.date,
        nextFollowUpDate: newFollowUp.nextFollowUpDateTime
          ? newFollowUp.nextFollowUpDateTime.slice(0, 10)
          : newFollowUp.nextFollowUpDate,
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `fu-${Date.now()}`,
        createdAt: Timestamp.now(),
      };
      const updated = [...prev, followUpData];
      await updateDoc(ref, { followUps: updated });
      const statusMeta = getEnquiryStatusMeta({ ...data, id: logEnquiryId } as Record<string, unknown>);
      const referenceList = refList(data.reference);
      const centerId = (data.visitingCenter || data.center || '').trim();
      const centerLabel = centerId ? resolveCenterDisplay(centerId, centerIdToName) : undefined;
      const subjectLine =
        (data.subject && String(data.subject).trim()) || (data.message && String(data.message).trim()) || '';
      const optimisticRecord: TelecallingRecord = {
        id: `${logEnquiryId}_${followUpData.id}`,
        enquiryId: logEnquiryId,
        enquiryName: data.name || 'Unknown',
        enquiryPhone: data.phone || '',
        enquiryEmail: data.email || '',
        enquirySubject: subjectLine,
        assignedTo: data.assignedTo || '',
        referenceList,
        journeyLabel: statusMeta.label,
        journeyChipColor: statusMeta.color,
        journeySource: statusMeta.source,
        centerId: centerId || undefined,
        centerLabel,
        totalFollowUpsOnEnquiry: updated.length,
        followUpId: followUpData.id,
        followUpDate: followUpData.date || '',
        followUpDateTime: followUpData.dateTime || '',
        telecaller: (followUpData.callerName || data.telecaller || data.assignedTo || 'Unknown').trim() || 'Unknown',
        remarks: followUpData.remarks || '',
        nextFollowUpDate: followUpData.nextFollowUpDate || '',
        nextFollowUpDateTime: followUpData.nextFollowUpDateTime || '',
        createdAt: now,
        recordSource: 'followup_log',
      };
      setEnquiryById((prevMap) => ({
        ...prevMap,
        [logEnquiryId]: { ...(prevMap[logEnquiryId] || {}), ...data, id: logEnquiryId, followUps: updated },
      }));
      setRecords((prevRecords) => {
        const withoutCoveredPatientInfo = prevRecords.filter(
          (r) =>
            !(
              r.enquiryId === logEnquiryId &&
              r.recordSource === 'patient_info' &&
              normalizeYmd(r.nextFollowUpDate) === normalizeYmd(followUpData.nextFollowUpDate)
            )
        );
        const normalized = withoutCoveredPatientInfo.map((r) =>
          r.enquiryId === logEnquiryId ? { ...r, totalFollowUpsOnEnquiry: updated.length } : r
        );
        const next = [optimisticRecord, ...normalized];
        next.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return next;
      });
      const entityName = data.name || data.phone || 'Enquiry';
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'FOLLOW_UP',
        module: 'Telecalling',
        entityId: logEnquiryId,
        entityName,
        description: `Telecall logged from Telecalling Records by ${newFollowUp.callerName || 'staff'}${newFollowUp.remarks ? ` — "${newFollowUp.remarks}"` : ''}`,
        changes: {
          followUp: {
            before: null,
            after: {
              callerName: newFollowUp.callerName,
              date: newFollowUp.date,
              dateTime: newFollowUp.dateTime,
              remarks: newFollowUp.remarks,
              nextFollowUpDate: newFollowUp.nextFollowUpDate,
              nextFollowUpDateTime: newFollowUp.nextFollowUpDateTime,
              remarkPreset: selectedRemarkPreset || null,
            },
          },
        },
        metadata: {
          callerName: newFollowUp.callerName,
          remarks: newFollowUp.remarks,
          nextFollowUpDate: newFollowUp.nextFollowUpDate,
          nextFollowUpDateTime: newFollowUp.nextFollowUpDateTime,
          remarkPreset: selectedRemarkPreset || null,
        },
      }, user);
      setSnackbar({ open: true, message: 'Call logged successfully', severity: 'success' });
      setLogEnquiryId(null);
    } catch (err) {
      console.error(err);
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Could not save call',
        severity: 'error',
      });
    } finally {
      setAddFollowUpSaving(false);
    }
  };

  const previewSnapshot = previewEnquiryId ? enquiryById[previewEnquiryId] : null;
  const previewEnquiryTyped = previewSnapshot as Enquiry | undefined;
  const previewStatus = previewSnapshot ? getEnquiryStatusMeta(previewSnapshot) : null;
  const previewFollowUpsSorted = useMemo(() => {
    const list = Array.isArray(previewEnquiryTyped?.followUps) ? [...previewEnquiryTyped.followUps] : [];
    list.sort((a, b) => {
      const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.date || 0).getTime();
      const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.date || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [previewEnquiryTyped]);

  const formatFollowUpDateCell = (value: string | undefined) => {
    if (!value) return '—';
    const d = parseDateSafe(value);
    return d ? format(d, 'dd MMM yyyy HH:mm') : '—';
  };

  // Quick filter options
  const quickFilterOptions = [
    { label: 'All Calls', value: '', color: 'default' },
    { label: 'Hot Enquiries', value: 'hot_enquiries', color: 'warning' },
    { label: 'Today\'s Calls', value: 'today_calls', color: 'primary' },
    { label: 'Yesterday\'s Calls', value: 'yesterday_calls', color: 'secondary' },
    { label: 'Last Week Calls', value: 'last_week_calls', color: 'info' },
    { label: 'Last Month Calls', value: 'last_month_calls', color: 'default' },
    { label: 'All Due Calls', value: 'all_due_calls', color: 'secondary' },
    { label: 'Due Today', value: 'due_today', color: 'success' },
    { label: 'Due Tomorrow', value: 'due_tomorrow', color: 'warning' },
    { label: 'Due This Week', value: 'due_this_week', color: 'error' },
  ];

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString || !String(dateString).trim()) return '—';
    const parsed = parseDateSafe(dateString);
    if (!parsed) return dateString;
    return format(parsed, 'dd MMM yyyy HH:mm');
  };

  // Format datetime
  const formatDateTime = (date: Date) => {
    return format(date, 'dd MMM yyyy HH:mm');
  };

  // Paginated records
  const paginatedRecords = filteredRecords.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const dueTodayCount = useMemo(() => {
    const now = new Date();
    return filteredRecords.filter((r) => {
      const nextDate = pickRecordNextFollowUpDateTime(r);
      return nextDate ? isWithinInterval(nextDate, { start: startOfDay(now), end: endOfDay(now) }) : false;
    }).length;
  }, [filteredRecords]);
  const overdueCount = useMemo(() => {
    const now = new Date();
    return filteredRecords.filter((r) => {
      const nextDate = pickRecordNextFollowUpDateTime(r);
      return nextDate ? nextDate < now : false;
    }).length;
  }, [filteredRecords]);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const logSnap = logEnquiryId ? (enquiryById[logEnquiryId] as Enquiry | undefined) : undefined;
  const logMeta =
    logSnap && logEnquiryId ? getEnquiryStatusMeta({ ...logSnap, id: logEnquiryId } as Record<string, unknown>) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          minHeight: '100vh',
          background: (theme) =>
            `linear-gradient(165deg, ${theme.palette.grey[50]} 0%, ${alpha(theme.palette.primary.main, 0.06)} 40%, ${theme.palette.background.default} 100%)`,
        }}
      >
      <Container maxWidth="xl" sx={{ pt: 2, pb: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: 1.2 }}>
              Operations
            </Typography>
            <Typography variant="h5" component="h1" fontWeight={800} sx={{ letterSpacing: -0.4 }}>
              Telecalling Records
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, mt: 0.5 }}>
              Follow-up history with patient context, references, journey status, quick profile preview, and inline call logging
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchTelecallingRecords}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={() => {
                // TODO: Implement export functionality
                console.log('Export functionality to be implemented');
              }}
            >
              Export
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" display="block">
                Debug Info: Total enquiries checked, Records found: {records.length}
              </Typography>
            </Box>
          </Alert>
        )}

        {!error && !loading && records.length === 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            No telecalling records found. This could mean:
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>No enquiries have follow-ups yet</li>
              <li>Follow-ups exist but do not have the expected data structure</li>
              <li>Database connection issues</li>
            </ul>
          </Alert>
        )}

        {/* Summary Cards */}
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={0} sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
              <CardContent sx={{ py: 1.2, '&:last-child': { pb: 1.2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <PhoneIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="div">
                      {filteredRecords.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Calls
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={0} sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
              <CardContent sx={{ py: 1.2, '&:last-child': { pb: 1.2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="div">
                      {uniqueTelecallers.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Active Telecallers
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={0} sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
              <CardContent sx={{ py: 1.2, '&:last-child': { pb: 1.2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CalendarIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="div">
                      {dueTodayCount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Due Today
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card elevation={0} sx={{ borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
              <CardContent sx={{ py: 1.2, '&:last-child': { pb: 1.2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <ScheduleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="div">
                      {overdueCount}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Overdue
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Quick Filters */}
        <Paper sx={{ p: 1.5, mb: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5 }} fontWeight={700}>
            Quick Filters
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {quickFilterOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                color={quickFilter === option.value ? (option.color as ChipProps['color']) : 'default'}
                variant={quickFilter === option.value ? 'filled' : 'outlined'}
                size="small"
                onClick={() => {
                  setQuickFilter(option.value);
                  // Clear manual date filters when using quick filter
                  if (option.value !== '') {
                    setFollowUpDateFrom(null);
                    setFollowUpDateTo(null);
                    setNextFollowUpDateFrom(null);
                    setNextFollowUpDateTo(null);
                  }
                }}
                sx={{ cursor: 'pointer' }}
              />
            ))}
            {quickFilter && (
              <Chip
                label="Clear Quick Filter"
                variant="outlined"
                color="default"
                onDelete={() => setQuickFilter('')}
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        </Paper>

        {/* Advanced Filters */}
        <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Advanced Filters
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                size="small"
                onClick={clearFilters}
                disabled={
                  !searchTerm &&
                  !selectedTelecaller &&
                  !selectedCenter &&
                  selectedReferences.length === 0 &&
                  selectedJourneys.length === 0 &&
                  !quickFilter &&
                  !followUpDateFrom &&
                  !followUpDateTo &&
                  !nextFollowUpDateFrom &&
                  !nextFollowUpDateTo
                }
              >
                Clear All
              </Button>
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                {showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
          </Box>

          <TextField
            fullWidth
            variant="outlined"
            size="small"
            placeholder="Search patient, phone, reference, journey status, telecaller, remarks, center…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          <Collapse in={showFilters}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Telecaller</InputLabel>
                  <Select
                    value={selectedTelecaller}
                    onChange={(e) => setSelectedTelecaller(e.target.value)}
                    label="Telecaller"
                    size="small"
                  >
                    <MenuItem value="">All Telecallers</MenuItem>
                    {uniqueTelecallers.map((telecaller) => (
                      <MenuItem key={telecaller} value={telecaller}>
                        {telecaller}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Center</InputLabel>
                  <Select
                    value={selectedCenter}
                    onChange={(e) => setSelectedCenter(e.target.value)}
                    label="Center"
                    size="small"
                  >
                    <MenuItem value="">All Centers</MenuItem>
                    {uniqueCenterIds.map((cid) => (
                      <MenuItem key={cid} value={cid}>
                        {centerIdToName[cid] || cid}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Reference</InputLabel>
                  <Select
                    multiple
                    value={selectedReferences}
                    onChange={(e) => setSelectedReferences(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                    input={<OutlinedInput label="Reference" />}
                    size="small"
                    renderValue={(selected) =>
                      selected.length === 0 ? (
                        'All References'
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )
                    }
                  >
                    {uniqueReferences.map((reference) => (
                      <MenuItem key={reference} value={reference}>
                        {reference}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Journey</InputLabel>
                  <Select
                    multiple
                    value={selectedJourneys}
                    onChange={(e) => setSelectedJourneys(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                    input={<OutlinedInput label="Journey" />}
                    size="small"
                    renderValue={(selected) =>
                      selected.length === 0 ? (
                        'All Journeys'
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {selected.map((value) => (
                            <Chip key={value} label={value} size="small" />
                          ))}
                        </Box>
                      )
                    }
                  >
                    {uniqueJourneys.map((journey) => (
                      <MenuItem key={journey} value={journey}>
                        {journey}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>



              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Follow-up Date From"
                  value={followUpDateFrom}
                  onChange={(newValue) => setFollowUpDateFrom(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Follow-up Date To"
                  value={followUpDateTo}
                  onChange={(newValue) => setFollowUpDateTo(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Next Follow-up From"
                  value={nextFollowUpDateFrom}
                  onChange={(newValue) => setNextFollowUpDateFrom(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Next Follow-up To"
                  value={nextFollowUpDateTo}
                  onChange={(newValue) => setNextFollowUpDateTo(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
            </Grid>
          </Collapse>
        </Paper>

        {/* Results Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 2, border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(15,23,42,0.06)' }}>
          <TableContainer sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { py: 0.8, px: 1, fontSize: '0.78rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Journey</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Follow-up Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Telecaller</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Next Follow-up</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Created At</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    hover
                    sx={
                      record.hotEnquiry
                        ? {
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark' ? 'rgba(255,111,0,0.12)' : 'rgba(255,152,0,0.10)',
                            boxShadow: 'inset 4px 0 0 0 #ef6c00',
                            '&:hover': {
                              bgcolor: (theme) =>
                                theme.palette.mode === 'dark' ? 'rgba(255,111,0,0.18)' : 'rgba(255,152,0,0.16)',
                            },
                          }
                        : undefined
                    }
                  >
                    <TableCell>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {record.enquiryName}
                          </Typography>
                          {record.recordSource === 'patient_info' ? (
                            <Chip size="small" label="Patient info follow-up" color="info" variant="outlined" />
                          ) : record.recordSource === 'appointment_due' ? (
                            <Chip size="small" label="Appointment due call" color="warning" variant="outlined" />
                          ) : null}
                          <Chip
                            size="small"
                            label={`${record.totalFollowUpsOnEnquiry} calls`}
                            variant="outlined"
                          />
                          {record.hotEnquiry ? <HotEnquiryBadgeChip /> : null}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {record.enquiryPhone}
                        </Typography>
                        {record.enquiryEmail && (
                          <Typography variant="body2" color="text.secondary">
                            {record.enquiryEmail}
                          </Typography>
                        )}
                        {record.centerLabel ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Center: {record.centerLabel}
                          </Typography>
                        ) : null}
                        {record.enquirySubject && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {record.enquirySubject}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ maxWidth: 220 }}>
                        {record.referenceList.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        ) : (
                          record.referenceList.map((ref) => (
                            <Chip key={ref} size="small" label={ref} color="secondary" variant="outlined" />
                          ))
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={record.journeySource === 'manual' ? 'Manual status from CRM' : 'Derived from enquiry journey'}>
                        <Chip size="small" label={record.journeyLabel} color={chipColor(record.journeyChipColor)} />
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {formatDate(record.followUpDateTime || record.followUpDate)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                          {(record.telecaller || '?').charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2">
                          {record.telecaller}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={record.remarks} arrow>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 200, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {record.remarks}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ScheduleIcon fontSize="small" color="action" />
                        <Typography 
                          variant="body2"
                          color={(() => {
                            const nextDate = pickRecordNextFollowUpDateTime(record);
                            if (!nextDate) return 'text.primary';
                            const now = new Date();
                            if (isWithinInterval(nextDate, { start: startOfDay(now), end: endOfDay(now) })) {
                              return 'success.main';
                            }
                            if (nextDate < now) return 'error.main';
                            return 'text.primary';
                          })()}
                        >
                          {formatDate(record.nextFollowUpDateTime || record.nextFollowUpDate)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(record.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                        <Tooltip title="Quick profile preview">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setPreviewEnquiryId(record.enquiryId)}
                            aria-label="Preview patient"
                          >
                            <PreviewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Log call">
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => openLogCallDialog(record.enquiryId)}
                            aria-label="Log call"
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Open full enquiry">
                          <IconButton
                            size="small"
                            component={Link}
                            href={`/interaction/enquiries/${record.enquiryId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open enquiry"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {toWhatsAppHref(record.enquiryPhone) ? (
                          <Tooltip title="Open WhatsApp chat">
                            <IconButton
                              size="small"
                              component="a"
                              href={toWhatsAppHref(record.enquiryPhone) as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open WhatsApp"
                              sx={{ color: '#25D366' }}
                            >
                              <WhatsAppIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredRecords.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>

        {filteredRecords.length === 0 && !loading && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              {records.length === 0 ? 'No telecalling records available' : 'No records match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {records.length === 0
                ? 'No records yet. Add follow-up dates in patient information or log follow-up calls on enquiries.'
                : 'Try adjusting your filters to see more results'}
            </Typography>
            {records.length === 0 && (
              <Button
                variant="outlined"
                sx={{ mt: 2 }}
                onClick={() => window.open('/interaction/enquiries', '_blank')}
              >
                Go to Enquiries
              </Button>
            )}
          </Box>
        )}
      </Container>

      <Drawer
        anchor="right"
        open={Boolean(previewEnquiryId)}
        onClose={() => setPreviewEnquiryId(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 560 },
            p: 0,
            borderLeft: 1,
            borderColor: 'divider',
            background: (theme) => theme.palette.background.paper,
          },
        }}
      >
        {previewEnquiryId && previewSnapshot ? (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                p: 2.5,
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.main}14 0%, ${theme.palette.secondary.main}10 100%)`,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="overline" color="primary" fontWeight={700}>
                Patient profile
              </Typography>
              <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5 }}>
                {(previewEnquiryTyped?.name as string) || 'Patient'}
              </Typography>
              {previewEnquiryTyped?.customerName &&
              previewString(previewEnquiryTyped.customerName) !== previewString(previewEnquiryTyped.name) ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Customer: {previewEnquiryTyped.customerName}
                </Typography>
              ) : null}
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                {previewStatus ? (
                  <Chip
                    size="small"
                    label={previewStatus.label}
                    color={chipColor(previewStatus.color)}
                    title={previewStatus.source === 'manual' ? 'Manual status' : 'Derived status'}
                  />
                ) : null}
                {refList(previewEnquiryTyped?.reference).map((ref) => (
                  <Chip key={ref} size="small" label={ref} variant="outlined" color="secondary" />
                ))}
              </Stack>
            </Box>
            <Box sx={{ p: 2.5, flex: 1, overflow: 'auto' }}>
              <Stack spacing={2}>
                <PreviewDetailRow label="Enquiry ID" value={previewEnquiryId} />
                {previewEnquiryTyped?.phone ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Phone
                    </Typography>
                    <Typography variant="body2">
                      <MuiLink
                        href={`tel:${String(previewEnquiryTyped.phone).replace(/\D/g, '')}`}
                        underline="hover"
                      >
                        {previewEnquiryTyped.phone}
                      </MuiLink>
                    </Typography>
                  </Box>
                ) : null}
                <PreviewDetailRow label="Email" value={previewString(previewEnquiryTyped?.email)} />
                <PreviewDetailRow label="Address" value={previewString(previewEnquiryTyped?.address)} />
                {(() => {
                  const cid = (previewEnquiryTyped?.visitingCenter || previewEnquiryTyped?.center || '').trim();
                  if (!cid) return null;
                  const display = resolveCenterDisplay(cid, centerIdToName) || cid;
                  return (
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        Center
                      </Typography>
                      <Typography variant="body2">{display}</Typography>
                      {display !== cid ? (
                        <Typography variant="caption" color="text.secondary">
                          ID: {cid}
                        </Typography>
                      ) : null}
                    </Box>
                  );
                })()}
                <PreviewDetailRow label="Assigned to" value={previewString(previewEnquiryTyped?.assignedTo)} />
                <PreviewDetailRow label="Telecaller" value={previewString(previewEnquiryTyped?.telecaller)} />
                <PreviewDetailRow label="Subject" value={previewString(previewEnquiryTyped?.subject)} />
                <PreviewDetailRow label="Message" value={previewString(previewEnquiryTyped?.message)} />
                <PreviewDetailRow label="Notes" value={previewString(previewEnquiryTyped?.notes)} />
                <PreviewDetailRow label="Enquiry type" value={previewString(previewEnquiryTyped?.enquiryType)} />
                <PreviewDetailRow label="Source" value={previewString(previewEnquiryTyped?.source)} />
                <PreviewDetailRow label="Priority" value={previewString(previewEnquiryTyped?.priority)} />
                <PreviewDetailRow label="Status (legacy)" value={previewString(previewEnquiryTyped?.status)} />
                <PreviewDetailRow label="Visitor type" value={previewString(previewEnquiryTyped?.visitorType)} />
                <PreviewDetailRow label="Company" value={previewString(previewEnquiryTyped?.companyName)} />
                <PreviewDetailRow label="Contact person" value={previewString(previewEnquiryTyped?.contactPerson)} />
                <PreviewDetailRow label="Purpose of visit" value={previewString(previewEnquiryTyped?.purposeOfVisit)} />
                <PreviewDetailRow
                  label="Patient follow-up date"
                  value={previewString(previewEnquiryTyped?.followUpDate)}
                />
                <PreviewDetailRow label="Lead outcome" value={previewString(previewEnquiryTyped?.leadOutcome)} />
                {previewEnquiryTyped?.financialSummary ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Financial summary
                    </Typography>
                    <Typography variant="body2">
                      {[
                        previewEnquiryTyped.financialSummary.paymentStatus
                          ? `Payment: ${previewEnquiryTyped.financialSummary.paymentStatus}`
                          : null,
                        previewEnquiryTyped.financialSummary.totalDue != null
                          ? `Total due: ${previewEnquiryTyped.financialSummary.totalDue}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </Typography>
                  </Box>
                ) : null}
                <PreviewDetailRow
                  label="Visits"
                  value={
                    Array.isArray(previewEnquiryTyped?.visits) && previewEnquiryTyped.visits.length > 0
                      ? `${previewEnquiryTyped.visits.length} visit(s)`
                      : Array.isArray(previewEnquiryTyped?.visitSchedules) &&
                          previewEnquiryTyped.visitSchedules.length > 0
                        ? `${previewEnquiryTyped.visitSchedules.length} schedule row(s)`
                        : undefined
                  }
                />
                <PreviewDetailRow
                  label="Created"
                  value={formatFirestoreTimestamp(previewEnquiryTyped?.createdAt as unknown)}
                />
                <PreviewDetailRow
                  label="Updated"
                  value={formatFirestoreTimestamp(previewEnquiryTyped?.updatedAt as unknown)}
                />
                <Divider />
                <Typography variant="subtitle2" fontWeight={700}>
                  Recent calls ({previewFollowUpsSorted.length})
                </Typography>
                {previewFollowUpsSorted.slice(0, 5).map((fu, idx) => (
                  <Paper key={fu.id || idx} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatFollowUpDateCell(fu.date)} · {fu.callerName || '—'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {fu.remarks || '—'}
                    </Typography>
                    {fu.nextFollowUpDate ? (
                      <Typography variant="caption" color="primary">
                        Next: {formatFollowUpDateCell(fu.nextFollowUpDate)}
                      </Typography>
                    ) : null}
                  </Paper>
                ))}
                {previewFollowUpsSorted.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No calls logged yet for this enquiry.
                  </Typography>
                ) : null}
              </Stack>
            </Box>
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => openLogCallDialog(previewEnquiryId)}
                fullWidth
                sx={{ flex: '1 1 140px' }}
              >
                Log call
              </Button>
              <Button
                variant="outlined"
                component={Link}
                href={`/interaction/enquiries/${previewEnquiryId}`}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<OpenInNewIcon />}
                fullWidth
                sx={{ flex: '1 1 140px' }}
              >
                Full profile
              </Button>
              <Button onClick={() => setPreviewEnquiryId(null)} fullWidth sx={{ flex: '1 1 100%' }}>
                Close
              </Button>
            </Box>
          </Box>
        ) : null}
      </Drawer>

      <Dialog
        open={Boolean(logEnquiryId)}
        onClose={() => !addFollowUpSaving && setLogEnquiryId(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Log telecalling
          {logSnap?.name ? (
            <Typography component="span" variant="body2" color="text.secondary" display="block" fontWeight={400}>
              {logSnap.name} · {logSnap.phone || 'No phone'}
            </Typography>
          ) : null}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {logSnap ? (
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {refList(logSnap.reference).map((ref) => (
                  <Chip key={ref} size="small" label={ref} variant="outlined" color="secondary" />
                ))}
                {logMeta ? (
                  <Chip size="small" label={logMeta.label} color={chipColor(logMeta.color)} />
                ) : null}
              </Stack>
            ) : null}
            <TextField
              label="Quick remarks"
              value={newFollowUp.remarks}
              onChange={(e) => {
                const value = e.target.value;
                setNewFollowUp((s) => ({ ...s, remarks: value }));
                if (selectedRemarkPreset && value !== selectedRemarkPreset) {
                  setSelectedRemarkPreset('');
                }
              }}
              fullWidth
              multiline
              minRows={3}
              disabled={addFollowUpSaving}
              helperText="Tap a chip to prefill quickly, or type custom remarks."
            />
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {REMARK_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  size="small"
                  clickable
                  label={preset}
                  color={selectedRemarkPreset === preset ? 'primary' : 'default'}
                  variant={selectedRemarkPreset === preset ? 'filled' : 'outlined'}
                  onClick={() => {
                    setSelectedRemarkPreset(preset);
                    setNewFollowUp((s) => {
                      if (preset === 'Patient cut the call') {
                        const autoNextDate = addHours(new Date(), 1);
                        return {
                          ...s,
                          remarks: preset,
                          nextFollowUpDateTime: toDateTimeInputValue(autoNextDate),
                          nextFollowUpDate: toDateInputValue(autoNextDate),
                        };
                      }
                      return { ...s, remarks: preset };
                    });
                  }}
                />
              ))}
            </Stack>
            <DateTimePicker
              label="Call date & time"
              value={parseDateSafe(newFollowUp.dateTime)}
              onChange={(value) => {
                if (!value || Number.isNaN(value.getTime())) return;
                setNewFollowUp((s) => ({
                  ...s,
                  dateTime: toDateTimeInputValue(value),
                  date: toDateInputValue(value),
                }));
              }}
              disabled={addFollowUpSaving}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <DateTimePicker
              label="Next follow-up date & time"
              value={parseDateSafe(newFollowUp.nextFollowUpDateTime)}
              onChange={(value) => {
                if (!value || Number.isNaN(value.getTime())) return;
                const callValue = parseDateSafe(newFollowUp.dateTime) || new Date();
                const normalized = normalizeNextFollowUpDefault(value, callValue);
                setNewFollowUp((s) => ({
                  ...s,
                  nextFollowUpDateTime: toDateTimeInputValue(normalized),
                  nextFollowUpDate: toDateInputValue(normalized),
                }));
              }}
              disabled={addFollowUpSaving}
              slotProps={{ textField: { fullWidth: true } }}
            />
            {telecallerDialogOptions.length > 0 ? (
              <FormControl fullWidth disabled={addFollowUpSaving}>
                <InputLabel>Caller</InputLabel>
                <Select
                  label="Caller"
                  value={telecallerDialogOptions.includes(newFollowUp.callerName) ? newFollowUp.callerName : ''}
                  onChange={(e) => setNewFollowUp((s) => ({ ...s, callerName: String(e.target.value) }))}
                >
                  {telecallerDialogOptions.map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                label="Caller name"
                value={newFollowUp.callerName}
                onChange={(e) => setNewFollowUp((s) => ({ ...s, callerName: e.target.value }))}
                fullWidth
                disabled={addFollowUpSaving}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogEnquiryId(null)} disabled={addFollowUpSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveFollowUpFromTelecalling()}
            disabled={addFollowUpSaving || !newFollowUp.callerName.trim() || !newFollowUp.dateTime}
          >
            {addFollowUpSaving ? 'Saving…' : 'Save call'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}
