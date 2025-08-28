'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Box, Paper, Stack, Typography, Button, Chip, IconButton, Tooltip, Divider, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Grid, MenuItem, Autocomplete, ToggleButtonGroup, ToggleButton, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, InputAdornment } from '@mui/material';
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
import { db } from '@/firebase/config';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';

type AppointmentType = 'center' | 'home';

interface Appointment {
  id?: string;
  title: string;
  enquiryId?: string;
  patientName?: string;
  type: AppointmentType; // center or home
  centerId?: string; // for center visit
  address?: string; // for home visit
  homeVisitorStaffId?: string; // staff assigned for home visit
  homeVisitorName?: string;
  notes?: string;
  start: string; // ISO
  end: string; // ISO
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [previewAppt, setPreviewAppt] = useState<Appointment | null>(null);
  const [previewPatientPhone, setPreviewPatientPhone] = useState<string>('');
  const [previewCenterName, setPreviewCenterName] = useState<string>('');
  const [previewHomeVisitorName, setPreviewHomeVisitorName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [newAppt, setNewAppt] = useState<Appointment>(defaultNewAppointment);
  const [centers, setCenters] = useState<any[]>([]);
  const [openPatientPicker, setOpenPatientPicker] = useState(false);
  const [allEnquiries, setAllEnquiries] = useState<any[]>([]);
  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquiriesLoading, setEnquiriesLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
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
    fetchAll();
  }, []);

  // Load all enquiries when patient picker opens and filter locally
  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, 'enquiries'), orderBy('name')));
      setAllEnquiries(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    };
    if (openPatientPicker && allEnquiries.length === 0) load();
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

  const events = useMemo(() => appointments.map(a => ({
    id: a.id,
    title: a.patientName || a.title || 'Patient',
    start: a.start,
    end: a.end,
    extendedProps: a,
    backgroundColor: a.type === 'center' ? '#1976d2' : '#43a047',
    borderColor: a.type === 'center' ? '#1565c0' : '#2e7d32',
  })), [appointments]);

  const handleDateSelect = (info: any) => {
    setNewAppt({
      ...defaultNewAppointment,
      start: info.startStr,
      end: info.endStr,
    });
    setOpenDialog(true);
  };

  const handleEventClick = async (clickInfo: any) => {
    const data = clickInfo.event.extendedProps as Appointment;
    setPreviewAppt(data);
    // Fetch additional preview fields
    let phone = '';
    let centerName = '';
    let homeVisitorName = data.homeVisitorName || '';
    try {
      if (data.enquiryId) {
        const enq = await getDoc(doc(db, 'enquiries', data.enquiryId));
        phone = (enq.data() as any)?.phone || '';
      }
      if (data.centerId) {
        const cen = await getDoc(doc(db, 'centers', data.centerId));
        centerName = (cen.data() as any)?.name || '';
      }
      if (!homeVisitorName && data.homeVisitorStaffId) {
        const st = await getDoc(doc(db, 'staff', data.homeVisitorStaffId));
        homeVisitorName = (st.data() as any)?.name || '';
      }
    } catch {}
    setPreviewPatientPhone(phone);
    setPreviewCenterName(centerName);
    setPreviewHomeVisitorName(homeVisitorName);
    setOpenPreview(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Minimal validation
      if (!newAppt.patientName) throw new Error('Select a patient');
      if (newAppt.type === 'center' && !newAppt.centerId) throw new Error('Select a center');
      if (newAppt.type === 'home' && !newAppt.homeVisitorStaffId) throw new Error('Select staff for home visit');
      if (newAppt.id) {
        // For simplicity, recreate document with same id logic can be added later
        await addDoc(collection(db, 'appointments'), {
          ...newAppt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'appointments'), {
          ...newAppt,
          title: newAppt.patientName || newAppt.title || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      const q = query(collection(db, 'appointments'), orderBy('start', 'asc'));
      const snap = await getDocs(q);
      setAppointments(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Appointment[]);
      setOpenDialog(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Appointment Scheduler</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setNewAppt(defaultNewAppointment); setOpenDialog(true); }}>
          New Appointment
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
          initialView="dayGridMonth"
          selectable
          selectMirror
          dayMaxEvents
          events={events}
          select={handleDateSelect}
          eventClick={handleEventClick}
          height="calc(100vh - 220px)"
        />
      </Paper>

      {/* Appointment Preview Dialog */}
      <Dialog open={openPreview} onClose={() => setOpenPreview(false)} fullWidth maxWidth="sm">
        <DialogTitle>Appointment Preview</DialogTitle>
        <DialogContent>
          {previewAppt ? (
            <Box sx={{ p: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Patient</Typography>
              <Typography variant="h6" sx={{ mb: 1 }}>{previewAppt.patientName || '-'}</Typography>
              <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
                Mobile: {previewPatientPhone || '—'}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary">Type</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{previewAppt.type === 'center' ? 'Center Visit' : 'Home Visit'}</Typography>
              {previewAppt.type === 'center' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary">Center</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{previewCenterName || '—'}</Typography>
                </>
              )}
              <Typography variant="subtitle2" color="text.secondary">Date & Time</Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{new Date(previewAppt.start).toLocaleString()}</Typography>
              {previewAppt.type === 'center' ? null : (
                <>
                  <Typography variant="subtitle2" color="text.secondary">Home Address</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{previewAppt.address || '—'}</Typography>
                  <Typography variant="subtitle2" color="text.secondary">Home Visit By</Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{previewHomeVisitorName || '—'}</Typography>
                </>
              )}
              {previewAppt.notes && (
                <>
                  <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{previewAppt.notes}</Typography>
                </>
              )}
            </Box>
          ) : (
            <Typography>Loading...</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Patient picker dialog */}
      <Dialog open={openPatientPicker} onClose={() => setOpenPatientPicker(false)} fullWidth maxWidth="md">
        <DialogTitle>Select Patient from Enquiries</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
            <TextField fullWidth label="Search name / phone / city / email" value={enquirySearch} onChange={e => setEnquirySearch(e.target.value)} />
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEnquiries.map((e: any) => (
                  <TableRow key={e.id} hover>
                    <TableCell>{e.name}</TableCell>
                    <TableCell>{e.phone || '-'}</TableCell>
                    <TableCell>{e.email || '-'}</TableCell>
                    <TableCell>{e.city || '-'}</TableCell>
                    <TableCell>{e.status || '-'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" onClick={() => {
                        setNewAppt({ ...newAppt, enquiryId: e.id, patientName: e.name });
                        setOpenPatientPicker(false);
                      }}>Select</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEnquiries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">{enquiriesLoading ? 'Loading enquiries...' : 'No enquiries found'}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPatientPicker(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EventAvailableIcon color="primary" /> {newAppt.id ? 'Edit Appointment' : 'New Appointment'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 2 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: 'background.default' }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Patient & Visit</Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>
            {/* Removed Title field; patient name will be used as title */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Patient"
                value={newAppt.patientName}
                placeholder="Select from enquiries"
                onClick={() => setOpenPatientPicker(true)}
                margin="normal"
                InputLabelProps={{ sx: { mt: 0.2 } }}
                InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120, display: 'inline-block' }}>Visit Type</Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  color="primary"
                  size="medium"
                  value={newAppt.type}
                  onChange={(_, val) => {
                    if (!val) return;
                    setNewAppt({ ...newAppt, type: val as AppointmentType });
                  }}
                  sx={{ mt: 0.5, border: theme => `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
                >
                  <ToggleButton value="center"><PlaceIcon sx={{ mr: 0.5 }} fontSize="small" /> Center</ToggleButton>
                  <ToggleButton value="home"><HomeWorkIcon sx={{ mr: 0.5 }} fontSize="small" /> Home</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Grid>
            {newAppt.type === 'center' ? (
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Center"
                  value={newAppt.centerId}
                  onChange={e => setNewAppt({ ...newAppt, centerId: e.target.value })}
                  margin="normal"
                  InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon fontSize="small" /></InputAdornment> }}
                >
                  {centers.map(c => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            ) : (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Home Address"
                    value={newAppt.address}
                    onChange={e => setNewAppt({ ...newAppt, address: e.target.value })}
                    margin="normal"
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
                      />
                    )}
                  />
                </Grid>
              </>
            )}
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, minWidth: 120 }}>Schedule</Typography>
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
                slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
              />
              <Typography variant="caption" color="text.secondary">Default duration set to 1 hour</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>Notes</Typography>
              <Divider sx={{ mt: 1, mb: 2 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Notes"
                value={newAppt.notes}
                onChange={e => setNewAppt({ ...newAppt, notes: e.target.value })}
                placeholder="Add any special instructions..."
                margin="normal"
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


