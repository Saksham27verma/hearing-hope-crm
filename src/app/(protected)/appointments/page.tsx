'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Box, 
  Paper, 
  Stack, 
  Typography, 
  Button, 
  Chip, 
  IconButton, 
  Tooltip, 
  Divider, 
  TextField, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Grid, 
  MenuItem, 
  Autocomplete, 
  ToggleButtonGroup, 
  ToggleButton, 
  TableContainer, 
  Table, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableBody, 
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  Menu,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
  Avatar,
  alpha,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import AddIcon from '@mui/icons-material/Add';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import PlaceIcon from '@mui/icons-material/Place';
import PersonIcon from '@mui/icons-material/Person';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterListIcon from '@mui/icons-material/FilterList';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import PostAddIcon from '@mui/icons-material/PostAdd';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CloseIcon from '@mui/icons-material/Close';
import NotesIcon from '@mui/icons-material/Notes';
import BusinessIcon from '@mui/icons-material/Business';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import Alert from '@mui/material/Alert';
import RefreshDataButton from '@/components/common/RefreshDataButton';
import { appointmentBlocksPipeline, canShowTelecallerPinActions, hasTelecallerCallLoggedForVisit, isAppointmentTodayKolkata, isAwaitingTelecallerPin, isComplianceFullyComplete, PIN_REQUIRES_CALL_LOG_MESSAGE } from '@/lib/visitCompliance/helpers';
import CheckoutDraftSummary from '@/components/appointments/CheckoutDraftSummary';
import type { AppointmentComplianceFields, ComplianceStatus } from '@/lib/visitCompliance/types';
import { db } from '@/firebase/config';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  doc,
  getDoc,
  where,
  updateDoc,
  deleteDoc,
  deleteField,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import {
  getAllActiveStaffDisplayNames,
  pickDefaultTelecallerName,
  type StaffRecord,
} from '@/utils/enquiryTelecallerOptions';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { addDays, endOfDay, format, startOfDay } from 'date-fns';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import CallIcon from '@mui/icons-material/Call';

function PreviewDetailRow({
  icon,
  label,
  value,
  accent = '#1565c0',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          bgcolor: alpha(accent, 0.1),
          color: accent,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}
        >
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word', mt: 0.25 }}>
          {value || '—'}
        </Typography>
      </Box>
    </Stack>
  );
}

