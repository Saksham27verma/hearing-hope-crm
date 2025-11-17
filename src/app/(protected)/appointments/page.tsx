'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
import { db } from '@/firebase/config';
import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, doc, getDoc, where } from 'firebase/firestore';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type AppointmentType = 'center' | 'home';

interface Appointment {
  id?: string;
  title: string;
  enquiryId?: string;
  patientName?: string;
  type: AppointmentType;
  centerId?: string;
  address?: string;
  homeVisitorStaffId?: string;
  homeVisitorName?: string;
  notes?: string;
  start: string;
  end: string;
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
  
  // Filters
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [selectedExecutive, setSelectedExecutive] = useState<string>('all');
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

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

  // Filter appointments based on selected filters
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];
    
    // Filter by center
    if (selectedCenter !== 'all') {
      filtered = filtered.filter(apt => apt.centerId === selectedCenter);
    }
    
    // Filter by executive (staff)
    if (selectedExecutive !== 'all') {
      filtered = filtered.filter(apt => apt.homeVisitorStaffId === selectedExecutive);
    }
    
    return filtered;
  }, [appointments, selectedCenter, selectedExecutive]);

  // Get upcoming appointments (future appointments)
  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return filteredAppointments
      .filter(apt => new Date(apt.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [filteredAppointments]);

  const events = useMemo(() => filteredAppointments.map(a => ({
    id: a.id,
    title: a.patientName || a.title || 'Patient',
    start: a.start,
    end: a.end,
    extendedProps: a,
    backgroundColor: a.type === 'center' ? '#1976d2' : '#43a047',
    borderColor: a.type === 'center' ? '#1565c0' : '#2e7d32',
  })), [filteredAppointments]);

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
      if (!newAppt.patientName) throw new Error('Select a patient');
      if (newAppt.type === 'center' && !newAppt.centerId) throw new Error('Select a center');
      if (newAppt.type === 'home' && !newAppt.homeVisitorStaffId) throw new Error('Select staff for home visit');
      if (newAppt.id) {
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
                    ${apt.type === 'center' && center ? `<p style="margin: 5px 0; color: #555; font-size: 14px;"><strong>Center:</strong> ${center.name}</p>` : ''}
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
          <p style="margin: 0;">Hope Hearing CRM - Appointment Schedule</p>
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
          
          if (apt.type === 'center' && center) {
            pdf.text(`Center: ${center.name}`, margin + 5, yPos);
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
        pdf.text('Hope Hearing CRM - Appointment Schedule', pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      pdf.save(`appointments-${now.toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting as PDF:', error);
      alert('Failed to export as PDF. Please try again.');
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      {/* Header - Responsive */}
      <Box sx={{ mb: 2 }}>
        <Typography 
          variant="h5" 
          fontWeight="bold" 
          color="primary"
          sx={{ mb: { xs: 2, sm: 0 }, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
        >
          Appointment Scheduler
        </Typography>
        
        {/* Filters and Actions - Stack on mobile */}
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={{ xs: 1.5, sm: 2 }} 
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ mt: { xs: 1, sm: 0 } }}
        >
          {/* Filters - Full width on mobile */}
          <FormControl 
            size="small" 
            sx={{ 
              minWidth: { xs: '100%', sm: 180 },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            <InputLabel>Filter by Center</InputLabel>
            <Select
              value={selectedCenter}
              onChange={(e) => setSelectedCenter(e.target.value)}
              label="Filter by Center"
            >
              <MenuItem value="all">All Centers</MenuItem>
              {centers.map(center => (
                <MenuItem key={center.id} value={center.id}>{center.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl 
            size="small" 
            sx={{ 
              minWidth: { xs: '100%', sm: 180 },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            <InputLabel>Filter by Executive</InputLabel>
            <Select
              value={selectedExecutive}
              onChange={(e) => setSelectedExecutive(e.target.value)}
              label="Filter by Executive"
            >
              <MenuItem value="all">All Executives</MenuItem>
              {staffList.map(staff => (
                <MenuItem key={staff.id} value={staff.id}>{staff.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Export Button - Full width on mobile */}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            sx={{ 
              minWidth: { xs: '100%', sm: 140 },
              width: { xs: '100%', sm: 'auto' }
            }}
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
          
          {/* New Appointment Button - Full width on mobile */}
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => { setNewAppt(defaultNewAppointment); setOpenDialog(true); }}
            sx={{ 
              width: { xs: '100%', sm: 'auto' },
              minWidth: { xs: '100%', sm: 'auto' }
            }}
          >
            New Appointment
          </Button>
        </Stack>
      </Box>

      {/* Filter Summary - Responsive */}
      {(selectedCenter !== 'all' || selectedExecutive !== 'all') && (
        <Box sx={{ 
          mb: 2, 
          display: 'flex', 
          gap: 1, 
          flexWrap: 'wrap', 
          alignItems: 'center',
          p: { xs: 1, sm: 0 }
        }}>
          <Chip 
            icon={<FilterListIcon />} 
            label="Active Filters:" 
            color="primary" 
            variant="outlined"
            size={isMobile ? 'small' : 'medium'}
          />
          {selectedCenter !== 'all' && (
            <Chip 
              label={`Center: ${centers.find(c => c.id === selectedCenter)?.name || 'Unknown'}`}
              onDelete={() => setSelectedCenter('all')}
              color="primary"
              size={isMobile ? 'small' : 'medium'}
            />
          )}
          {selectedExecutive !== 'all' && (
            <Chip 
              label={`Executive: ${staffList.find(s => s.id === selectedExecutive)?.name || 'Unknown'}`}
              onDelete={() => setSelectedExecutive('all')}
              color="secondary"
              size={isMobile ? 'small' : 'medium'}
            />
          )}
          <Button 
            size="small" 
            onClick={() => {
              setSelectedCenter('all');
              setSelectedExecutive('all');
            }}
          >
            Clear All
          </Button>
        </Box>
      )}

      {/* Calendar - Responsive */}
      <Paper sx={{ p: { xs: 1, sm: 2 }, overflow: 'auto' }}>
        <Box sx={{ 
          '& .fc': { 
            fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem' }
          },
          '& .fc-toolbar': {
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 0 }
          },
          '& .fc-toolbar-title': {
            fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' } 
          },
          '& .fc-button': {
            fontSize: { xs: '0.7rem', sm: '0.875rem' },
            padding: { xs: '4px 8px', sm: '6px 12px' }
          },
          '& .fc-daygrid-day-number': {
            fontSize: { xs: '0.7rem', sm: '0.875rem' },
            padding: { xs: '2px', sm: '4px' }
          },
          '& .fc-event-title': {
            fontSize: { xs: '0.65rem', sm: '0.75rem' },
            padding: { xs: '1px 2px', sm: '2px 4px' }
          }
        }}>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            headerToolbar={{ 
              left: isMobile ? 'prev,next' : 'prev,next today', 
              center: 'title', 
              right: isMobile ? 'dayGridMonth,listWeek' : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            }}
            initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
            selectable
            selectMirror
            dayMaxEvents={isMobile ? true : undefined}
            events={events}
            select={handleDateSelect}
            eventClick={handleEventClick}
            height={isMobile ? 'auto' : 'calc(100vh - 280px)'}
            eventDisplay={isMobile ? 'list-item' : 'block'}
            dayMaxEventRows={isMobile ? 2 : undefined}
            moreLinkClick={isMobile ? 'popover' : 'day'}
            views={{
              dayGridMonth: {
                dayMaxEventRows: isMobile ? 2 : 3,
                moreLinkClick: isMobile ? 'popover' : 'day'
              },
              timeGridWeek: {
                slotMinTime: '08:00:00',
                slotMaxTime: '20:00:00'
              },
              listWeek: {
                duration: { days: 7 }
              }
            }}
          />
        </Box>
      </Paper>

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
            maxHeight: { xs: '100%', sm: '90vh' }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
          Appointment Preview
        </DialogTitle>
        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {previewAppt ? (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Patient
              </Typography>
              <Typography variant="h6" sx={{ mb: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {previewAppt.patientName || '-'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }} color="text.secondary">
                Mobile: {previewPatientPhone || '—'}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Type
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>{previewAppt.type === 'center' ? 'Center Visit' : 'Home Visit'}</Typography>
              {previewAppt.type === 'center' && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Center
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{previewCenterName || '—'}</Typography>
                </>
              )}
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Date & Time
              </Typography>
              <Typography variant="body1" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                {new Date(previewAppt.start).toLocaleString()}
              </Typography>
              {previewAppt.type === 'center' ? null : (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Home Address
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1, wordBreak: 'break-word' }}>
                    {previewAppt.address || '—'}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Home Visit By
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>{previewHomeVisitorName || '—'}</Typography>
                </>
              )}
              {previewAppt.notes && (
                <>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Notes
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {previewAppt.notes}
                  </Typography>
                </>
              )}
            </Box>
          ) : (
            <Typography>Loading...</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={() => setOpenPreview(false)}
            variant="contained"
            fullWidth={isMobile}
          >
            Close
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
                          setNewAppt({ ...newAppt, enquiryId: e.id, patientName: e.name });
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
        onClose={() => setOpenDialog(false)} 
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
          <EventAvailableIcon color="primary" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }} /> 
          {newAppt.id ? 'Edit Appointment' : 'New Appointment'}
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
                label="Patient"
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
              />
            </Grid>
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
            ) : (
              <>
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
