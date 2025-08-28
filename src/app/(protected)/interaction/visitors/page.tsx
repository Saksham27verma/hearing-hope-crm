'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  InputAdornment,
  Card,
  CardContent,
  Stack,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  Avatar,
  alpha,
  Grid,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Today as TodayIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  Filter as FilterIcon,
  Clear as ClearIcon,
  CallMade as CallIcon,
  WhatsApp as WhatsAppIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/firebase/config';
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  doc,
} from 'firebase/firestore';

// Simplified Visitor interface
interface Visitor {
  id: string;
  name: string;
  phone: string;
  email?: string;
  visitorType: 'patient' | 'general';
  visitingCenter: string;
  visitDate: string;
  visitTime: string;
  notes?: string;
  
  // For general visitors only
  purposeOfVisit?: string;
  companyName?: string;
  contactPerson?: string;
  
  createdAt: any;
  updatedAt?: any;
}

export default function VisitorsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState<Visitor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [visitorTypeFilter, setVisitorTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);

  const [newVisitor, setNewVisitor] = useState<Partial<Visitor>>({
    name: '',
    phone: '',
    email: '',
    visitorType: 'general',
    visitingCenter: 'main',
    visitDate: new Date().toISOString().split('T')[0],
    visitTime: '',
    notes: '',
    purposeOfVisit: '',
    companyName: '',
    contactPerson: '',
  });

  useEffect(() => {
    fetchVisitors();
  }, []);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'visitors'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const visitorsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Visitor[];
      setVisitors(visitorsData);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredVisitors = () => {
    return visitors.filter(visitor => {
      const matchesSearch = visitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          visitor.phone.includes(searchTerm) ||
                          (visitor.email && visitor.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = visitorTypeFilter === 'all' || visitor.visitorType === visitorTypeFilter;
      
      // Tab filtering
      if (activeTab === 1) return matchesSearch && matchesType && visitor.visitDate === new Date().toISOString().split('T')[0];
      if (activeTab === 2) return matchesSearch && matchesType && visitor.visitorType === 'patient';
      if (activeTab === 3) return matchesSearch && matchesType && visitor.visitorType === 'general';
      
      return matchesSearch && matchesType;
    });
  };

  const getTabCounts = () => {
    const today = new Date().toISOString().split('T')[0];
    return {
      all: visitors.length,
      today: visitors.filter(v => v.visitDate === today).length,
      patients: visitors.filter(v => v.visitorType === 'patient').length,
      general: visitors.filter(v => v.visitorType === 'general').length,
    };
  };

  const getCenterLabel = (centerValue: string): string => {
    const centerMap: { [key: string]: string } = {
      'main': 'Main Center',
      'north': 'North Branch',
      'south': 'South Branch',
      'east': 'East Branch',
      'west': 'West Branch'
    };
    return centerMap[centerValue] || centerValue;
  };

  const handleOpenDialog = () => {
    setNewVisitor({
      name: '',
      phone: '',
      email: '',
      visitorType: 'general',
      visitingCenter: 'main',
      visitDate: new Date().toISOString().split('T')[0],
      visitTime: '',
      notes: '',
      purposeOfVisit: '',
      companyName: '',
      contactPerson: '',
    });
    setEditingVisitor(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingVisitor(null);
  };

  const handleEdit = (visitor: Visitor) => {
    setNewVisitor({
      name: visitor.name,
      phone: visitor.phone,
      email: visitor.email || '',
      visitorType: visitor.visitorType,
      visitingCenter: visitor.visitingCenter,
      visitDate: visitor.visitDate,
      visitTime: visitor.visitTime,
      notes: visitor.notes || '',
      purposeOfVisit: visitor.purposeOfVisit || '',
      companyName: visitor.companyName || '',
      contactPerson: visitor.contactPerson || '',
    });
    setEditingVisitor(visitor);
    setOpenDialog(true);
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setNewVisitor(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVisitorTypeChange = (type: 'patient' | 'general') => {
    setNewVisitor(prev => ({
      ...prev,
      visitorType: type,
      // Clear general visitor fields if switching to patient
      ...(type === 'patient' ? {
        purposeOfVisit: '',
        companyName: '',
        contactPerson: ''
      } : {})
    }));
  };

  const handleSubmit = async () => {
    try {
      // If it's a patient, just redirect to enquiries without saving anything
      if (newVisitor.visitorType === 'patient') {
        handleCloseDialog();
        // Redirect to enquiries page directly
        router.push('/interaction/enquiries');
        return;
      }

      // For general visitors, save normally
      const visitorData = {
        name: newVisitor.name,
        phone: newVisitor.phone,
        email: newVisitor.email || '',
        visitorType: newVisitor.visitorType,
        visitingCenter: newVisitor.visitingCenter,
        visitDate: newVisitor.visitDate,
        visitTime: newVisitor.visitTime,
        notes: newVisitor.notes || '',
        purposeOfVisit: newVisitor.purposeOfVisit || '',
        companyName: newVisitor.companyName || '',
        contactPerson: newVisitor.contactPerson || '',
        ...(editingVisitor ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
      };

      if (editingVisitor) {
        await updateDoc(doc(db, 'visitors', editingVisitor.id), visitorData);
      } else {
        await addDoc(collection(db, 'visitors'), visitorData);
      }

      handleCloseDialog();
      fetchVisitors();
    } catch (error) {
      console.error('Error saving visitor:', error);
    }
  };

  const handleDeleteVisitor = async (visitorId: string) => {
    try {
      await deleteDoc(doc(db, 'visitors', visitorId));
      fetchVisitors();
    } catch (error) {
      console.error('Error deleting visitor:', error);
    }
  };

  const handleRefresh = async () => {
    await fetchVisitors();
  };

  const handleCall = (phoneNumber: string) => {
    window.open(`tel:${phoneNumber}`);
  };

  const handleWhatsApp = (phoneNumber: string, name: string) => {
    const message = `Hello ${name}, this is regarding your visit to Hearing Hope.`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setVisitorTypeFilter('all');
    setActiveTab(0);
  };

  const tabCounts = getTabCounts();
  const filteredVisitors = getFilteredVisitors();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Visitor Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleOpenDialog}
            sx={{ bgcolor: 'primary.main' }}
          >
            New Visitor
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <TextField
                fullWidth
                label="Search"
                variant="outlined"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ minWidth: 120 }}>
              <FormControl fullWidth>
                <InputLabel>Visitor Type</InputLabel>
                <Select
                  value={visitorTypeFilter}
                  label="Visitor Type"
                  onChange={(e) => setVisitorTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="patient">Patient</MenuItem>
                  <MenuItem value="general">General</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </Box>
          </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            label={
              <Badge badgeContent={tabCounts.all} color="primary">
                All Visitors
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={tabCounts.today} color="success">
                Today's Visits
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={tabCounts.patients} color="primary">
                Patients
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={tabCounts.general} color="secondary">
                General Visitors
              </Badge>
            }
          />
        </Tabs>
      </Paper>

      {/* Visitors Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Visitor</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Visit Details</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Center</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredVisitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    No visitors found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVisitors.map((visitor) => (
                  <TableRow key={visitor.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: visitor.visitorType === 'patient' ? 'primary.main' : 'secondary.main' }}>
                          {visitor.visitorType === 'patient' ? <PersonIcon /> : <BusinessIcon />}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="medium">
                            {visitor.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {visitor.phone}
                          </Typography>
                          {visitor.email && (
                            <Typography variant="body2" color="text.secondary">
                              {visitor.email}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={visitor.visitorType === 'patient' ? 'Patient' : 'General'}
                        color={visitor.visitorType === 'patient' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarIcon fontSize="small" />
                          {new Date(visitor.visitDate).toLocaleDateString()}
                        </Typography>
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimeIcon fontSize="small" />
                          {visitor.visitTime || 'Not set'}
                        </Typography>
                        {visitor.purposeOfVisit && (
                          <Typography variant="body2" color="text.secondary">
                            {visitor.purposeOfVisit}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {getCenterLabel(visitor.visitingCenter)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Call">
                          <IconButton
                            size="small"
                            onClick={() => handleCall(visitor.phone)}
                            color="primary"
                          >
                            <CallIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="WhatsApp">
                          <IconButton
                            size="small"
                            onClick={() => handleWhatsApp(visitor.phone, visitor.name)}
                            sx={{ color: '#25D366' }}
                          >
                            <WhatsAppIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(visitor)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteVisitor(visitor.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Visitor Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingVisitor ? 'Edit Visitor' : 'New Visitor Registration'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* Visitor Type Selection */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Visitor Type
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <Box sx={{ flex: 1 }}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: newVisitor.visitorType === 'patient' ? '2px solid' : '1px solid',
                      borderColor: newVisitor.visitorType === 'patient' ? 'primary.main' : 'divider',
                      bgcolor: newVisitor.visitorType === 'patient' ? alpha('#1976d2', 0.1) : 'background.paper'
                    }}
                    onClick={() => handleVisitorTypeChange('patient')}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <PersonIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                      <Typography variant="h6" fontWeight="bold">
                        Patient/Customer
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Hearing-related consultation or service
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: newVisitor.visitorType === 'general' ? '2px solid' : '1px solid',
                      borderColor: newVisitor.visitorType === 'general' ? 'secondary.main' : 'divider',
                      bgcolor: newVisitor.visitorType === 'general' ? alpha('#9c27b0', 0.1) : 'background.paper'
                    }}
                    onClick={() => handleVisitorTypeChange('general')}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <BusinessIcon sx={{ fontSize: 48, color: 'secondary.main', mb: 1 }} />
                      <Typography variant="h6" fontWeight="bold">
                        General Visitor
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Business meeting, inquiry, or other purpose
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            </Box>

            {/* Patient Confirmation */}
            {newVisitor.visitorType === 'patient' && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Redirecting to Patient Management
                </Typography>
                <Typography variant="body2">
                  You will be redirected to the <strong>Enquiries Module</strong> where you can manage all patient details including:
                </Typography>
                <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
                  <li>Complete patient information</li>
                  <li>Medical services (hearing tests, trials, fittings)</li>
                  <li>Multiple visit scheduling</li>
                  <li>Follow-up management</li>
                  <li>Medical forms and documentation</li>
                </Box>
              </Alert>
            )}

            {/* General Visitor Form */}
            {newVisitor.visitorType === 'general' && (
              <>
                {/* Basic Information */}
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Basic Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="Name *"
                      name="name"
                      value={newVisitor.name}
                      onChange={handleInputChange}
                      required
                    />
                    <TextField
                      fullWidth
                      label="Phone Number *"
                      name="phone"
                      value={newVisitor.phone}
                      onChange={handleInputChange}
                      required
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={newVisitor.email}
                      onChange={handleInputChange}
                    />
                    <FormControl fullWidth>
                      <InputLabel>Visiting Center</InputLabel>
                      <Select
                        name="visitingCenter"
                        value={newVisitor.visitingCenter}
                        label="Visiting Center"
                        onChange={handleInputChange}
                      >
                        <MenuItem value="main">Main Center</MenuItem>
                        <MenuItem value="north">North Branch</MenuItem>
                        <MenuItem value="south">South Branch</MenuItem>
                        <MenuItem value="east">East Branch</MenuItem>
                        <MenuItem value="west">West Branch</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="Visit Date"
                      name="visitDate"
                      type="date"
                      value={newVisitor.visitDate}
                      onChange={handleInputChange}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      fullWidth
                      label="Visit Time"
                      name="visitTime"
                      type="time"
                      value={newVisitor.visitTime}
                      onChange={handleInputChange}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>
                </Box>

                {/* Visit Details */}
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Visit Details
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Purpose of Visit"
                    name="purposeOfVisit"
                    value={newVisitor.purposeOfVisit}
                    onChange={handleInputChange}
                    multiline
                    rows={2}
                  />
                  <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <TextField
                      fullWidth
                      label="Company Name"
                      name="companyName"
                      value={newVisitor.companyName}
                      onChange={handleInputChange}
                    />
                    <TextField
                      fullWidth
                      label="Contact Person"
                      name="contactPerson"
                      value={newVisitor.contactPerson}
                      onChange={handleInputChange}
                    />
                  </Box>
                  <TextField
                    fullWidth
                    label="Notes"
                    name="notes"
                    value={newVisitor.notes}
                    onChange={handleInputChange}
                    multiline
                    rows={3}
                  />
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={newVisitor.visitorType === 'general' && (!newVisitor.name || !newVisitor.phone)}
            endIcon={newVisitor.visitorType === 'patient' ? <ArrowForwardIcon /> : undefined}
          >
            {newVisitor.visitorType === 'patient' 
              ? 'Continue to Enquiries' 
              : editingVisitor 
                ? 'Update Visitor' 
                : 'Register Visitor'
            }
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 