function toDateInputValue(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function toDateTimeInputValue(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

type AppointmentType = 'center' | 'home';

type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

interface Appointment extends AppointmentComplianceFields {
  id?: string;
  title: string;
  enquiryId?: string;
  patientName?: string;
  patientPhone?: string;
  reference?: string;
  type: AppointmentType;
  centerId?: string;
  centerName?: string;
  address?: string;
  homeVisitorStaffId?: string;
  homeVisitorName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  telecaller?: string;
  notes?: string;
  start: string;
  end: string;
  status?: AppointmentStatus;
  feedback?: string;
  createdAt?: any;
  updatedAt?: any;
}

const defaultNewAppointment: Appointment = {
  title: '',
  enquiryId: '',
  patientName: '',
  type: 'center',
  centerId: '',
  address: '',
  notes: '',
  start: new Date().toISOString(),
  end: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
};

export default function AppointmentSchedulerPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const { user, userProfile } = useAuth();
  const searchParams = useSearchParams();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState(false);
  const [previewAppt, setPreviewAppt] = useState<Appointment | null>(null);
  const [previewPatientPhone, setPreviewPatientPhone] = useState<string>('');
  const [previewCenterName, setPreviewCenterName] = useState<string>('');
  const [previewHomeVisitorName, setPreviewHomeVisitorName] = useState<string>('');
  const [previewAssignedStaffName, setPreviewAssignedStaffName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newAppt, setNewAppt] = useState<Appointment>(defaultNewAppointment);
  const [centers, setCenters] = useState<any[]>([]);
  const [openPatientPicker, setOpenPatientPicker] = useState(false);
  const [allEnquiries, setAllEnquiries] = useState<any[]>([]);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquiriesLoading, setEnquiriesLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  // Filters
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [selectedExecutive, setSelectedExecutive] = useState<string>('all');
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState<Date | null>(null);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [patientCallLoggedForPin, setPatientCallLoggedForPin] = useState(false);
  const [previewEnquiryId, setPreviewEnquiryId] = useState<string | null>(null);
  const [pinCallRemarks, setPinCallRemarks] = useState('');
  const [pinCallCallerName, setPinCallCallerName] = useState('');
  const [pinCallSaving, setPinCallSaving] = useState(false);
  const [pinTelecallerOptions, setPinTelecallerOptions] = useState<string[]>([]);
  const [pinCallAndGenerate, setPinCallAndGenerate] = useState(false);
  const [calendarFullscreen, setCalendarFullscreen] = useState(false);
  
  // Role-based permissions
  const isAdmin = userProfile?.role === 'admin';
  const canEdit = isAdmin || userProfile?.role === 'staff';
  const canDelete = isAdmin;

  const fetchAllData = async () => {
    const q = query(collection(db, 'appointments'), orderBy('start', 'asc'));
    const snap = await getDocs(q);
    const appts = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Appointment[];
    setAppointments(appts);
    const [centersSnap, staffSnap] = await Promise.all([
      getDocs(collection(db, 'centers')),
      getDocs(collection(db, 'staff')),
    ]);
    setCenters(centersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    setStaffList(staffSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((s: any) => !!s.name));
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await fetchAllData();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'appointments'), orderBy('start', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const appts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Appointment[];
        setAppointments(appts);
        setPreviewAppt((prev) => {
          if (!prev?.id) return prev;
          const next = appts.find((a) => a.id === prev.id);
          return next ? { ...next } : prev;
        });
      },
      (err) => {
        console.error('appointments snapshot:', err);
      }
    );
    void (async () => {
      const [centersSnap, staffSnap] = await Promise.all([
        getDocs(collection(db, 'centers')),
        getDocs(collection(db, 'staff')),
      ]);
      setCenters(centersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setStaffList(
        staffSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((s: any) => !!s.name)
      );
    })();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!previewAppt?.enquiryId || previewAppt.type !== 'home' || !canShowTelecallerPinActions(previewAppt)) {
      return;
    }
    let cancelled = false;
    void getDoc(doc(db, 'enquiries', previewAppt.enquiryId)).then((enq) => {
      if (cancelled) return;
      const enqData = (enq.data() as any) || {};
      setPatientCallLoggedForPin(
        hasTelecallerCallLoggedForVisit(enqData.followUps, previewAppt.start)
      );
    });
    return () => {
      cancelled = true;
    };
  }, [previewAppt?.id, previewAppt?.enquiryId, previewAppt?.complianceStatus, previewAppt?.start, previewAppt?.type]);

  // Load all enquiries when patient picker opens and filter locally
  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, 'enquiries'), orderBy('name')));
      setAllEnquiries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    };
    if (openPatientPicker && allEnquiries.length === 0) void load();
  }, [openPatientPicker, allEnquiries.length]);

  const filteredEnquiries = useMemo(() => {
    const q = enquirySearch.trim().toLowerCase();
    if (!q) return allEnquiries;
    return allEnquiries.filter((e: any) =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.phone || '').toLowerCase().includes(q) ||
      (e.email || '').toLowerCase().includes(q) ||
      (e.city || '').toLowerCase().includes(q) ||
      (e.status || '').toLowerCase().includes(q)
    );
  }, [allEnquiries, enquirySearch]);

  const staffById = useMemo(() => {
    const map = new Map<string, any>();
    staffList.forEach((s: any) => {
      if (s?.id) map.set(String(s.id), s);
    });
    return map;
  }, [staffList]);

  // Filter appointments based on selected filters
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];
    
    // Filter by center
    if (selectedCenter !== 'all') {
      filtered = filtered.filter(apt => apt.centerId === selectedCenter);
    }
    
    // Filter by executive (staff)
    if (selectedExecutive !== 'all') {
      const selectedStaff = staffById.get(selectedExecutive);
      const selectedName = String(selectedStaff?.name || '').trim().toLowerCase();
      filtered = filtered.filter((apt) => {
        const homeId = String(apt.homeVisitorStaffId || '').trim();
        const centerId = String(apt.assignedStaffId || '').trim();
        if (homeId === selectedExecutive || centerId === selectedExecutive) return true;

        // Legacy-safe fallback: some older records may only have names saved.
        if (selectedName) {
          const homeName = String(apt.homeVisitorName || '').trim().toLowerCase();
          const centerName = String(apt.assignedStaffName || '').trim().toLowerCase();
          return homeName === selectedName || centerName === selectedName;
        }
        return false;
      });
    }
    
    return filtered;
  }, [appointments, selectedCenter, selectedExecutive, staffById]);

  // Get upcoming appointments (future appointments)
  const getApptStatus = (apt: Appointment): AppointmentStatus =>
    apt.status === 'completed' || apt.status === 'cancelled' ? apt.status : 'scheduled';

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return filteredAppointments
      .filter((apt) => {
        const st = getApptStatus(apt);
        if (st === 'cancelled' || st === 'completed') return false;
        return new Date(apt.start) >= now;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [filteredAppointments]);

  const awaitingPinQueue = useMemo(
    () =>
      appointments
        .filter((a) => canShowTelecallerPinActions(a))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [appointments]
  );

  const todaysAgenda = useMemo(() => {
    return filteredAppointments
      .filter((apt) => isAppointmentTodayKolkata(apt.start) && getApptStatus(apt) !== 'cancelled')
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [filteredAppointments]);

  const dashboardStats = useMemo(() => {
    const today = filteredAppointments.filter((a) => isAppointmentTodayKolkata(a.start));
    const todayLive = today.filter((a) => getApptStatus(a) !== 'cancelled');
    return {
      todayTotal: todayLive.length,
      homeToday: todayLive.filter((a) => a.type === 'home').length,
      centerToday: todayLive.filter((a) => a.type === 'center').length,
      completedToday: today.filter((a) => getApptStatus(a) === 'completed').length,
      scheduledToday: todayLive.filter((a) => getApptStatus(a) === 'scheduled').length,
      awaitingPin: awaitingPinQueue.length,
      upcomingCount: upcomingAppointments.length,
    };
  }, [filteredAppointments, awaitingPinQueue.length, upcomingAppointments.length]);

  const events = useMemo(
    () => {
      // Always include awaiting-PIN visits so red events stay visible even when filters hide them
      const byId = new Map<string, (typeof appointments)[number]>();
      for (const a of filteredAppointments) {
        if (a.id) byId.set(a.id, a);
      }
      for (const a of appointments) {
        if (!a.id) continue;
        if (canShowTelecallerPinActions(a) && !byId.has(a.id)) byId.set(a.id, a);
      }
      return Array.from(byId.values()).map((a) => {
        const st = getApptStatus(a);
        const awaitingPin = isAwaitingTelecallerPin(a);
        const baseCenter = '#1976d2';
        const baseHome = '#43a047';
        let backgroundColor = a.type === 'center' ? baseCenter : baseHome;
        let borderColor = a.type === 'center' ? '#1565c0' : '#2e7d32';
        if (st === 'cancelled') {
          backgroundColor = '#9e9e9e';
          borderColor = '#616161';
        } else if (awaitingPin) {
          // Staff finished on-site and is waiting for telecaller PIN — high visibility
          backgroundColor = '#d32f2f';
          borderColor = '#b71c1c';
        } else if (st === 'completed') {
          backgroundColor = '#2e7d32';
          borderColor = '#1b5e20';
        }
        const timeLabel = new Date(a.start).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        });
        const staffLabel =
          a.type === 'home'
            ? a.homeVisitorName || ''
            : a.assignedStaffName || '';
        const titlePrefix =
          st === 'cancelled' ? '✕ ' : awaitingPin ? 'PIN · ' : st === 'completed' ? '✓ ' : '';
        const patient = a.patientName || a.title || 'Patient';
        const typeTag = a.type === 'home' ? 'Home' : 'Center';
        return {
          id: a.id,
          title: `${titlePrefix}${patient} · ${timeLabel} · ${typeTag}${staffLabel ? ` · ${staffLabel}` : ''}`,
          start: a.start,
          end: a.end,
          extendedProps: { ...a, status: st, awaitingPin, timeLabel, staffLabel, patient },
          backgroundColor,
          borderColor,
          classNames: st === 'cancelled'
            ? ['appt-cancelled']
            : awaitingPin
              ? ['appt-awaiting-pin']
              : st === 'completed'
                ? ['appt-completed']
                : a.type === 'home'
                  ? ['appt-home']
                  : ['appt-center'],
        };
      });
    },
    [filteredAppointments, appointments]
  );

  const calendarRemountKey = useMemo(
    () =>
      awaitingPinQueue
        .map((a) => `${a.id}:${a.complianceStatus || ''}`)
        .join('|'),
    [awaitingPinQueue]
  );


  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const handleDateSelect = (info: any) => {
    setNewAppt({
      ...defaultNewAppointment,
      start: info.startStr,
      end: info.endStr,
    });
    setOpenDialog(true);
  };

  const openPreviewForAppointment = useCallback(
    async (data: Appointment) => {
      setPreviewAppt(data);
      setGeneratedPin(data.telecaller_pin || null);
      setPinError(null);
      setPatientCallLoggedForPin(false);
      setPreviewEnquiryId(data.enquiryId || null);
      setPinCallRemarks('');
      setPinCallAndGenerate(false);
      let phone = '';
      let centerName = '';
      let homeVisitorName = data.homeVisitorName || '';
      let assignedStaffName = data.assignedStaffName || '';
      let enquiryTelecaller = data.telecaller || '';
      try {
        if (data.enquiryId) {
          const enq = await getDoc(doc(db, 'enquiries', data.enquiryId));
          const enqData = (enq.data() as any) || {};
          phone = enqData?.phone || '';
          enquiryTelecaller = String(enqData.telecaller || data.telecaller || '').trim();
          if (data.type === 'home') {
            setPatientCallLoggedForPin(
              hasTelecallerCallLoggedForVisit(enqData.followUps, data.start)
            );
          }
          const staffAsRecords = staffList.map(
            (s: any) =>
              ({
                id: String(s.id || ''),
                name: String(s.name || ''),
                jobRole: String(s.jobRole || ''),
                status: s.status || 'active',
              }) as StaffRecord
          );
          const options = getAllActiveStaffDisplayNames(staffAsRecords, [
            enquiryTelecaller,
            userProfile?.displayName,
            data.telecaller,
          ]);
          setPinTelecallerOptions(options);
          setPinCallCallerName(
            pickDefaultTelecallerName(options, {
              displayName: userProfile?.displayName,
              enquiryTelecaller,
            })
          );
        } else {
          setPinTelecallerOptions([]);
          setPinCallCallerName(userProfile?.displayName || '');
        }
        if (data.centerId) {
          const cen = await getDoc(doc(db, 'centers', data.centerId));
          centerName = (cen.data() as any)?.name || '';
        }
        if (!homeVisitorName && data.homeVisitorStaffId) {
          const st = await getDoc(doc(db, 'staff', data.homeVisitorStaffId));
          homeVisitorName = (st.data() as any)?.name || '';
        }
        if (!assignedStaffName && data.assignedStaffId) {
          const st = await getDoc(doc(db, 'staff', data.assignedStaffId));
          assignedStaffName = (st.data() as any)?.name || '';
        }
      } catch {}
      setPreviewPatientPhone(phone);
      setPreviewCenterName(centerName);
      setPreviewHomeVisitorName(homeVisitorName);
      setPreviewAssignedStaffName(assignedStaffName);
      setOpenPreview(true);
    },
    [staffList, userProfile?.displayName]
  );

  const handleEventClick = async (clickInfo: any) => {
    const data = clickInfo.event.extendedProps as Appointment;
    await openPreviewForAppointment(data);
  };

  useEffect(() => {
    const id = (searchParams.get('awaitingPin') || '').trim();
    if (!id || appointments.length === 0) return;
    const apt = appointments.find((a) => a.id === id);
    if (!apt) return;
    void openPreviewForAppointment(apt);
  }, [searchParams, appointments, openPreviewForAppointment]);

  const generateCompliancePinForPreview = async (): Promise<boolean> => {
    if (!previewAppt?.id || !user) return false;
    setPinBusy(true);
    setPinError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/appointments/generate-compliance-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ appointmentId: previewAppt.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        pin?: string;
        error?: string;
        complianceStatus?: ComplianceStatus;
      };
      if (!res.ok || !data.ok || !data.pin) {
        throw new Error(data.error || 'Failed to generate PIN');
      }
      setGeneratedPin(data.pin);
      const patch: Partial<Appointment> = {
        telecaller_pin: data.pin,
        telecaller_verified: false,
        complianceStatus: data.complianceStatus || 'pending_verification',
      };
      setPreviewAppt((prev) => (prev ? { ...prev, ...patch } : prev));
      setAppointments((prev) =>
        prev.map((a) => (a.id === previewAppt.id ? { ...a, ...patch } : a))
      );
      return true;
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Failed to generate PIN');
      return false;
    } finally {
      setPinBusy(false);
    }
  };

  const handleGenerateCompliancePin = async () => {
    await generateCompliancePinForPreview();
  };

  const handleLogCallForPin = async (alsoGeneratePin: boolean) => {
    if (!previewAppt?.id || !previewEnquiryId) {
      setPinError('This appointment has no linked enquiry. Link a patient first.');
      return;
    }
    if (!pinCallCallerName.trim()) {
      setPinError('Select who made the call (telecaller).');
      return;
    }
    if (!pinCallRemarks.trim()) {
      setPinError('Enter the customer’s actual feedback in call remarks.');
      return;
    }
    setPinCallSaving(true);
    setPinCallAndGenerate(alsoGeneratePin);
    setPinError(null);
    try {
      const ref = doc(db, 'enquiries', previewEnquiryId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Enquiry not found');
      const data = snap.data() as Record<string, unknown>;
      const prev = Array.isArray(data.followUps) ? (data.followUps as unknown[]) : [];
      const now = new Date();
      const nextWeek = addDays(now, 7);
      const followUpData = {
        date: toDateInputValue(now),
        dateTime: toDateTimeInputValue(now),
        remarks: pinCallRemarks.trim(),
        nextFollowUpDate: toDateInputValue(nextWeek),
        nextFollowUpDateTime: toDateTimeInputValue(nextWeek),
        callerName: pinCallCallerName.trim(),
        id:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `fu-${Date.now()}`,
        createdAt: Timestamp.now(),
      };
      const updated = [...prev, followUpData];
      await updateDoc(ref, { followUps: updated });

      const entityName =
        String(data.name || previewAppt.patientName || previewAppt.title || 'Enquiry').trim() ||
        'Enquiry';
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'FOLLOW_UP',
        module: 'Appointments',
        entityId: previewEnquiryId,
        entityName,
        description: `Telecall logged from Appointments (end-of-visit PIN) by ${followUpData.callerName}${
          followUpData.remarks ? ` — "${followUpData.remarks}"` : ''
        }`,
        changes: {
          followUp: {
            before: null,
            after: {
              callerName: followUpData.callerName,
              date: followUpData.date,
              dateTime: followUpData.dateTime,
              remarks: followUpData.remarks,
              nextFollowUpDate: followUpData.nextFollowUpDate,
              nextFollowUpDateTime: followUpData.nextFollowUpDateTime,
            },
          },
        },
        metadata: {
          appointmentId: previewAppt.id,
          callerName: followUpData.callerName,
          remarks: followUpData.remarks,
        },
      }, user);

      const callLogged = hasTelecallerCallLoggedForVisit(updated, previewAppt.start);
      setPatientCallLoggedForPin(callLogged);
      if (!callLogged) {
        throw new Error(
          'Call was saved, but it does not fall in this visit window. Check the appointment start time.'
        );
      }

      if (alsoGeneratePin) {
        setPinCallSaving(false);
        await generateCompliancePinForPreview();
      }
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Failed to log call');
    } finally {
      setPinCallSaving(false);
      setPinCallAndGenerate(false);
    }
  };

  const handleComplianceAdminOverride = async () => {
    if (!previewAppt?.id || !user || !isAdmin) return;
    const reason = window.prompt(
      'Admin override: optional reason for bypassing incomplete visit compliance'
    );
    if (reason === null) return;
    setOverrideBusy(true);
    setPinError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/appointments/compliance-admin-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ appointmentId: previewAppt.id, reason }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Override failed');
      const override = {
        byUid: user.uid,
        byName: userProfile?.displayName || user.email || user.uid,
        at: new Date().toISOString(),
        reason: reason || 'Admin bypass of incomplete visit compliance',
      };
      setPreviewAppt((prev) => (prev ? { ...prev, complianceAdminOverride: override } : prev));
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === previewAppt.id ? { ...a, complianceAdminOverride: override } : a
        )
      );
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setOverrideBusy(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!newAppt.patientName) throw new Error('Select a patient');
      if (newAppt.type === 'center' && !newAppt.centerId) throw new Error('Select a center');
      if (newAppt.type === 'center' && !newAppt.assignedStaffId) throw new Error('Select staff for center visit');
      if (newAppt.type === 'home' && !newAppt.centerId) throw new Error('Select which center this home visit is for');
      if (newAppt.type === 'home' && !newAppt.homeVisitorStaffId) throw new Error('Select staff for home visit');

      const centerName = newAppt.centerId ? centers.find((c) => c.id === newAppt.centerId)?.name : '';
      const payload = {
        ...newAppt,
        title: newAppt.patientName || newAppt.title || '',
        status: newAppt.status || 'scheduled',
        centerName: centerName || undefined,
        updatedAt: serverTimestamp(),
      };

      if (isEditMode && editingAppointmentId) {
        const prev = appointments.find((a) => a.id === editingAppointmentId);
        const startChanged = Boolean(prev && prev.start !== newAppt.start);
        const patch = { ...payload } as Record<string, unknown>;
        if (startChanged) patch.pwaReminderSentForStart = deleteField();
        await updateDoc(doc(db, 'appointments', editingAppointmentId), patch);
        void logActivity(db, userProfile, userProfile?.centerId, {
          action: 'UPDATE',
          module: 'Appointments',
          entityId: editingAppointmentId,
          entityName: newAppt.patientName || newAppt.title || 'Appointment',
          description: `Updated appointment for ${newAppt.patientName || 'patient'}`,
          metadata: { start: newAppt.start, type: newAppt.type },
        }, user);
      } else {
        // Create new appointment
        const apptRef = await addDoc(collection(db, 'appointments'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        void logActivity(db, userProfile, userProfile?.centerId, {
          action: 'CREATE',
          module: 'Appointments',
          entityId: apptRef.id,
          entityName: newAppt.patientName || newAppt.title || 'Appointment',
          description: `Scheduled appointment for ${newAppt.patientName || 'patient'} on ${newAppt.start ? new Date(newAppt.start).toLocaleDateString('en-IN') : 'unknown date'}`,
          metadata: { start: newAppt.start, type: newAppt.type },
        }, user);
        // Send push notification to assigned staff
        const staffId = newAppt.type === 'home' ? newAppt.homeVisitorStaffId : newAppt.assignedStaffId;
        if (staffId) {
          fetch('/api/send-appointment-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientName: newAppt.patientName || newAppt.title,
              start: newAppt.start,
              homeVisitorStaffId: staffId,
            }),
          }).catch((e) => console.warn('Notification send failed:', e));
        }
      }
      
      await fetchAllData();
      setOpenDialog(false);
      setIsEditMode(false);
      setEditingAppointmentId(null);
      setNewAppt(defaultNewAppointment);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save appointment');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    if (!previewAppt || !previewAppt.id) return;
    setNewAppt(previewAppt);
    setIsEditMode(true);
    setEditingAppointmentId(previewAppt.id);
    setOpenPreview(false);
    setOpenDialog(true);
  };

  const handleDelete = async () => {
    if (!previewAppt || !previewAppt.id) return;
    if (!confirm(`Are you sure you want to delete this appointment for ${previewAppt.patientName}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'appointments', previewAppt.id));
      const q = query(collection(db, 'appointments'), orderBy('start', 'asc'));
      const snap = await getDocs(q);
      setAppointments(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Appointment[]);
      setOpenPreview(false);
      alert('Appointment deleted successfully');
    } catch (e) {
      console.error(e);
      alert('Failed to delete appointment');
    }
  };

  const handleCancelAppointment = async () => {
    if (!previewAppt?.id) return;
    if (!confirm(`Cancel this visit for ${previewAppt.patientName || 'this patient'}? It will remain on the calendar as cancelled.`)) return;
    try {
      await updateDoc(doc(db, 'appointments', previewAppt.id), {
        status: 'cancelled' as AppointmentStatus,
        updatedAt: serverTimestamp(),
      });
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'CANCEL',
        module: 'Appointments',
        entityId: previewAppt.id,
        entityName: previewAppt.patientName || previewAppt.title || 'Appointment',
        description: `Cancelled appointment for ${previewAppt.patientName || 'patient'}`,
        metadata: { start: previewAppt.start },
      }, user);
      await fetchAllData();
      setOpenPreview(false);
    } catch (e) {
      console.error(e);
      alert('Failed to cancel appointment');
    }
  };

  const handleMarkAppointmentCompleted = async () => {
    if (!previewAppt?.id) return;
    try {
      await updateDoc(doc(db, 'appointments', previewAppt.id), {
        status: 'completed' as AppointmentStatus,
        updatedAt: serverTimestamp(),
      });
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'STATUS_CHANGE',
        module: 'Appointments',
        entityId: previewAppt.id,
        entityName: previewAppt.patientName || previewAppt.title || 'Appointment',
        description: `Marked appointment completed for ${previewAppt.patientName || 'patient'}`,
        metadata: { start: previewAppt.start },
      }, user);
      await fetchAllData();
      setOpenPreview(false);
    } catch (e) {
      console.error(e);
      alert('Failed to update appointment');
    }
  };

  const openRescheduleSameDayDialog = () => {
    if (!previewAppt?.start) return;
    setRescheduleAt(new Date(previewAppt.start));
    setRescheduleDialogOpen(true);
  };

  const handleConfirmRescheduleSameDay = async () => {
    if (!previewAppt?.id || !rescheduleAt) return;
    const origStart = new Date(previewAppt.start);
    const origEnd = new Date(previewAppt.end || previewAppt.start);
    if (!isSameCalendarDay(rescheduleAt, origStart)) {
      alert('Choose a date and time on the same calendar day as the original appointment.');
      return;
    }
    const duration = Math.max(15 * 60 * 1000, origEnd.getTime() - origStart.getTime());
    const newStart = new Date(rescheduleAt);
    const newEnd = new Date(newStart.getTime() + duration);
    setRescheduleSaving(true);
    try {
      await updateDoc(doc(db, 'appointments', previewAppt.id), {
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
        updatedAt: serverTimestamp(),
        pwaReminderSentForStart: deleteField(),
      });
      void logActivity(db, userProfile, userProfile?.centerId, {
        action: 'RESCHEDULE',
        module: 'Appointments',
        entityId: previewAppt.id,
        entityName: previewAppt.patientName || previewAppt.title || 'Appointment',
        description: `Rescheduled appointment for ${previewAppt.patientName || 'patient'} to ${newStart.toLocaleDateString('en-IN')} ${newStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        metadata: { originalStart: previewAppt.start, newStart: newStart.toISOString() },
      }, user);
      await fetchAllData();
      setRescheduleDialogOpen(false);
      setOpenPreview(false);
    } catch (e) {
      console.error(e);
      alert('Failed to reschedule');
    } finally {
      setRescheduleSaving(false);
    }
  };

  const handleScheduleAnotherVisit = () => {
    if (!previewAppt) return;
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setNewAppt({
      ...defaultNewAppointment,
      enquiryId: previewAppt.enquiryId || '',
      patientName: previewAppt.patientName || previewAppt.title || '',
      patientPhone: previewAppt.patientPhone || previewPatientPhone || '',
      reference: previewAppt.reference || '',
      type: previewAppt.type,
      centerId: previewAppt.centerId || '',
      address: previewAppt.address || '',
      homeVisitorStaffId: previewAppt.homeVisitorStaffId || '',
      homeVisitorName: previewAppt.homeVisitorName || '',
      assignedStaffId: previewAppt.assignedStaffId || '',
      assignedStaffName: previewAppt.assignedStaffName || '',
      telecaller: previewAppt.telecaller || '',
      notes: '',
      start: start.toISOString(),
      end: end.toISOString(),
      status: 'scheduled',
    });
    setOpenPreview(false);
    setIsEditMode(false);
    setEditingAppointmentId(null);
    setOpenDialog(true);
  };

  // Export functions
  const exportAsImage = async () => {
    try {
      setExportMenuAnchor(null);
      
      // Create a temporary div with the appointments list
      const exportDiv = document.createElement('div');
      exportDiv.style.width = '800px';
      exportDiv.style.padding = '40px';
      exportDiv.style.backgroundColor = 'white';
      exportDiv.style.fontFamily = 'Arial, sans-serif';
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      
      exportDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1976d2; padding-bottom: 20px;">
          <h1 style="color: #1976d2; margin: 0; font-size: 32px;">Upcoming Appointments</h1>
          <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Generated on ${dateStr}</p>
        </div>
        <div style="margin-top: 30px;">
          ${upcomingAppointments.length === 0 ? 
            '<p style="text-align: center; color: #999; font-size: 18px; padding: 40px;">No upcoming appointments</p>' :
            upcomingAppointments.map((apt, idx) => {
              const aptDate = new Date(apt.start);
              const dateStr = aptDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              const timeStr = aptDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              const center = centers.find(c => c.id === apt.centerId);
              const staff = staffList.find(s => s.id === apt.homeVisitorStaffId);
              
              return `
                <div style="margin-bottom: 25px; padding: 20px; border: 2px solid ${apt.type === 'center' ? '#1976d2' : '#43a047'}; border-radius: 8px; background: ${apt.type === 'center' ? '#e3f2fd' : '#e8f5e9'};">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                      <h2 style="margin: 0; color: #333; font-size: 24px;">${apt.patientName || 'Patient'}</h2>
                      <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">${apt.type === 'center' ? '🏢 Center Visit' : '🏠 Home Visit'}</p>
                    </div>
                    <div style="text-align: right;">
                      <p style="margin: 0; color: #1976d2; font-size: 18px; font-weight: bold;">${dateStr}</p>
                      <p style="margin: 5px 0 0 0; color: #666; font-size: 16px;">${timeStr}</p>
                    </div>
                  </div>
                  <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                    ${center ? `<p style="margin: 5px 0; color: #555; font-size: 14px;"><strong>Enquiry Center:</strong> ${center.name}</p>` : ''}
                    ${apt.reference ? `<p style="margin: 5px 0; color: #555; font-size: 14px;"><strong>Reference:</strong> ${apt.reference}</p>` : ''}
                    ${apt.type === 'home' && staff ? `<p style="margin: 5px 0; color: #555; font-size: 14px;"><strong>Executive:</strong> ${staff.name}</p>` : ''}
                    ${apt.type === 'home' && apt.address ? `<p style="margin: 5px 0; color: #555; font-size: 14px;"><strong>Address:</strong> ${apt.address}</p>` : ''}
                    ${apt.notes ? `<p style="margin: 10px 0 0 0; color: #666; font-size: 13px; font-style: italic;">${apt.notes}</p>` : ''}
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #999; font-size: 12px;">
          <p style="margin: 0;"> - Appointment Schedule</p>
        </div>
      `;
      
      document.body.appendChild(exportDiv);
      
      const canvas = await html2canvas(exportDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      
      document.body.removeChild(exportDiv);
      
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `appointments-${now.toISOString().split('T')[0]}.png`;
      link.href = imgData;
      link.click();
    } catch (error) {
      console.error('Error exporting as image:', error);
      alert('Failed to export as image. Please try again.');
    }
  };

  const exportAsPDF = async () => {
    try {
      setExportMenuAnchor(null);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;
      
      let yPos = margin;
      
      // Header
      pdf.setFontSize(24);
      pdf.setTextColor(25, 118, 210);
      pdf.text('Upcoming Appointments', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
      pdf.text(`Generated on ${dateStr}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;
      
      // Draw line
      pdf.setDrawColor(25, 118, 210);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;
      
      if (upcomingAppointments.length === 0) {
        pdf.setFontSize(14);
        pdf.setTextColor(150, 150, 150);
        pdf.text('No upcoming appointments', pageWidth / 2, yPos, { align: 'center' });
      } else {
        upcomingAppointments.forEach((apt, idx) => {
          // Check if we need a new page
          if (yPos > pageHeight - 60) {
            pdf.addPage();
            yPos = margin;
          }
          
          const aptDate = new Date(apt.start);
          const dateStr = aptDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr = aptDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          const center = centers.find(c => c.id === apt.centerId);
          const staff = staffList.find(s => s.id === apt.homeVisitorStaffId);
          
          // Appointment box background
          pdf.setFillColor(apt.type === 'center' ? 227 : 232, apt.type === 'center' ? 242 : 245, apt.type === 'center' ? 253 : 233);
          pdf.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'F');
          
          // Border
          pdf.setDrawColor(apt.type === 'center' ? 25 : 67, apt.type === 'center' ? 118 : 160, apt.type === 'center' ? 210 : 71);
          pdf.setLineWidth(0.5);
          pdf.roundedRect(margin, yPos, contentWidth, 35, 3, 3, 'D');
          
          yPos += 8;
          
          // Patient name
          pdf.setFontSize(16);
          pdf.setTextColor(50, 50, 50);
          pdf.setFont(undefined, 'bold');
          pdf.text(apt.patientName || 'Patient', margin + 5, yPos);
          
          // Date and time on the right
          pdf.setFontSize(12);
          pdf.setTextColor(25, 118, 210);
          pdf.setFont(undefined, 'bold');
          const dateWidth = pdf.getTextWidth(dateStr);
          pdf.text(dateStr, pageWidth - margin - 5 - dateWidth, yPos);
          yPos += 6;
          
          pdf.setFontSize(10);
          pdf.setTextColor(100, 100, 100);
          pdf.setFont(undefined, 'normal');
          pdf.text(`${apt.type === 'center' ? '🏢 Center Visit' : '🏠 Home Visit'}`, margin + 5, yPos);
          
          const timeWidth = pdf.getTextWidth(timeStr);
          pdf.text(timeStr, pageWidth - margin - 5 - timeWidth, yPos);
          yPos += 8;
          
          // Details
          pdf.setFontSize(10);
          pdf.setTextColor(80, 80, 80);
          
          if (center) {
            pdf.text(`Center: ${center.name}`, margin + 5, yPos);
            yPos += 5;
          }

          if (apt.reference) {
            pdf.text(`Reference: ${apt.reference}`, margin + 5, yPos);
            yPos += 5;
          }
          
          if (apt.type === 'home' && staff) {
            pdf.text(`Executive: ${staff.name}`, margin + 5, yPos);
            yPos += 5;
          }
          
          if (apt.type === 'home' && apt.address) {
            const addressLines = pdf.splitTextToSize(`Address: ${apt.address}`, contentWidth - 10);
            pdf.text(addressLines, margin + 5, yPos);
            yPos += addressLines.length * 5;
          }
          
          if (apt.notes) {
            pdf.setFont(undefined, 'italic');
            pdf.setTextColor(100, 100, 100);
            const notesLines = pdf.splitTextToSize(apt.notes, contentWidth - 10);
            pdf.text(notesLines, margin + 5, yPos);
            yPos += notesLines.length * 5;
          }
          
          yPos += 10; // Space between appointments
        });
      }
      
      // Footer
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text('Hearing Hope CRM - Appointment Schedule', pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      pdf.save(`appointments-${now.toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting as PDF:', error);
      alert('Failed to export as PDF. Please try again.');
    }
  };

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2, md: 3 },
        minHeight: '100%',
        background: `linear-gradient(180deg, ${alpha('#e3f2fd', 0.55)} 0%, ${alpha('#f1f8e9', 0.35)} 42%, #f7f9fc 100%)`,
      }}
    >
      {/* Hero */}
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          p: { xs: 2, sm: 2.5 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha('#1565c0', 0.12),
          background: `linear-gradient(120deg, ${alpha('#1565c0', 0.1)} 0%, ${alpha('#2e7d32', 0.08)} 48%, ${alpha('#fff', 0.95)} 100%)`,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 1 }}>
              Hearing Hope · Field & center
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.45rem', sm: '1.85rem', md: '2rem' },
                lineHeight: 1.2,
                color: '#0d47a1',
              }}
            >
              Appointment Scheduler
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 560 }}>
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {' · '}
              {dashboardStats.todayTotal} visit{dashboardStats.todayTotal === 1 ? '' : 's'} today
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            flexWrap="wrap"
            useFlexGap
          >
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
              <InputLabel>Center</InputLabel>
              <Select
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                label="Center"
              >
                <MenuItem value="all">All Centers</MenuItem>
                {centers.map((center) => (
                  <MenuItem key={center.id} value={center.id}>
                    {center.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 } }}>
              <InputLabel>Executive</InputLabel>
              <Select
                value={selectedExecutive}
                onChange={(e) => setSelectedExecutive(e.target.value)}
                label="Executive"
              >
                <MenuItem value="all">All Executives</MenuItem>
                {staffList.map((staff) => (
                  <MenuItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              sx={{ bgcolor: 'background.paper' }}
            >
              Export
            </Button>
            <Menu
              anchorEl={exportMenuAnchor}
              open={Boolean(exportMenuAnchor)}
              onClose={() => setExportMenuAnchor(null)}
            >
              <MenuItem onClick={exportAsImage}>
                <ListItemIcon>
                  <ImageIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Export as Image (JPG)</ListItemText>
              </MenuItem>
              <MenuItem onClick={exportAsPDF}>
                <ListItemIcon>
                  <PictureAsPdfIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Export as PDF</ListItemText>
              </MenuItem>
            </Menu>
            <RefreshDataButton onClick={handleRefresh} loading={refreshing} />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setNewAppt(defaultNewAppointment);
                setOpenDialog(true);
              }}
              sx={{ boxShadow: 'none', fontWeight: 700 }}
            >
              New Appointment
            </Button>
          </Stack>
        </Stack>

        {(selectedCenter !== 'all' || selectedExecutive !== 'all') && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.75 }}>
            <Chip icon={<FilterListIcon />} label="Filters" size="small" color="primary" variant="outlined" />
            {selectedCenter !== 'all' && (
              <Chip
                size="small"
                label={`Center: ${centers.find((c) => c.id === selectedCenter)?.name || 'Unknown'}`}
                onDelete={() => setSelectedCenter('all')}
                color="primary"
              />
            )}
            {selectedExecutive !== 'all' && (
              <Chip
                size="small"
                label={`Executive: ${staffList.find((s) => s.id === selectedExecutive)?.name || 'Unknown'}`}
                onDelete={() => setSelectedExecutive('all')}
                color="secondary"
              />
            )}
            <Button
              size="small"
              onClick={() => {
                setSelectedCenter('all');
                setSelectedExecutive('all');
              }}
            >
              Clear all
            </Button>
          </Stack>
        )}
      </Paper>

      {/* Stats strip — max info at a glance */}
      <Box
        sx={{
          mb: 2,
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: 'repeat(6, minmax(0, 1fr))',
          },
        }}
      >
        {[
          {
            label: 'Today',
            value: dashboardStats.todayTotal,
            sub: `${dashboardStats.scheduledToday} scheduled`,
            color: '#1565c0',
            icon: <EventIcon fontSize="small" />,
          },
          {
            label: 'Home visits',
            value: dashboardStats.homeToday,
            sub: 'Today',
            color: '#2e7d32',
            icon: <HomeWorkIcon fontSize="small" />,
          },
          {
            label: 'Center visits',
            value: dashboardStats.centerToday,
            sub: 'Today',
            color: '#0277bd',
            icon: <BusinessIcon fontSize="small" />,
          },
          {
            label: 'Awaiting PIN',
            value: dashboardStats.awaitingPin,
            sub: 'Needs telecaller',
            color: '#c62828',
            icon: <VpnKeyIcon fontSize="small" />,
            alert: dashboardStats.awaitingPin > 0,
          },
          {
            label: 'Completed',
            value: dashboardStats.completedToday,
            sub: 'Today',
            color: '#00897b',
            icon: <CheckCircleOutlineIcon fontSize="small" />,
          },
          {
            label: 'Upcoming',
            value: dashboardStats.upcomingCount,
            sub: 'From now on',
            color: '#ef6c00',
            icon: <AccessTimeIcon fontSize="small" />,
          },
        ].map((stat) => (
          <Paper
            key={stat.label}
            elevation={0}
            sx={{
              p: 1.5,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: stat.alert ? alpha(stat.color, 0.45) : alpha(stat.color, 0.16),
              bgcolor: alpha(stat.color, stat.alert ? 0.1 : 0.05),
              minHeight: 88,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}
                >
                  {stat.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: stat.color, lineHeight: 1.1, mt: 0.25 }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {stat.sub}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(stat.color, 0.14),
                  color: stat.color,
                }}
              >
                {stat.icon}
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      {/* Calendar + Today agenda */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' },
          alignItems: 'start',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.25, sm: 2 },
            overflow: 'auto',
            borderRadius: 3,
            border: '1px solid',
            borderColor: alpha('#1565c0', 0.12),
            bgcolor: 'background.paper',
            boxShadow: `0 10px 30px ${alpha('#0d47a1', 0.06)}`,
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 1.5, px: 0.5 }}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mr: 0.5 }}>
                Calendar
              </Typography>
              <Chip size="small" sx={{ bgcolor: alpha('#43a047', 0.15), color: '#1b5e20', fontWeight: 700 }} label="Home" />
              <Chip size="small" sx={{ bgcolor: alpha('#1976d2', 0.15), color: '#0d47a1', fontWeight: 700 }} label="Center" />
              <Chip size="small" sx={{ bgcolor: alpha('#d32f2f', 0.15), color: '#b71c1c', fontWeight: 700 }} label="Awaiting PIN" />
              <Chip size="small" sx={{ bgcolor: alpha('#9e9e9e', 0.2), color: '#424242', fontWeight: 700 }} label="Cancelled" />
            </Stack>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FullscreenIcon />}
              onClick={() => setCalendarFullscreen(true)}
              sx={{ fontWeight: 700, flexShrink: 0 }}
            >
              Full screen month
            </Button>
          </Stack>
          <Box
            sx={{
              '& .fc': {
                fontSize: { xs: '0.75rem', sm: '0.875rem', md: '0.95rem' },
                '--fc-border-color': alpha('#90a4ae', 0.35),
                '--fc-page-bg-color': 'transparent',
                '--fc-neutral-bg-color': alpha('#eceff1', 0.55),
                '--fc-today-bg-color': alpha('#fff8e1', 0.85),
                '--fc-button-bg-color': '#1565c0',
                '--fc-button-border-color': '#1565c0',
                '--fc-button-hover-bg-color': '#0d47a1',
                '--fc-button-hover-border-color': '#0d47a1',
                '--fc-button-active-bg-color': '#0d47a1',
                '--fc-button-active-border-color': '#0d47a1',
              },
              '& .fc-toolbar': {
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 1, sm: 0.5 },
                mb: 1.5,
              },
              '& .fc-toolbar-title': {
                fontSize: { xs: '1.05rem', sm: '1.3rem', md: '1.45rem' },
                fontWeight: 800,
                color: '#0d47a1',
              },
              '& .fc-button': {
                fontSize: { xs: '0.7rem', sm: '0.8rem' },
                padding: { xs: '4px 8px', sm: '6px 11px' },
                borderRadius: '10px !important',
                textTransform: 'capitalize',
                fontWeight: 700,
                boxShadow: 'none',
              },
              '& .fc-button-primary:not(:disabled).fc-button-active, & .fc-button-primary:not(:disabled):active': {
                boxShadow: 'none',
              },
              '& .fc-col-header-cell': {
                bgcolor: alpha('#e3f2fd', 0.65),
                py: 1,
              },
              '& .fc-col-header-cell-cushion': {
                fontWeight: 800,
                color: '#37474f',
                textTransform: 'uppercase',
                fontSize: '0.72rem',
                letterSpacing: 0.4,
              },
              '& .fc-daygrid-day-number': {
                fontSize: { xs: '0.72rem', sm: '0.85rem' },
                padding: { xs: '4px 6px', sm: '6px 8px' },
                fontWeight: 700,
                color: '#455a64',
              },
              '& .fc-daygrid-day.fc-day-today .fc-daygrid-day-number': {
                bgcolor: '#ef6c00',
                color: '#fff',
                borderRadius: '999px',
                width: 28,
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                m: '4px',
              },
              '& .fc-event': {
                border: 'none',
                borderRadius: '8px',
                px: 0.5,
                py: 0.25,
                mb: '2px',
                boxShadow: `0 1px 2px ${alpha('#000', 0.12)}`,
                cursor: 'pointer',
              },
              '& .fc-event-main': {
                padding: '2px 4px',
              },
              '& .fc-event-title': {
                fontSize: { xs: '0.65rem', sm: '0.72rem' },
                fontWeight: 700,
                lineHeight: 1.25,
                whiteSpace: 'normal',
              },
              '& .appt-cancelled': {
                opacity: 0.78,
                '& .fc-event-title': { textDecoration: 'line-through' },
              },
              '& .appt-completed': {
                opacity: 0.95,
              },
              '& .appt-awaiting-pin': {
                fontWeight: 800,
                boxShadow: `0 0 0 2px ${alpha('#b71c1c', 0.4)}, 0 2px 8px ${alpha('#c62828', 0.25)}`,
              },
              '& .fc-daygrid-more-link': {
                fontWeight: 800,
                color: '#1565c0',
              },
              '& .fc-list-event-title': {
                fontWeight: 700,
              },
            }}
          >
            <FullCalendar
              key={calendarRemountKey || 'calendar'}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              headerToolbar={{
                left: isMobile ? 'prev,next' : 'prev,next today',
                center: 'title',
                right: isMobile ? 'dayGridMonth,listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              initialView={isMobile ? 'listWeek' : 'timeGridWeek'}
              selectable
              selectMirror
              dayMaxEvents={isMobile ? true : undefined}
              events={events}
              select={handleDateSelect}
              eventClick={handleEventClick}
              height={isMobile ? 'auto' : 'calc(100vh - 360px)'}
              eventDisplay={isMobile ? 'list-item' : 'block'}
              dayMaxEventRows={isMobile ? 2 : 4}
              moreLinkClick={isMobile ? 'popover' : 'day'}
              nowIndicator
              eventContent={(arg) => {
                const p = arg.event.extendedProps as {
                  patient?: string;
                  timeLabel?: string;
                  staffLabel?: string;
                  type?: string;
                  awaitingPin?: boolean;
                  status?: string;
                };
                const patient = p.patient || arg.event.title;
                const isMonth = arg.view.type === 'dayGridMonth';
                return (
                  <Box sx={{ overflow: 'hidden', lineHeight: 1.2, px: 0.25 }}>
                    <Typography
                      component="div"
                      sx={{
                        fontSize: isMonth ? '0.68rem' : '0.75rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.awaitingPin ? 'PIN · ' : p.status === 'completed' ? '✓ ' : ''}
                      {isMonth ? `${p.timeLabel || ''} ` : ''}
                      {patient}
                    </Typography>
                    {!isMonth ? (
                      <Typography
                        component="div"
                        sx={{
                          fontSize: '0.65rem',
                          opacity: 0.92,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.type === 'home' ? 'Home' : 'Center'}
                        {p.staffLabel ? ` · ${p.staffLabel}` : ''}
                      </Typography>
                    ) : null}
                  </Box>
                );
              }}
              views={{
                dayGridMonth: {
                  dayMaxEventRows: isMobile ? 2 : 4,
                  moreLinkClick: isMobile ? 'popover' : 'day',
                },
                timeGridWeek: {
                  slotMinTime: '08:00:00',
                  slotMaxTime: '20:00:00',
                  slotDuration: '00:30:00',
                },
                timeGridDay: {
                  slotMinTime: '08:00:00',
                  slotMaxTime: '20:00:00',
                },
                listWeek: {
                  duration: { days: 7 },
                },
              }}
            />
          </Box>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            border: '1px solid',
            borderColor: alpha('#2e7d32', 0.16),
            bgcolor: 'background.paper',
            maxHeight: { lg: 'calc(100vh - 280px)' },
            overflow: 'auto',
            boxShadow: `0 10px 30px ${alpha('#1b5e20', 0.05)}`,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Today’s agenda
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {todaysAgenda.length} visit{todaysAgenda.length === 1 ? '' : 's'} · Asia/Kolkata day
              </Typography>
            </Box>
            <Chip
              size="small"
              color={dashboardStats.awaitingPin > 0 ? 'error' : 'success'}
              label={dashboardStats.awaitingPin > 0 ? `${dashboardStats.awaitingPin} PIN` : 'On track'}
              sx={{ fontWeight: 800 }}
            />
          </Stack>

          {todaysAgenda.length === 0 ? (
            <Box
              sx={{
                py: 4,
                px: 2,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: alpha('#eceff1', 0.45),
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                No visits scheduled for today with the current filters.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.25}>
              {todaysAgenda.map((apt) => {
                const st = getApptStatus(apt);
                const awaiting = isAwaitingTelecallerPin(apt);
                const staff =
                  apt.type === 'home'
                    ? apt.homeVisitorName || 'Unassigned'
                    : apt.assignedStaffName || 'Unassigned';
                const accent = awaiting
                  ? '#c62828'
                  : st === 'completed'
                    ? '#2e7d32'
                    : apt.type === 'home'
                      ? '#43a047'
                      : '#1976d2';
                return (
                  <Box
                    key={apt.id}
                    onClick={() => void openPreviewForAppointment(apt)}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: alpha(accent, 0.28),
                      bgcolor: alpha(accent, 0.05),
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: `0 6px 16px ${alpha(accent, 0.18)}`,
                      },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, wordBreak: 'break-word' }}>
                          {apt.patientName || apt.title || 'Patient'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                          {new Date(apt.start).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' · '}
                          {apt.type === 'home' ? 'Home' : 'Center'}
                          {' · '}
                          {staff}
                        </Typography>
                        {apt.type === 'home' && apt.address ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              mt: 0.35,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {apt.address}
                          </Typography>
                        ) : null}
                      </Box>
                      <Chip
                        size="small"
                        label={awaiting ? 'PIN' : st === 'completed' ? 'Done' : 'Live'}
                        color={awaiting ? 'error' : st === 'completed' ? 'success' : 'primary'}
                        sx={{ fontWeight: 800, flexShrink: 0 }}
                      />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Full-screen month calendar for analysis */}
      <Dialog
        open={calendarFullscreen}
        onClose={() => setCalendarFullscreen(false)}
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: '#f7f9fc',
            backgroundImage: `linear-gradient(180deg, ${alpha('#e3f2fd', 0.5)} 0%, #f7f9fc 40%)`,
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: alpha('#fff', 0.92),
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0d47a1', lineHeight: 1.2 }}>
              Full month calendar
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              All appointments in view · click an event for details · Esc to exit
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Chip size="small" sx={{ bgcolor: alpha('#43a047', 0.15), color: '#1b5e20', fontWeight: 700 }} label="Home" />
            <Chip size="small" sx={{ bgcolor: alpha('#1976d2', 0.15), color: '#0d47a1', fontWeight: 700 }} label="Center" />
            <Chip size="small" sx={{ bgcolor: alpha('#d32f2f', 0.15), color: '#b71c1c', fontWeight: 700 }} label="Awaiting PIN" />
            <Chip size="small" sx={{ bgcolor: alpha('#9e9e9e', 0.2), color: '#424242', fontWeight: 700 }} label="Cancelled" />
            <Button
              variant="contained"
              startIcon={<FullscreenExitIcon />}
              onClick={() => setCalendarFullscreen(false)}
              sx={{ fontWeight: 700 }}
            >
              Exit full screen
            </Button>
          </Stack>
        </Box>

        <Box
          sx={{
            flex: 1,
            p: { xs: 1, sm: 2 },
            height: 'calc(100vh - 72px)',
            overflow: 'hidden',
            '& .fc': {
              height: '100% !important',
              fontSize: { xs: '0.72rem', sm: '0.82rem', md: '0.88rem' },
              '--fc-border-color': alpha('#90a4ae', 0.35),
              '--fc-page-bg-color': '#fff',
              '--fc-neutral-bg-color': alpha('#eceff1', 0.55),
              '--fc-today-bg-color': alpha('#fff8e1', 0.9),
              '--fc-button-bg-color': '#1565c0',
              '--fc-button-border-color': '#1565c0',
              '--fc-button-hover-bg-color': '#0d47a1',
              '--fc-button-hover-border-color': '#0d47a1',
              '--fc-button-active-bg-color': '#0d47a1',
              '--fc-button-active-border-color': '#0d47a1',
            },
            '& .fc-view-harness': {
              height: '100% !important',
            },
            '& .fc-toolbar': {
              flexWrap: 'wrap',
              gap: 1,
              mb: 1.25,
            },
            '& .fc-toolbar-title': {
              fontSize: { xs: '1.15rem', sm: '1.5rem', md: '1.75rem' },
              fontWeight: 800,
              color: '#0d47a1',
            },
            '& .fc-button': {
              borderRadius: '10px !important',
              textTransform: 'capitalize',
              fontWeight: 700,
              boxShadow: 'none',
            },
            '& .fc-col-header-cell': {
              bgcolor: alpha('#e3f2fd', 0.75),
              py: 1.25,
            },
            '& .fc-col-header-cell-cushion': {
              fontWeight: 800,
              color: '#37474f',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              letterSpacing: 0.45,
            },
            '& .fc-daygrid-day-frame': {
              minHeight: { xs: 110, sm: 130, md: 150 },
            },
            '& .fc-daygrid-day-number': {
              fontWeight: 800,
              color: '#455a64',
              fontSize: '0.85rem',
              padding: '6px 8px',
            },
            '& .fc-daygrid-day.fc-day-today .fc-daygrid-day-number': {
              bgcolor: '#ef6c00',
              color: '#fff',
              borderRadius: '999px',
              width: 30,
              height: 30,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              m: '4px',
            },
            '& .fc-event': {
              border: 'none',
              borderRadius: '6px',
              mb: '2px',
              boxShadow: `0 1px 2px ${alpha('#000', 0.1)}`,
              cursor: 'pointer',
            },
            '& .fc-event-main': {
              padding: '1px 4px',
            },
            '& .appt-cancelled .fc-event-title, & .appt-cancelled': {
              opacity: 0.75,
              textDecoration: 'line-through',
            },
            '& .appt-awaiting-pin': {
              boxShadow: `0 0 0 2px ${alpha('#b71c1c', 0.45)}`,
            },
            '& .fc-daygrid-more-link': {
              fontWeight: 800,
              color: '#1565c0',
            },
            '& .fc-daygrid-event-harness': {
              marginTop: '1px !important',
            },
          }}
        >
          {calendarFullscreen ? (
            <FullCalendar
              key={`fullscreen-${calendarRemountKey || 'calendar'}`}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listMonth',
              }}
              initialView="dayGridMonth"
              selectable
              selectMirror
              events={events}
              select={handleDateSelect}
              eventClick={handleEventClick}
              height="100%"
              expandRows
              dayMaxEventRows={false}
              dayMaxEvents={false}
              moreLinkClick="popover"
              nowIndicator
              eventContent={(arg) => {
                const p = arg.event.extendedProps as {
                  patient?: string;
                  timeLabel?: string;
                  staffLabel?: string;
                  type?: string;
                  awaitingPin?: boolean;
                  status?: string;
                };
                const patient = p.patient || arg.event.title;
                const isMonth = arg.view.type === 'dayGridMonth';
                return (
                  <Box sx={{ overflow: 'hidden', lineHeight: 1.15, px: 0.25, py: 0.1 }}>
                    <Typography
                      component="div"
                      sx={{
                        fontSize: isMonth ? '0.7rem' : '0.78rem',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.awaitingPin ? 'PIN · ' : p.status === 'completed' ? '✓ ' : ''}
                      {p.timeLabel ? `${p.timeLabel} ` : ''}
                      {patient}
                    </Typography>
                    <Typography
                      component="div"
                      sx={{
                        fontSize: '0.62rem',
                        opacity: 0.92,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: { xs: 'none', sm: 'block' },
                      }}
                    >
                      {p.type === 'home' ? 'Home' : 'Center'}
                      {p.staffLabel ? ` · ${p.staffLabel}` : ''}
                    </Typography>
                  </Box>
                );
              }}
              views={{
                dayGridMonth: {
                  dayMaxEventRows: false,
                  dayMaxEvents: false,
                },
                timeGridWeek: {
                  slotMinTime: '08:00:00',
                  slotMaxTime: '20:00:00',
                  slotDuration: '00:30:00',
                },
                listMonth: {
                  duration: { months: 1 },
                },
              }}
            />
          ) : null}
        </Box>
      </Dialog>

      {/* Appointment Preview Dialog - Mobile Responsive */}
      <Dialog 
        open={openPreview} 
        onClose={() => setOpenPreview(false)} 
        fullWidth 
        maxWidth="sm"
            fullScreen={isMobile}
        PaperProps={{
          sx: {
            m: { xs: 0, sm: 2 },
            maxHeight: { xs: '100%', sm: '92vh' },
            borderRadius: { xs: 0, sm: 3 },
            overflow: 'hidden',
          }
        }}
      >
        {previewAppt ? (
          <>
            <Box
              sx={{
                px: { xs: 2, sm: 2.5 },
                pt: { xs: 2, sm: 2.5 },
                pb: 2,
                background: isAwaitingTelecallerPin(previewAppt)
                  ? `linear-gradient(135deg, ${alpha('#c62828', 0.12)} 0%, ${alpha('#ff8a65', 0.08)} 55%, ${alpha('#fff', 0.9)} 100%)`
                  : previewAppt.type === 'home'
                    ? `linear-gradient(135deg, ${alpha('#2e7d32', 0.1)} 0%, ${alpha('#81c784', 0.08)} 50%, ${alpha('#fff', 0.95)} 100%)`
                    : `linear-gradient(135deg, ${alpha('#1565c0', 0.1)} 0%, ${alpha('#64b5f6', 0.08)} 50%, ${alpha('#fff', 0.95)} 100%)`,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                  <Avatar
                    sx={{
                      width: 52,
                      height: 52,
                      fontWeight: 800,
                      fontSize: '1.15rem',
                      bgcolor: isAwaitingTelecallerPin(previewAppt)
                        ? 'error.main'
                        : previewAppt.type === 'home'
                          ? 'success.main'
                          : 'primary.main',
                    }}
                  >
                    {(previewAppt.patientName || previewAppt.title || 'P').trim().charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
                      Appointment details
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 800,
                        lineHeight: 1.25,
                        fontSize: { xs: '1.1rem', sm: '1.35rem' },
                        wordBreak: 'break-word',
                      }}
                    >
                      {previewAppt.patientName || previewAppt.title || 'Patient'}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.75 }}>
                      <Chip
                        size="small"
                        icon={previewAppt.type === 'home' ? <HomeWorkIcon /> : <BusinessIcon />}
                        label={previewAppt.type === 'center' ? 'Center visit' : 'Home visit'}
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                      <Chip
                        size="small"
                        label={
                          getApptStatus(previewAppt) === 'cancelled'
                            ? 'Cancelled'
                            : getApptStatus(previewAppt) === 'completed'
                              ? 'Completed'
                              : 'Scheduled'
                        }
                        color={
                          getApptStatus(previewAppt) === 'cancelled'
                            ? 'default'
                            : getApptStatus(previewAppt) === 'completed'
                              ? 'success'
                              : 'primary'
                        }
                        sx={{ fontWeight: 700 }}
                      />
                      {isAwaitingTelecallerPin(previewAppt) ? (
                        <Chip
                          size="small"
                          color="error"
                          icon={<VpnKeyIcon />}
                          label="Awaiting PIN"
                          sx={{ fontWeight: 800 }}
                        />
                      ) : null}
                      {previewAppt.reference ? (
                        <Chip
                          size="small"
                          label={`Ref ${previewAppt.reference}`}
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      ) : null}
                    </Stack>
                  </Box>
                </Stack>
                <IconButton
                  aria-label="Close"
                  onClick={() => setOpenPreview(false)}
                  size="small"
                  sx={{ bgcolor: alpha('#000', 0.04), '&:hover': { bgcolor: alpha('#000', 0.08) } }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Box>

            <DialogContent sx={{ p: { xs: 2, sm: 2.5 }, bgcolor: alpha('#f5f7fa', 0.65) }}>
              <Stack spacing={2}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.75 }}>
                    Visit information
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    }}
                  >
                    <PreviewDetailRow
                      icon={<EventIcon fontSize="small" />}
                      label="Date"
                      accent="#1565c0"
                      value={new Date(previewAppt.start).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    />
                    <PreviewDetailRow
                      icon={<AccessTimeIcon fontSize="small" />}
                      label="Time"
                      accent="#455a64"
                      value={
                        <>
                          {new Date(previewAppt.start).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {previewAppt.end
                            ? ` – ${new Date(previewAppt.end).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : ''}
                        </>
                      }
                    />
                    {previewAppt.type === 'center' ? (
                      <>
                        <PreviewDetailRow
                          icon={<BusinessIcon fontSize="small" />}
                          label="Center"
                          accent="#0277bd"
                          value={previewCenterName || '—'}
                        />
                        <PreviewDetailRow
                          icon={<PersonIcon fontSize="small" />}
                          label="Assigned to"
                          accent="#00897b"
                          value={previewAssignedStaffName || '—'}
                        />
                      </>
                    ) : (
                      <>
                        <PreviewDetailRow
                          icon={<BusinessIcon fontSize="small" />}
                          label="Center"
                          accent="#0277bd"
                          value={previewCenterName || previewAppt.centerName || '—'}
                        />
                        <PreviewDetailRow
                          icon={<PersonIcon fontSize="small" />}
                          label="Home visit by"
                          accent="#2e7d32"
                          value={previewHomeVisitorName || '—'}
                        />
                        <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                          <PreviewDetailRow
                            icon={<PlaceIcon fontSize="small" />}
                            label="Home address"
                            accent="#ef6c00"
                            value={previewAppt.address || '—'}
                          />
                        </Box>
                      </>
                    )}
                    {(previewPatientPhone || previewAppt.patientPhone) ? (
                      <PreviewDetailRow
                        icon={<PhoneIcon fontSize="small" />}
                        label="Patient phone"
                        accent="#00897b"
                        value={
                          <Box
                            component="a"
                            href={`tel:${String(previewPatientPhone || previewAppt.patientPhone || '').replace(/\D/g, '')}`}
                            sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
                          >
                            {previewPatientPhone || previewAppt.patientPhone}
                          </Box>
                        }
                      />
                    ) : null}
                    {previewAppt.telecaller ? (
                      <PreviewDetailRow
                        icon={<SupportAgentIcon fontSize="small" />}
                        label="Telecaller"
                        accent="#c62828"
                        value={previewAppt.telecaller}
                      />
                    ) : null}
                  </Box>
                </Paper>

                {previewAppt.notes ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <NotesIcon fontSize="small" color="action" />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Notes
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'text.secondary',
                        lineHeight: 1.6,
                      }}
                    >
                      {previewAppt.notes}
                    </Typography>
                  </Paper>
                ) : null}

                {canShowTelecallerPinActions(previewAppt) ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      border: '1.5px solid',
                      borderColor: 'error.light',
                      bgcolor: alpha('#d32f2f', 0.04),
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: 'error.main',
                          color: 'common.white',
                          flexShrink: 0,
                        }}
                      >
                        <VpnKeyIcon fontSize="small" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'error.dark', lineHeight: 1.3 }}>
                          End-of-visit verification
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Review everything the field staff entered with the patient, log the call, then
                          generate the PIN only after confirmation.
                        </Typography>
                      </Box>
                    </Stack>

                    <Box
                      sx={{
                        mb: 1.75,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <CheckoutDraftSummary draft={(previewAppt as { checkoutDraft?: unknown }).checkoutDraft as any} />
                    </Box>

                    {previewAppt.complianceStatus ? (
                      <Chip
                        size="small"
                        sx={{ mb: 1.5, fontWeight: 700 }}
                        color={
                          previewAppt.complianceStatus === 'completed'
                            ? 'success'
                            : previewAppt.complianceStatus === 'awaiting_telecaller_pin'
                              ? 'error'
                              : previewAppt.complianceStatus === 'incomplete_compliance'
                                ? 'warning'
                                : 'info'
                        }
                        label={`Compliance: ${String(previewAppt.complianceStatus).replace(/_/g, ' ')}`}
                      />
                    ) : null}

                    {!isComplianceFullyComplete(previewAppt) && !patientCallLoggedForPin ? (
                      <Box
                        sx={{
                          mb: 1.5,
                          p: 1.75,
                          borderRadius: 2,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: alpha('#ed6c02', 0.35),
                        }}
                      >
                        <Alert severity="warning" sx={{ mb: 1.5 }}>
                          {PIN_REQUIRES_CALL_LOG_MESSAGE.replace(
                            ' in Telecalling Records',
                            ' below'
                          )}
                        </Alert>
                        {!previewEnquiryId ? (
                          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                            This appointment has no linked enquiry, so a call cannot be logged here.
                          </Typography>
                        ) : (
                          <Stack spacing={1.5}>
                            {(previewPatientPhone || previewAppt.patientPhone) ? (
                              <Button
                                variant="outlined"
                                color="success"
                                startIcon={<PhoneInTalkIcon />}
                                href={`tel:${String(previewPatientPhone || previewAppt.patientPhone || '').replace(/\D/g, '')}`}
                                fullWidth={isMobile}
                              >
                                Call patient
                                {previewPatientPhone || previewAppt.patientPhone
                                  ? ` · ${previewPatientPhone || previewAppt.patientPhone}`
                                  : ''}
                              </Button>
                            ) : (
                              <Alert severity="info">No phone number on this enquiry.</Alert>
                            )}
                            <TextField
                              label="Call remarks (customer feedback)"
                              value={pinCallRemarks}
                              onChange={(e) => setPinCallRemarks(e.target.value)}
                              fullWidth
                              multiline
                              minRows={3}
                              size="small"
                              required
                              disabled={pinCallSaving || pinBusy}
                              placeholder="Write what the customer said about the visit…"
                              helperText="Required — enter the customer’s actual feedback (no presets)."
                            />
                            {pinTelecallerOptions.length > 0 ? (
                              <FormControl fullWidth size="small">
                                <InputLabel id="pin-call-caller-label">Call done by</InputLabel>
                                <Select
                                  labelId="pin-call-caller-label"
                                  label="Call done by"
                                  value={
                                    pinTelecallerOptions.includes(pinCallCallerName)
                                      ? pinCallCallerName
                                      : ''
                                  }
                                  onChange={(e) => setPinCallCallerName(String(e.target.value))}
                                  disabled={pinCallSaving || pinBusy}
                                >
                                  {pinTelecallerOptions.map((name) => (
                                    <MenuItem key={name} value={name}>
                                      {name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            ) : (
                              <TextField
                                label="Call done by"
                                value={pinCallCallerName}
                                onChange={(e) => setPinCallCallerName(e.target.value)}
                                fullWidth
                                size="small"
                                disabled={pinCallSaving || pinBusy}
                              />
                            )}
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Button
                                variant="contained"
                                color="primary"
                                startIcon={<CallIcon />}
                                onClick={() => void handleLogCallForPin(true)}
                                disabled={
                                  pinCallSaving ||
                                  pinBusy ||
                                  !pinCallCallerName.trim() ||
                                  !pinCallRemarks.trim() ||
                                  !previewEnquiryId
                                }
                                fullWidth={isMobile}
                              >
                                {pinCallSaving && pinCallAndGenerate
                                  ? 'Logging call…'
                                  : pinBusy
                                    ? 'Generating PIN…'
                                    : 'Log call & generate PIN'}
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={() => void handleLogCallForPin(false)}
                                disabled={
                                  pinCallSaving ||
                                  pinBusy ||
                                  !pinCallCallerName.trim() ||
                                  !pinCallRemarks.trim() ||
                                  !previewEnquiryId
                                }
                                fullWidth={isMobile}
                              >
                                {pinCallSaving && !pinCallAndGenerate ? 'Saving…' : 'Log call only'}
                              </Button>
                            </Stack>
                          </Stack>
                        )}
                      </Box>
                    ) : null}

                    {patientCallLoggedForPin && !isComplianceFullyComplete(previewAppt) ? (
                      <Alert severity="success" sx={{ mb: 1.5 }}>
                        Patient call logged for this visit — PIN can be generated.
                      </Alert>
                    ) : null}

                    {previewAppt.telecaller_verified ? (
                      <Alert severity="success" sx={{ mb: 1.5 }}>
                        Telecaller PIN verified by field staff
                      </Alert>
                    ) : null}

                    {previewAppt.complianceAdminOverride ? (
                      <Alert severity="warning" icon={<AdminPanelSettingsIcon />} sx={{ mb: 1.5 }}>
                        Admin override active
                        {previewAppt.complianceAdminOverride.byName
                          ? ` · ${previewAppt.complianceAdminOverride.byName}`
                          : ''}
                        {previewAppt.complianceAdminOverride.reason
                          ? ` — ${previewAppt.complianceAdminOverride.reason}`
                          : ''}
                      </Alert>
                    ) : null}

                    {generatedPin && !previewAppt.telecaller_verified ? (
                      <Box
                        sx={{
                          mb: 1.5,
                          py: 2,
                          px: 2,
                          borderRadius: 2,
                          bgcolor: 'background.paper',
                          border: '1px dashed',
                          borderColor: 'primary.main',
                          textAlign: 'center',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 700 }}>
                          Verification PIN — read to field agent
                        </Typography>
                        <Typography
                          variant="h3"
                          sx={{ fontWeight: 800, letterSpacing: '0.35em', fontFamily: 'monospace', mt: 0.5 }}
                        >
                          {generatedPin}
                        </Typography>
                      </Box>
                    ) : null}

                    {pinError ? (
                      <Alert severity="error" sx={{ mb: 1.5 }}>
                        {pinError}
                      </Alert>
                    ) : null}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      {!isComplianceFullyComplete(previewAppt) ? (
                        <Button
                          variant="contained"
                          startIcon={<VpnKeyIcon />}
                          onClick={() => void handleGenerateCompliancePin()}
                          disabled={pinBusy || overrideBusy || !patientCallLoggedForPin}
                          fullWidth={isMobile}
                        >
                          {pinBusy
                            ? 'Generating…'
                            : !patientCallLoggedForPin
                              ? 'Log patient call to unlock PIN'
                              : generatedPin
                                ? 'Regenerate Verification PIN'
                                : 'Generate Verification PIN'}
                        </Button>
                      ) : null}
                      {isAdmin && appointmentBlocksPipeline(previewAppt) ? (
                        <Button
                          variant="outlined"
                          color="warning"
                          startIcon={<AdminPanelSettingsIcon />}
                          onClick={() => void handleComplianceAdminOverride()}
                          disabled={overrideBusy || pinBusy}
                          fullWidth={isMobile}
                        >
                          {overrideBusy ? 'Saving…' : 'Admin override'}
                        </Button>
                      ) : null}
                    </Stack>
                  </Paper>
                ) : null}
              </Stack>
            </DialogContent>

            <DialogActions
              sx={{
                p: { xs: 1.5, sm: 2 },
                gap: 1,
                flexDirection: { xs: 'column-reverse', sm: 'row' },
                flexWrap: 'wrap',
                justifyContent: { sm: 'space-between' },
                alignItems: { sm: 'center' },
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Button onClick={() => setOpenPreview(false)} variant="text" color="inherit" fullWidth={isMobile}>
                Close
              </Button>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ width: { xs: '100%', sm: 'auto' }, flexWrap: 'wrap' }}
              >
                {canEdit && previewAppt && (
                  <Button
                    onClick={handleScheduleAnotherVisit}
                    variant="outlined"
                    color="secondary"
                    startIcon={<PostAddIcon />}
                    fullWidth={isMobile}
                  >
                    Another visit
                  </Button>
                )}
                {canEdit && previewAppt && getApptStatus(previewAppt) === 'scheduled' && (
                  <>
                    <Button
                      onClick={openRescheduleSameDayDialog}
                      variant="outlined"
                      startIcon={<EventRepeatIcon />}
                      fullWidth={isMobile}
                    >
                      Reschedule
                    </Button>
                    <Button
                      onClick={() => void handleCancelAppointment()}
                      variant="outlined"
                      color="warning"
                      startIcon={<CancelOutlinedIcon />}
                      fullWidth={isMobile}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void handleMarkAppointmentCompleted()}
                      variant="contained"
                      color="success"
                      startIcon={<CheckCircleOutlineIcon />}
                      fullWidth={isMobile}
                    >
                      Complete
                    </Button>
                  </>
                )}
                {canEdit && (
                  <Button
                    onClick={handleEdit}
                    variant="contained"
                    startIcon={<EditIcon />}
                    fullWidth={isMobile}
                    sx={{
                      bgcolor: '#ff6b35',
                      '&:hover': { bgcolor: '#ff5722' },
                    }}
                  >
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button
                    onClick={handleDelete}
                    variant="contained"
                    color="error"
                    startIcon={<DeleteIcon />}
                    fullWidth={isMobile}
                  >
                    Delete
                  </Button>
                )}
              </Stack>
            </DialogActions>
          </>
        ) : (
          <>
            <DialogTitle>Appointment details</DialogTitle>
            <DialogContent>
              <Typography>Loading…</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenPreview(false)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Dialog
        open={rescheduleDialogOpen}
        onClose={() => !rescheduleSaving && setRescheduleDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        fullScreen={isMobile}
      >
        <DialogTitle>Reschedule on same day</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick a new time on{' '}
            <strong>
              {previewAppt
                ? new Date(previewAppt.start).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : ''}
            </strong>
            . Duration stays the same.
          </Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            {previewAppt && rescheduleAt && (
              <DateTimePicker
                label="New date & time"
                value={rescheduleAt}
                onChange={(v) => v && setRescheduleAt(v)}
                minDateTime={startOfDay(new Date(previewAppt.start))}
                maxDateTime={endOfDay(new Date(previewAppt.start))}
                slotProps={{
                  textField: { fullWidth: true, size: 'small' },
                }}
              />
            )}
          </LocalizationProvider>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setRescheduleDialogOpen(false)} disabled={rescheduleSaving}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmRescheduleSameDay()}
            disabled={rescheduleSaving || !rescheduleAt}
          >
            {rescheduleSaving ? 'Saving…' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Patient picker dialog - Mobile Responsive */}
      <Dialog 
        open={openPatientPicker} 
        onClose={() => setOpenPatientPicker(false)} 
        fullWidth 
        maxWidth="md"
            fullScreen={isMobile}
        PaperProps={{
          sx: {
            m: { xs: 0, sm: 2 },
            maxHeight: { xs: '100%', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
          Select Patient from Enquiries
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 1, sm: 2 } }}>
          <Box sx={{ mb: 2 }}>
            <TextField 
              fullWidth 
              label="Search name / phone / city / email" 
              value={enquirySearch} 
              onChange={e => setEnquirySearch(e.target.value)}
              size="small"
            />
          </Box>
          <TableContainer 
            component={Paper} 
            variant="outlined"
            sx={{ 
              maxHeight: { xs: '60vh', sm: '50vh' },
              overflow: 'auto'
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, fontWeight: 'bold' }}>
                    Name
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, fontWeight: 'bold', display: { xs: 'none', sm: 'table-cell' } }}>
                    Phone
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, fontWeight: 'bold', display: { xs: 'none', md: 'table-cell' } }}>
                    Email
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, fontWeight: 'bold', display: { xs: 'none', lg: 'table-cell' } }}>
                    City
                  </TableCell>
                  <TableCell sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, fontWeight: 'bold', display: { xs: 'none', sm: 'table-cell' } }}>
                    Status
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' }, fontWeight: 'bold' }}>
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEnquiries.map((e: any) => (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                      {e.name}
                      {isMobile && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {e.phone || '-'}
                          </Typography>
                          {e.status && (
                            <Chip 
                              label={e.status} 
                              size="small" 
                              sx={{ mt: 0.5, height: 20, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>
                      {e.phone || '-'}
                    </TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, display: { xs: 'none', md: 'table-cell' } }}>
                      {e.email || '-'}
                    </TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, display: { xs: 'none', lg: 'table-cell' } }}>
                      {e.city || '-'}
                    </TableCell>
                    <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, display: { xs: 'none', sm: 'table-cell' } }}>
                      {e.status || '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Button 
                        size="small" 
                        variant="contained" 
                        onClick={() => {
                          setNewAppt({ 
                            ...newAppt, 
                            enquiryId: e.id, 
                            patientName: e.name,
                            patientPhone: e.phone || '',
                            reference: e.reference || '',
                            address: e.address || '',
                            centerId: e.center || newAppt.centerId,
                            telecaller: e.telecaller || '',
                            status: 'scheduled'
                          });
                          setOpenPatientPicker(false);
                        }}
                        sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEnquiries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      {enquiriesLoading ? 'Loading enquiries...' : 'No enquiries found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={() => setOpenPatientPicker(false)}
            variant="outlined"
            fullWidth={isMobile}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* New/Edit Appointment Dialog - Mobile Responsive */}
      <Dialog 
        open={openDialog} 
        onClose={() => {
          setOpenDialog(false);
          setIsEditMode(false);
          setEditingAppointmentId(null);
          setNewAppt(defaultNewAppointment);
        }} 
        fullWidth 
        maxWidth="md"
            fullScreen={isMobile}
        PaperProps={{
          sx: {
            m: { xs: 0, sm: 2 },
            maxHeight: { xs: '100%', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          fontSize: { xs: '1.1rem', sm: '1.25rem' },
          p: { xs: 2, sm: 3 }
        }}>
          {isEditMode ? <EditIcon color="primary" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} /> : <EventAvailableIcon color="primary" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} />}
          {isEditMode ? 'Edit Appointment' : 'New Appointment'}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 }, px: { xs: 2, sm: 3 } }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, bgcolor: 'background.default' }}>
          <Grid container spacing={{ xs: 2, sm: 3 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Patient & Visit
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Patient Name"
                value={newAppt.patientName}
                placeholder="Select from enquiries"
                onClick={() => setOpenPatientPicker(true)}
                margin="normal"
                size={isMobile ? 'small' : 'medium'}
                InputLabelProps={{ sx: { mt: 0.2 } }}
                InputProps={{ 
                  readOnly: true, 
                  startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> 
                }}
                required
              />
            </Grid>
            {newAppt.patientPhone && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Patient Phone"
                  value={newAppt.patientPhone}
                  margin="normal"
                  size={isMobile ? 'small' : 'medium'}
                  InputLabelProps={{ sx: { mt: 0.2 } }}
                  InputProps={{ 
                    readOnly: true, 
                    startAdornment: <InputAdornment position="start"><PhoneIcon fontSize="small" /></InputAdornment> 
                  }}
                  sx={{ bgcolor: '#f5f5f5' }}
                />
              </Grid>
            )}
            {newAppt.reference && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Reference"
                  value={newAppt.reference}
                  margin="normal"
                  size={isMobile ? 'small' : 'medium'}
                  InputLabelProps={{ sx: { mt: 0.2 } }}
                  InputProps={{ 
                    readOnly: true
                  }}
                  sx={{ bgcolor: '#f5f5f5' }}
                />
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ 
                    minWidth: 120, 
                    display: 'inline-block',
                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                  }}
                >
                  Visit Type
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  color="primary"
                  size={isMobile ? 'small' : 'medium'}
                  value={newAppt.type}
                  onChange={(_, val) => {
                    if (!val) return;
                    setNewAppt({ ...newAppt, type: val as AppointmentType });
                  }}
                  sx={{ 
                    mt: 0.5, 
                    border: theme => `1px solid ${theme.palette.divider}`, 
                    borderRadius: 2,
                    '& .MuiToggleButton-root': {
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      px: { xs: 1, sm: 2 }
                    }
                  }}
                >
                  <ToggleButton value="center">
                    <PlaceIcon sx={{ mr: 0.5, fontSize: { xs: '0.875rem', sm: '1rem' } }} /> 
                    Center
                  </ToggleButton>
                  <ToggleButton value="home">
                    <HomeWorkIcon sx={{ mr: 0.5, fontSize: { xs: '0.875rem', sm: '1rem' } }} /> 
                    Home
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Grid>
            {newAppt.type === 'center' ? (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    label="Center"
                    value={newAppt.centerId}
                    onChange={e => setNewAppt({ ...newAppt, centerId: e.target.value })}
                    margin="normal"
                    size={isMobile ? 'small' : 'medium'}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon fontSize="small" /></InputAdornment> }}
                  >
                    {centers.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={staffList}
                    getOptionLabel={(o: any) => o.name || ''}
                    value={staffList.find(s => s.id === newAppt.assignedStaffId) || null}
                    onChange={(_, val: any) => {
                      setNewAppt({
                        ...newAppt,
                        assignedStaffId: val?.id || '',
                        assignedStaffName: val?.name || '',
                      });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Assign to (Staff)"
                        fullWidth
                        margin="normal"
                        size={isMobile ? 'small' : 'medium'}
                        required
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <PersonIcon fontSize="small" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    fullWidth
                    required
                    label="Center"
                    helperText="Which center this home visit is under"
                    value={newAppt.centerId}
                    onChange={(e) => setNewAppt({ ...newAppt, centerId: e.target.value })}
                    margin="normal"
                    size={isMobile ? 'small' : 'medium'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PlaceIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  >
                    {centers.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Home Address"
                    value={newAppt.address}
                    onChange={e => setNewAppt({ ...newAppt, address: e.target.value })}
                    margin="normal"
                    size={isMobile ? 'small' : 'medium'}
                    InputProps={{ startAdornment: <InputAdornment position="start"><HomeWorkIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    options={staffList}
                    getOptionLabel={(o: any) => o.name || ''}
                    value={staffList.find(s => s.id === newAppt.homeVisitorStaffId) || null}
                    onChange={(_, val: any) => {
                      setNewAppt({
                        ...newAppt,
                        homeVisitorStaffId: val?.id || '',
                        homeVisitorName: val?.name || '',
                      });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Home Visit By (Staff)"
                        fullWidth
                        margin="normal"
                        size={isMobile ? 'small' : 'medium'}
                        required
                        sx={{ 
                          minWidth: { xs: '100%', sm: '250px' },
                          '& .MuiOutlinedInput-root': {
                            minWidth: { xs: '100%', sm: '250px' }
                          }
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <InputAdornment position="start">
                                <PersonIcon fontSize="small" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Schedule
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DateTimePicker
                label="Appointment Date & Time"
                value={new Date(newAppt.start)}
                onChange={(val) => {
                  if (!val) return;
                  const startIso = new Date(val).toISOString();
                  const endIso = new Date(new Date(val).getTime() + 60 * 60 * 1000).toISOString();
                  setNewAppt({ ...newAppt, start: startIso, end: endIso });
                }}
                slotProps={{ 
                  textField: { 
                    fullWidth: true, 
                    margin: 'normal',
                    size: isMobile ? 'small' : 'medium'
                  } 
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                Default duration set to 1 hour
              </Typography>
            </Grid>
            {isEditMode && (
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Visit status"
                  value={newAppt.status || 'scheduled'}
                  onChange={(e) =>
                    setNewAppt({ ...newAppt, status: e.target.value as AppointmentStatus })
                  }
                  margin="normal"
                  size={isMobile ? 'small' : 'medium'}
                >
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </TextField>
              </Grid>
            )}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Notes
              </Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={isMobile ? 2 : 3}
                label="Notes"
                value={newAppt.notes}
                onChange={e => setNewAppt({ ...newAppt, notes: e.target.value })}
                placeholder="Add any special instructions..."
                margin="normal"
                size={isMobile ? 'small' : 'medium'}
              />
            </Grid>
          </Grid>
          </Paper>
          </LocalizationProvider>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
