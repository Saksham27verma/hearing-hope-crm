'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  Button,
  Chip,
  Divider,
  Stack,
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
  TextField
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  DataSaverOn as DataSaverOnIcon,
  CheckCircle as CheckCircleIcon,
  ContactPage as ContactPageIcon,
  Notes as NotesIcon,
  ChatBubble as ChatBubbleIcon,
  EventNote as EventNoteIcon,
  Visibility as VisibilityIcon,
  MedicalServices as MedicalServicesIcon,
  Hearing as HearingIcon,
  HomeWork as HomeWorkIcon,
  Chat as ChatIcon,
  CurrencyRupee as CurrencyRupeeIcon,
  Calculate as CalculateIcon,
  Edit as EditIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import PureToneAudiogram from '@/components/enquiries/PureToneAudiogram';

// Avoid MUI Grid generic type noise by wrapping
const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

// Styled components for the form
const StyledFormSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  background: alpha('#fff3e0', 0.5),
  padding: theme.spacing(2),
  border: `1px solid ${alpha('#ffcc80', 0.8)}`,
}));

const FormSectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
  color: '#f57c00',
}));

// Enquiry type options with expanded options
const specializedFormTypes = [
  { value: 'test_and_trial', label: 'Hearing Test & Trial' },
  { value: 'impedance', label: 'Impedance Test' },
  { value: 'hearing_aid', label: 'Hearing Aid Fitting' },
  { value: 'home_visit', label: 'Home Visit' }
];

// Helper function to get enquiry type label
const getSpecializedFormLabel = (type: string): string => {
  const found = specializedFormTypes.find(t => t.value === type);
  return found ? found.label : type;
};

// Get status chip
const getStatusChip = (status: string) => {
  let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
  
  switch (status) {
    case 'new':
      color = 'primary';
      break;
    case 'in-progress':
      color = 'info';
      break;
    case 'resolved':
      color = 'success';
      break;
    case 'closed':
      color = 'default';
      break;
    default:
      color = 'default';
  }
  
  return <Chip label={status} color={color} size="small" />;
};

// Update the form type icons
const getFormTypeIcon = (type: string) => {
  switch (type) {
    case 'test_and_trial':
      return <MedicalServicesIcon />;
    case 'impedance':
      return <MedicalServicesIcon />;
    case 'trial':
      return <HearingIcon />; // Keep for backward compatibility
    case 'test':
      return <MedicalServicesIcon />; // Keep for backward compatibility
    case 'home_visit':
      return <HomeWorkIcon />;
    case 'hearing_aid':
      return <HearingIcon />;
    case 'online':
      return <ChatIcon />; // Keep for backward compatibility
    default:
      return <DataSaverOnIcon />;
  }
};

export default function EnquiryDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVisitTab, setActiveVisitTab] = useState(0);
  
  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params;
      setResolvedParams(resolved);
    };
    resolveParams();
  }, [params]);
  
  useEffect(() => {
    if (!resolvedParams) return;
    
    const fetchEnquiry = async () => {
      try {
        setLoading(true);
        setError(null);
        const enquiryDoc = await getDoc(doc(db, 'enquiries', resolvedParams.id));
        
        if (enquiryDoc.exists()) {
          const enquiryData = enquiryDoc.data();
          
          // Safely process the enquiry data, handling any malformed audiogram data
          try {
            // Normalize visit schedules to ensure audiogram data is properly structured
            if (enquiryData.visitSchedules && Array.isArray(enquiryData.visitSchedules)) {
              enquiryData.visitSchedules = enquiryData.visitSchedules.map((visit: any) => {
                if (visit && typeof visit === 'object') {
                  // Ensure hearingTestDetails exists and has proper structure
                  if (visit.hearingTestDetails && typeof visit.hearingTestDetails === 'object') {
                    // Validate audiogramData structure
                    if (visit.hearingTestDetails.audiogramData) {
                      const audiogram = visit.hearingTestDetails.audiogramData;
                      // Ensure all required arrays exist
                      if (!Array.isArray(audiogram.rightAirConduction)) {
                        audiogram.rightAirConduction = Array(7).fill(null);
                      }
                      if (!Array.isArray(audiogram.leftAirConduction)) {
                        audiogram.leftAirConduction = Array(7).fill(null);
                      }
                      if (!Array.isArray(audiogram.rightBoneConduction)) {
                        audiogram.rightBoneConduction = Array(7).fill(null);
                      }
                      if (!Array.isArray(audiogram.leftBoneConduction)) {
                        audiogram.leftBoneConduction = Array(7).fill(null);
                      }
                      if (!Array.isArray(audiogram.rightMasking)) {
                        audiogram.rightMasking = Array(7).fill(false);
                      }
                      if (!Array.isArray(audiogram.leftMasking)) {
                        audiogram.leftMasking = Array(7).fill(false);
                      }
                    }
                  }
                }
                return visit;
              });
            }
            
            setEnquiry({
              id: enquiryDoc.id,
              ...enquiryData
            });
          } catch (dataError) {
            console.error('Error processing enquiry data:', dataError);
            // Still set the enquiry even if data processing fails
            setEnquiry({
              id: enquiryDoc.id,
              ...enquiryData
            });
          }
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
    
    fetchEnquiry();
  }, [resolvedParams]);
  
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/interaction/enquiries')}
          sx={{ borderColor: '#f57c00', color: '#f57c00', '&:hover': { borderColor: '#e65100', backgroundColor: alpha('#f57c00', 0.04) } }}
        >
          Back to Enquiries
        </Button>
        
        <Typography variant="h5">Enquiry Details</Typography>
        
        {userProfile?.role !== 'audiologist' && resolvedParams && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => {
              // Navigate to edit enquiry
              router.push(`/interaction/enquiries/edit/${resolvedParams.id}`);
            }}
            sx={{ 
              bgcolor: '#f57c00', 
              '&:hover': { bgcolor: '#e65100' },
              boxShadow: '0 2px 8px rgba(245, 124, 0, 0.3)'
            }}
            size="small"
          >
            Edit Enquiry
          </Button>
        )}
      </Box>
      
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        {/* Header */}
        <Box sx={{ 
          mb: 3, 
          p: 2, 
          borderRadius: 1, 
          background: "linear-gradient(145deg, #f57c00, #e65100)",
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'white', width: 56, height: 56 }}>
            <PersonIcon sx={{ fontSize: 32, color: '#f57c00' }} />
          </Avatar>
          <Box>
            <Typography variant="h5">{enquiry.name}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Enquiry received on {new Date(enquiry.createdAt.seconds * 1000).toLocaleString()}
            </Typography>
          </Box>
          </Box>
          
          {/* Quick Actions */}
          {userProfile?.role !== 'audiologist' && resolvedParams && (
            <IconButton
              onClick={() => router.push(`/interaction/enquiries/edit/${resolvedParams.id}`)}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                border: '1px solid rgba(255,255,255,0.3)'
              }}
              title="Edit Enquiry"
            >
              <EditIcon />
            </IconButton>
          )}
        </Box>
        
        {/* Basic Information Section */}
        <StyledFormSection>
          <FormSectionTitle variant="subtitle1" sx={{ color: '#e65100' }}>
            <PersonIcon sx={{ color: '#f57c00' }} /> Patient Information
          </FormSectionTitle>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">Full Name</Typography>
              </Box>
              <Typography variant="body1" fontWeight="medium">{enquiry.name || 'Not provided'}</Typography>
            </Grid>
            
            {userProfile?.role !== 'audiologist' && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">Phone Number</Typography>
                </Box>
                <Typography variant="body1">{enquiry.phone || 'Not provided'}</Typography>
              </Grid>
            )}
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <EmailIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">Email</Typography>
              </Box>
              <Typography variant="body1">{enquiry.email || 'Not provided'}</Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ContactPageIcon fontSize="small" color="action" />
                <Typography variant="subtitle2">Reference Source</Typography>
              </Box>
              <Typography variant="body1">{enquiry.reference || 'Not provided'}</Typography>
            </Grid>
            
            {enquiry.address && (
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
                  <HomeIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">Address</Typography>
                </Box>
                <Typography variant="body1">{enquiry.address}</Typography>
              </Grid>
            )}
            
            {enquiry.city && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1, mt: 1 }}>
                  <HomeWorkIcon fontSize="small" color="action" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="subtitle2">City/Location</Typography>
                    <Typography variant="body1">{enquiry.city}</Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {enquiry.assignedTo && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">Assigned To</Typography>
                </Box>
                <Typography variant="body1">{enquiry.assignedTo}</Typography>
              </Grid>
            )}

            {enquiry.telecaller && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">Telecaller</Typography>
                </Box>
                <Typography variant="body1">{enquiry.telecaller}</Typography>
              </Grid>
            )}

            {enquiry.status && (
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
                  <CheckCircleIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2">Status</Typography>
                </Box>
                <Chip 
                  label={enquiry.status} 
                  color={
                    enquiry.status === 'open' ? 'primary' :
                    enquiry.status === 'in-progress' ? 'info' :
                    enquiry.status === 'resolved' ? 'success' :
                    'default'
                  }
                  size="small"
                />
            </Grid>
            )}
          {/* Created/Updated timestamps */}
            <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
              <EventNoteIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">Created At</Typography>
            </Box>
            <Typography variant="body1">{enquiry.createdAt ? new Date(enquiry.createdAt.seconds * 1000).toLocaleString() : '—'}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 1 }}>
              <EventNoteIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">Updated At</Typography>
            </Box>
            <Typography variant="body1">{enquiry.updatedAt ? new Date(enquiry.updatedAt.seconds * 1000).toLocaleString() : '—'}</Typography>
              </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />
          
          <FormSectionTitle variant="subtitle1" sx={{ color: '#e65100' }}>
            <ChatBubbleIcon sx={{ color: '#f57c00' }} /> Enquiry Details
          </FormSectionTitle>
          
          {enquiry.subject && (
            <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Subject</Typography>
            <Typography variant="body1" sx={{ mt: 0.5 }}>{enquiry.subject}</Typography>
          </Box>
          )}
          
          {enquiry.message && (
            <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <NotesIcon fontSize="small" /> Message/Notes
            </Typography>
            <Typography variant="body1" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
              {enquiry.message}
            </Typography>
          </Box>
          )}
        </StyledFormSection>

        {/* Call History Section */}
        <StyledFormSection>
          <FormSectionTitle variant="subtitle1" sx={{ color: '#e65100' }}>
            <EventNoteIcon sx={{ color: '#f57c00' }} /> Call History
          </FormSectionTitle>
          
          {enquiry.followUps && enquiry.followUps.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead sx={{ bgcolor: '#fff3e0' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Call Date</TableCell>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Call Remarks</TableCell>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Next Call Date</TableCell>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Call Done By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enquiry.followUps.map((followUp: any) => (
                    <TableRow key={followUp.id}>
                      <TableCell>{new Date(followUp.date).toLocaleDateString()}</TableCell>
                      <TableCell>{followUp.remarks}</TableCell>
                      <TableCell>{new Date(followUp.nextFollowUpDate).toLocaleDateString()}</TableCell>
                      <TableCell>{followUp.callerName || 'Not specified'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography color="text.secondary">No call follow-ups recorded yet.</Typography>
            </Box>
          )}
        </StyledFormSection>

        {/* Visits Section with Tabs */}
        <StyledFormSection>
          <FormSectionTitle variant="subtitle1" sx={{ color: '#e65100' }}>
            <VisibilityIcon sx={{ color: '#f57c00' }} /> Visit History
          </FormSectionTitle>
          
          {(enquiry.visits || enquiry.visitSchedules) && (enquiry.visits?.length > 0 || enquiry.visitSchedules?.length > 0) ? (
            <Box>
              {/* Tabs for visits */}
              <Box sx={{ 
                borderBottom: 1, 
                borderColor: 'divider', 
                mb: 2,
                overflowX: 'auto',
                display: 'flex'
              }}>
                {(enquiry.visits || enquiry.visitSchedules || []).map((visit: any, index: number) => (
                  <Box 
                    key={visit.id || index}
                    onClick={() => setActiveVisitTab(index)}
                    sx={{
                      px: 2,
                      py: 1.5,
                      minWidth: '200px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      borderRight: 1,
                      borderColor: 'divider',
                      bgcolor: activeVisitTab === index ? '#fff3e0' : 'background.paper',
                      color: activeVisitTab === index ? '#e65100' : 'text.primary',
                      '&:hover': {
                        bgcolor: activeVisitTab === index ? '#fff3e0' : 'action.hover',
                      },
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                      position: 'relative'
                    }}
                  >
                    <Typography variant="subtitle2" noWrap>
                      Visit {index + 1} - {visit.visitType === 'center' ? 'Center' : 'Home'}
                    </Typography>
                    <Typography variant="caption" noWrap>
                      {visit.visitDate || visit.date ? 
                        new Date(visit.visitDate || visit.date).toLocaleDateString() : 
                        'Not scheduled'
                      }
                    </Typography>
                    {activeVisitTab === index && (
                      <Box 
                        sx={{ 
                          position: 'absolute', 
                          bottom: 0, 
                          left: 0, 
                          right: 0, 
                          height: '3px', 
                          bgcolor: '#f57c00' 
                        }}
                      />
                    )}
                  </Box>
                ))}
              </Box>
              
              {/* Visit content */}
              {(enquiry.visits || enquiry.visitSchedules || []).map((visit: any, index: number) => (
                <Box
                  key={visit.id || index}
                  sx={{ 
                    display: activeVisitTab === index ? 'block' : 'none',
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1
                  }}
                >
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Visit Date</Typography>
                      <Typography variant="body1">
                        {visit.visitDate || visit.date ? 
                          `${visit.visitDate || visit.date} ${visit.visitTime ? `at ${visit.visitTime}` : ''}` : 
                          'Not scheduled'
                        }
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Visit Type</Typography>
                      <Typography variant="body1">
                        {visit.visitType === 'center' ? 'Center Visit' : 'Home Visit'}
                      </Typography>
                    </Grid>
                    {/* Services Provided */}
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Services Provided in this Visit
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                        {visit.hearingTest && <Chip label="Hearing Test" size="small" color="info" />}
                        {visit.hearingAidTrial && <Chip label="Hearing Aid Trial" size="small" color="warning" />}
                        {visit.hearingAidBooked && <Chip label="Hearing Aid Booked" size="small" color="primary" />}
                        {visit.hearingAidSale && <Chip label="Hearing Aid Sale" size="small" color="success" />}
                        {visit.accessory && <Chip label="Accessory" size="small" color="secondary" />}
                        {visit.programming && <Chip label="Programming" size="small" color="info" />}
                        {visit.repair && <Chip label="Repair" size="small" color="error" />}
                        {visit.counselling && <Chip label="Counselling" size="small" color="default" />}
                      </Stack>
                      
                      {/* General Visit Information */}
                      {(visit.whichEar || visit.visitNotes) && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>General Visit Information</Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.whichEar && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Which Ear</Typography>
                                <Typography variant="body2">{visit.whichEar}</Typography>
                              </Box>
                            )}
                          </Box>
                          {visit.visitNotes && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="caption" color="text.secondary">Visit Notes</Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{visit.visitNotes}</Typography>
                            </Box>
                          )}
                        </Paper>
                      )}
                      
                      {/* Basic Hearing Aid Information */}
                      {(visit.hearingAidType || visit.hearingAidBrand || visit.hearingAidModel || visit.hearingAidPrice || visit.warranty) && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>Basic Hearing Aid Information</Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                            {visit.hearingAidType && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Type</Typography>
                                <Typography variant="body2">{visit.hearingAidType}</Typography>
                              </Box>
                            )}
                            {visit.hearingAidBrand && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Brand</Typography>
                                <Typography variant="body2">{visit.hearingAidBrand}</Typography>
                              </Box>
                            )}
                            {visit.hearingAidModel && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Model</Typography>
                                <Typography variant="body2">{visit.hearingAidModel}</Typography>
                              </Box>
                            )}
                            {visit.hearingAidPrice > 0 && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Price</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{visit.hearingAidPrice?.toLocaleString()}</Typography>
                              </Box>
                            )}
                            {visit.warranty && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Warranty</Typography>
                                <Typography variant="body2">{visit.warranty}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      )}
                      
                      {/* Purchase Information */}
                      {(visit.purchaseFromTrial || visit.purchaseDate || visit.purchaseFromVisitId) && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, color: 'success.main' }}>Purchase Information</Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                            {visit.purchaseDate && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Purchase Date</Typography>
                                <Typography variant="body2">{visit.purchaseDate}</Typography>
                              </Box>
                            )}
                            {visit.purchaseFromTrial && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Purchase From Trial</Typography>
                                <Chip label="Yes" color="success" size="small" />
                              </Box>
                            )}
                            {visit.purchaseFromVisitId && (
                              <Box>
                                <Typography variant="caption" color="text.secondary">Related Visit</Typography>
                                <Typography variant="body2">{visit.purchaseFromVisitId}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      )}
                      {(visit.bookingDate || visit.bookingAdvanceAmount || visit.journeyStage || visit.whoSold) && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="caption" color="text.secondary">Journey Stage</Typography>
                              <Typography variant="body1">{visit.journeyStage || '—'}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="caption" color="text.secondary">Booking Date</Typography>
                              <Typography variant="body1">{visit.bookingDate || '—'}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="caption" color="text.secondary">Booking Advance</Typography>
                              <Typography variant="body1">{visit.bookingAdvanceAmount ? `₹${visit.bookingAdvanceAmount}` : '—'}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <Typography variant="caption" color="text.secondary">Who Sold</Typography>
                              <Typography variant="body1">{visit.whoSold || '—'}</Typography>
                            </Grid>
                          </Grid>
                        </Paper>
                      )}
                    </Grid>
                    
                    {/* Notes and Additional Information */}
                    {(visit.notes || visit.visitNotes) && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#795548', 0.05), border: 1, borderColor: alpha('#795548', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
                            Notes & Additional Information
                          </Typography>
                          {visit.notes && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="body2" color="text.secondary">Visit Notes</Typography>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.notes}</Typography>
                            </Box>
                          )}
                          {visit.visitNotes && visit.visitNotes !== visit.notes && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">Additional Notes</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.visitNotes}</Typography>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    )}

                    {/* Visit Summary Information */}
                    {(visit.totalVisitAmount || visit.totalDiscountPercent || visit.visitStatus || visit.completedBy) && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#00acc1', 0.05), border: 1, borderColor: alpha('#00acc1', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'info.main', fontWeight: 600 }}>
                            Visit Summary
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.totalVisitAmount > 0 && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Total Visit Amount</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                                  ₹{visit.totalVisitAmount?.toLocaleString()}
                                </Typography>
                              </Box>
                            )}
                            {visit.totalDiscountPercent > 0 && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Total Discount</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'warning.main' }}>
                                  {visit.totalDiscountPercent}%
                                </Typography>
                              </Box>
                            )}
                            {visit.visitStatus && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Visit Status</Typography>
                                <Chip 
                                  label={visit.visitStatus}
                                  color={
                                    visit.visitStatus === 'completed' ? 'success' :
                                    visit.visitStatus === 'in_progress' ? 'warning' :
                                    visit.visitStatus === 'scheduled' ? 'info' :
                                    'default'
                                  }
                                  size="small"
                                />
                              </Box>
                            )}
                            {visit.completedBy && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Visit Handled By</Typography>
                                <Typography variant="body1">{visit.completedBy}</Typography>
                              </Box>
                            )}
                            {visit.whoSold && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Sales Person</Typography>
                                <Typography variant="body1">{visit.whoSold}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    )}
                    
                    {/* Services */}
                    {visit.services && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" color="text.secondary">Services</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          {visit.services.hearingTest && (
                            <Chip label="Hearing Test" color="info" size="small" />
                          )}
                          {visit.services.hearingAid && (
                            <Chip label="Hearing Aid" color="success" size="small" />
                          )}
                        </Box>
                      </Grid>
                    )}

                    {/* Hearing Aid Products (flat structure) */}
                    {Array.isArray(visit.products) && visit.products.length > 0 && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Hearing Aid Products</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Product</TableCell>
                                <TableCell>Serial</TableCell>
                                <TableCell align="right">MRP</TableCell>
                                <TableCell align="right">Discount%</TableCell>
                                <TableCell align="right">Price</TableCell>
                                <TableCell align="right">GST%</TableCell>
                                <TableCell align="right">Total</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {visit.products.map((p: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell>{p.name || p.productName || '—'}</TableCell>
                                  <TableCell>{p.serialNumber || '—'}</TableCell>
                                  <TableCell align="right">{p.mrp ? `₹${p.mrp}` : '—'}</TableCell>
                                  <TableCell align="right">{p.discountPercent ?? 0}%</TableCell>
                                  <TableCell align="right">{p.sellingPrice ? `₹${p.sellingPrice}` : '—'}</TableCell>
                                  <TableCell align="right">{p.gstPercent ?? 0}%</TableCell>
                                  <TableCell align="right">{p.finalAmount ? `₹${p.finalAmount}` : (p.sellingPrice ? `₹${p.sellingPrice}` : '—')}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow>
                                <TableCell colSpan={6} align="right"><strong>Gross Before Tax</strong></TableCell>
                                <TableCell align="right">{visit.grossSalesBeforeTax ? `₹${visit.grossSalesBeforeTax}` : '—'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={6} align="right"><strong>Tax Amount</strong></TableCell>
                                <TableCell align="right">{visit.taxAmount ? `₹${visit.taxAmount}` : '—'}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell colSpan={6} align="right"><strong>Total After Tax</strong></TableCell>
                                <TableCell align="right">{visit.salesAfterTax ? `₹${visit.salesAfterTax}` : '—'}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    )}
                    
                    {/* Hearing Test Details */}
                    {(visit.hearingTest || visit.testType || visit.testDoneBy || visit.testResults || visit.recommendations || visit.testPrice || visit.hearingTestDetails?.audiogramData) && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#2196f3', 0.05), border: 1, borderColor: alpha('#2196f3', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'info.main', fontWeight: 600 }}>
                            Hearing Test Details
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.testType && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">Test Type</Typography>
                                <Typography variant="body1">{visit.testType}</Typography>
                            </Box>
                            )}
                            {visit.testDoneBy && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">Test Done By</Typography>
                                <Typography variant="body1">{visit.testDoneBy}</Typography>
                            </Box>
                            )}
                            {visit.testPrice !== undefined && (
                            <Box>
                              <Typography variant="body2" color="text.secondary">Test Price</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: visit.testPrice > 0 ? 'info.main' : 'success.main' }}>
                                  {visit.testPrice > 0 ? `₹${visit.testPrice?.toLocaleString()}` : 'Free'}
                              </Typography>
                            </Box>
                            )}
                          </Box>
                          {visit.testResults && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Test Results</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.testResults}</Typography>
                            </Box>
                          )}
                          {visit.recommendations && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Recommendations</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.recommendations}</Typography>
                            </Box>
                          )}
                          
                          {/* Legacy hearing test details support */}
                          {visit.hearingTestDetails && (
                            <>
                              {visit.hearingTestDetails.testType && !visit.testType && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="body2" color="text.secondary">Test Type (Legacy)</Typography>
                                  <Typography variant="body1">{visit.hearingTestDetails.testType}</Typography>
                                </Box>
                              )}
                              {visit.hearingTestDetails.testDoneBy && !visit.testDoneBy && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="body2" color="text.secondary">Test Done By (Legacy)</Typography>
                                  <Typography variant="body1">{visit.hearingTestDetails.testDoneBy}</Typography>
                                </Box>
                              )}
                              {visit.hearingTestDetails.testPrice !== undefined && visit.testPrice === undefined && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="body2" color="text.secondary">Test Price (Legacy)</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 600, color: visit.hearingTestDetails.testPrice > 0 ? 'info.main' : 'success.main' }}>
                                    {visit.hearingTestDetails.testPrice > 0 ? `₹${visit.hearingTestDetails.testPrice?.toLocaleString()}` : 'Free'}
                                  </Typography>
                                </Box>
                              )}
                              {visit.hearingTestDetails.testResults && !visit.testResults && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="body2" color="text.secondary">Test Results (Legacy)</Typography>
                                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.hearingTestDetails.testResults}</Typography>
                                </Box>
                              )}
                              {visit.hearingTestDetails.recommendations && !visit.recommendations && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="body2" color="text.secondary">Recommendations (Legacy)</Typography>
                                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.hearingTestDetails.recommendations}</Typography>
                                </Box>
                              )}
                            </>
                          )}

                          {/* Pure Tone Audiogram - View only for all users (show even if no data) */}
                          {(visit.hearingTest || visit.hearingTestDetails) && (
                            <Box sx={{ mt: 3 }}>
                              {(() => {
                                try {
                                  // Safely extract audiogram data
                                  const audiogramData = visit.hearingTestDetails?.audiogramData || 
                                                       visit.audiogramData || 
                                                       undefined;
                                  
                                  return (
                                    <PureToneAudiogram
                                      data={audiogramData}
                                      onChange={() => {}} // Read-only in detail view
                                      editable={false}
                                      readOnly={true}
                                    />
                                  );
                                } catch (err) {
                                  console.error('Error rendering audiogram:', err);
                                  return (
                                    <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                                      <Typography variant="body2" color="error">
                                        Unable to display audiogram. Please check the data format.
                                      </Typography>
                                    </Box>
                                  );
                                }
                              })()}
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    )}

                    {/* Trial Details */}
                    {(visit.trialGiven || visit.hearingAidTrial) && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#ff9800', 0.05), border: 1, borderColor: alpha('#ff9800', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'warning.main', fontWeight: 600 }}>
                            Trial Details
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.trialDuration && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Trial Duration</Typography>
                                <Typography variant="body1">{visit.trialDuration} days</Typography>
                              </Box>
                            )}
                            {visit.trialStartDate && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Trial Start Date</Typography>
                                <Typography variant="body1">{visit.trialStartDate}</Typography>
                              </Box>
                            )}
                            {visit.trialEndDate && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Trial End Date</Typography>
                                <Typography variant="body1">{visit.trialEndDate}</Typography>
                              </Box>
                            )}
                            {visit.trialHearingAidBrand && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Trial Hearing Aid Brand</Typography>
                                <Typography variant="body1">{visit.trialHearingAidBrand}</Typography>
                              </Box>
                            )}
                            {visit.trialHearingAidModel && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Trial Hearing Aid Model</Typography>
                                <Typography variant="body1">{visit.trialHearingAidModel}</Typography>
                              </Box>
                            )}
                            {visit.trialHearingAidType && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Trial Hearing Aid Type</Typography>
                                <Typography variant="body1">{visit.trialHearingAidType}</Typography>
                              </Box>
                            )}
                            {visit.trialResult && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Trial Result</Typography>
                                <Chip 
                                  label={visit.trialResult}
                                  color={
                                    visit.trialResult === 'successful' ? 'success' :
                                    visit.trialResult === 'unsuccessful' ? 'error' :
                                    visit.trialResult === 'extended' ? 'warning' :
                                    'default'
                                  }
                                  size="small"
                                />
                              </Box>
                            )}
                          </Box>
                          {visit.trialNotes && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Trial Notes</Typography>
                              <Typography variant="body1">{visit.trialNotes}</Typography>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    )}

                    {/* Booking Details */}
                    {(visit.hearingAidBooked || visit.bookingAdvanceAmount > 0 || visit.bookingDate) && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#2196f3', 0.05), border: 1, borderColor: alpha('#2196f3', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
                            Booking Details
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.bookingDate && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Booking Date</Typography>
                                <Typography variant="body1">{visit.bookingDate}</Typography>
                              </Box>
                            )}
                            {visit.bookingAdvanceAmount && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Advance Amount</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                  ₹{visit.bookingAdvanceAmount?.toLocaleString()}
                                </Typography>
                              </Box>
                            )}
                            {visit.bookingFromTrial && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Booking From Trial</Typography>
                                <Chip label="Yes" color="success" size="small" />
                              </Box>
                            )}
                            {visit.bookingFromVisitId && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Related Visit</Typography>
                                <Typography variant="body1">{visit.bookingFromVisitId}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    )}

                    {/* Accessory Details */}
                    {visit.accessory && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#9c27b0', 0.05), border: 1, borderColor: alpha('#9c27b0', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'secondary.main', fontWeight: 600 }}>
                            Accessory Details
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.accessoryName && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Accessory Name</Typography>
                                <Typography variant="body1">{visit.accessoryName}</Typography>
                              </Box>
                            )}
                            {visit.accessoryDetails && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Details</Typography>
                                <Typography variant="body1">{visit.accessoryDetails}</Typography>
                              </Box>
                            )}
                            {visit.accessoryQuantity && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Quantity</Typography>
                                <Typography variant="body1">{visit.accessoryQuantity}</Typography>
                              </Box>
                            )}
                            {visit.accessoryFOC !== undefined && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Free of Cost</Typography>
                                <Chip 
                                  label={visit.accessoryFOC ? 'Yes' : 'No'} 
                                  color={visit.accessoryFOC ? 'success' : 'default'}
                                  size="small" 
                                />
                              </Box>
                            )}
                            {visit.accessoryAmount > 0 && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Amount</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                                  ₹{visit.accessoryAmount?.toLocaleString()}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    )}

                    {/* Programming Details */}
                    {visit.programming && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#607d8b', 0.05), border: 1, borderColor: alpha('#607d8b', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
                            Programming Details
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.programmingReason && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Programming Reason</Typography>
                                <Typography variant="body1">{visit.programmingReason}</Typography>
                              </Box>
                            )}
                            {visit.hearingAidPurchaseDate && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Hearing Aid Purchase Date</Typography>
                                <Typography variant="body1">{visit.hearingAidPurchaseDate}</Typography>
                              </Box>
                            )}
                            {visit.hearingAidName && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Hearing Aid Name</Typography>
                                <Typography variant="body1">{visit.hearingAidName}</Typography>
                              </Box>
                            )}
                            {visit.underWarranty !== undefined && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Under Warranty</Typography>
                                <Chip 
                                  label={visit.underWarranty ? 'Yes' : 'No'} 
                                  color={visit.underWarranty ? 'success' : 'warning'}
                                  size="small" 
                                />
                              </Box>
                            )}
                            {visit.programmingAmount > 0 && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Programming Amount</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  ₹{visit.programmingAmount?.toLocaleString()}
                                </Typography>
                              </Box>
                            )}
                            {visit.programmingDoneBy && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Programming Done By</Typography>
                                <Typography variant="body1">{visit.programmingDoneBy}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    )}

                    {/* Journey Tracking Details */}
                    {(visit.hearingAidJourneyId || visit.previousVisitId || visit.nextVisitId) && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#795548', 0.05), border: 1, borderColor: alpha('#795548', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
                            Journey Tracking
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.hearingAidJourneyId && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Journey ID</Typography>
                                <Typography variant="body1">{visit.hearingAidJourneyId}</Typography>
                              </Box>
                            )}
                            {visit.journeyStage && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Journey Stage</Typography>
                                <Chip label={visit.journeyStage} color="info" size="small" />
                              </Box>
                            )}
                            {visit.previousVisitId && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Previous Visit</Typography>
                                <Typography variant="body1">{visit.previousVisitId}</Typography>
                              </Box>
                            )}
                            {visit.nextVisitId && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Next Visit</Typography>
                                <Typography variant="body1">{visit.nextVisitId}</Typography>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    )}

                    {/* Repair Service Details */}
                    {visit.repair && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#f44336', 0.05), border: 1, borderColor: alpha('#f44336', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'error.main', fontWeight: 600 }}>
                            Repair Service Details
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.repairReason && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Repair Reason</Typography>
                                <Typography variant="body1">{visit.repairReason}</Typography>
                              </Box>
                            )}
                            {visit.repairType && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Repair Type</Typography>
                                <Typography variant="body1">{visit.repairType}</Typography>
                              </Box>
                            )}
                            {visit.repairStatus && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Repair Status</Typography>
                                <Chip 
                                  label={visit.repairStatus}
                                  color={
                                    visit.repairStatus === 'completed' ? 'success' :
                                    visit.repairStatus === 'in_progress' ? 'warning' :
                                    visit.repairStatus === 'pending' ? 'info' :
                                    'default'
                                  }
                                  size="small"
                                />
                              </Box>
                            )}
                            {visit.repairAmount !== undefined && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Repair Amount</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'error.main' }}>
                                  {visit.repairAmount > 0 ? `₹${visit.repairAmount?.toLocaleString()}` : 'Free'}
                                </Typography>
                              </Box>
                            )}
                            {visit.repairCompletedBy && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Repair Done By</Typography>
                                <Typography variant="body1">{visit.repairCompletedBy}</Typography>
                              </Box>
                            )}
                            {visit.repairCompletedDate && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Repair Completed Date</Typography>
                                <Typography variant="body1">{visit.repairCompletedDate}</Typography>
                              </Box>
                            )}
                            {visit.warrantyStatus && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Warranty Status</Typography>
                                <Chip 
                                  label={visit.warrantyStatus}
                                  color={visit.warrantyStatus === 'under_warranty' ? 'success' : 'warning'}
                                  size="small"
                                />
                              </Box>
                            )}
                          </Box>
                          {visit.repairNotes && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Repair Notes</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.repairNotes}</Typography>
                            </Box>
                          )}
                          {visit.repairDescription && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Repair Description</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.repairDescription}</Typography>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    )}

                    {/* Counselling Service Details */}
                    {visit.counselling && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#3f51b5', 0.05), border: 1, borderColor: alpha('#3f51b5', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
                            Counselling Service Details
                          </Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                            {visit.counsellingType && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Counselling Type</Typography>
                                <Typography variant="body1">{visit.counsellingType}</Typography>
                              </Box>
                            )}
                            {visit.counsellingDoneBy && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Counselling Done By</Typography>
                                <Typography variant="body1">{visit.counsellingDoneBy}</Typography>
                              </Box>
                            )}
                            {visit.counsellingDuration && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Duration</Typography>
                                <Typography variant="body1">{visit.counsellingDuration} minutes</Typography>
                              </Box>
                            )}
                            {visit.counsellingAmount !== undefined && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Counselling Amount</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                  {visit.counsellingAmount > 0 ? `₹${visit.counsellingAmount?.toLocaleString()}` : 'Free'}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                          {visit.counsellingNotes && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Counselling Notes</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.counsellingNotes}</Typography>
                            </Box>
                          )}
                          {visit.counsellingTopics && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Topics Discussed</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.counsellingTopics}</Typography>
                            </Box>
                          )}
                          {visit.counsellingRecommendations && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary">Counselling Recommendations</Typography>
                              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{visit.counsellingRecommendations}</Typography>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    )}
                    
                    {/* Hearing Aid Details */}
                    {visit.services?.hearingAid && visit.hearingAidDetails && (
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Paper sx={{ p: 2, bgcolor: alpha('#4caf50', 0.05), border: 1, borderColor: alpha('#4caf50', 0.2) }}>
                          <Typography variant="subtitle1" sx={{ mb: 2, color: 'success.main', fontWeight: 600 }}>
                            Hearing Aid Details
                          </Typography>
                          
                          {/* Pre-sales Information */}
                          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
                            <Box>
                              <Typography variant="body2" color="text.secondary">Hearing Aid Suggested</Typography>
                              <Typography variant="body1">{visit.hearingAidDetails.hearingAidSuggested || 'Not specified'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">Quotation</Typography>
                              <Typography variant="body1">{visit.hearingAidDetails.quotation || 'Not provided'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">Trial Given</Typography>
                              <Typography variant="body1">
                                {visit.hearingAidDetails.hearingAidGivenForTrial ? 'Yes' : 'No'}
                                {visit.hearingAidDetails.hearingAidGivenForTrial && visit.hearingAidDetails.trialPeriod && 
                                  ` (${visit.hearingAidDetails.trialPeriod})`
                                }
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">Which Ear</Typography>
                              <Typography variant="body1">{visit.hearingAidDetails.whichEar}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">Who Sold</Typography>
                              <Typography variant="body1">{visit.hearingAidDetails.whoSold || 'Not specified'}</Typography>
                            </Box>
                            <Box>
                              <Typography variant="body2" color="text.secondary">Status</Typography>
                              <Chip 
                                label={visit.hearingAidDetails.hearingAidStatus} 
                                color={
                                  visit.hearingAidDetails.hearingAidStatus === 'sold' ? 'success' :
                                  visit.hearingAidDetails.hearingAidStatus === 'booked' ? 'warning' :
                                  'default'
                                }
                                size="small"
                              />
                            </Box>
                            {visit.hearingAidDetails.hearingAidStatus === 'booked' && visit.hearingAidDetails.bookingAmount > 0 && (
                              <Box>
                                <Typography variant="body2" color="text.secondary">Booking Amount</Typography>
                                <Typography variant="body1">₹{visit.hearingAidDetails.bookingAmount}</Typography>
                              </Box>
                          )}
                          </Box>

                          {/* Products Table */}
                          {visit.hearingAidDetails.products && visit.hearingAidDetails.products.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>Products</Typography>
                              <TableContainer component={Paper} sx={{ mb: 2 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Product</TableCell>
                                      <TableCell>Serial No.</TableCell>
                                      <TableCell>Unit</TableCell>
                                      <TableCell>Warranty</TableCell>
                                      <TableCell align="right">MRP</TableCell>
                                      <TableCell align="right">Selling Price</TableCell>
                                      <TableCell align="right">Final Amount</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {visit.hearingAidDetails.products.map((product: any, pIndex: number) => (
                                      <TableRow key={product.id || pIndex}>
                                        <TableCell>{product.name}</TableCell>
                                        <TableCell>{product.serialNumber}</TableCell>
                                        <TableCell>{product.unit}</TableCell>
                                        <TableCell>{product.warranty}</TableCell>
                                        <TableCell align="right">₹{product.mrp}</TableCell>
                                        <TableCell align="right">₹{product.sellingPrice}</TableCell>
                                        <TableCell align="right">₹{product.finalAmount?.toFixed(2) || 0}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Box>
                          )}

                          {/* Sales Summary */}
                          {visit.hearingAidDetails.salesAfterTax > 0 && (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
                              <Box>
                                <Typography variant="body2" color="text.secondary">Gross MRP</Typography>
                                <Typography variant="body1" fontWeight="medium">₹{visit.hearingAidDetails.grossMRP}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="body2" color="text.secondary">Sales Before Tax</Typography>
                                <Typography variant="body1" fontWeight="medium">₹{visit.hearingAidDetails.grossSalesBeforeTax}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="body2" color="text.secondary">Tax Amount</Typography>
                                <Typography variant="body1" fontWeight="medium">₹{visit.hearingAidDetails.taxAmount}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="body2" color="text.secondary">Total Sales</Typography>
                                <Typography variant="h6" color="success.main">₹{visit.hearingAidDetails.salesAfterTax}</Typography>
                              </Box>
                            </Box>
                          )}
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default' }}>
              <Typography color="text.secondary">No visits recorded yet.</Typography>
            </Box>
          )}
        </StyledFormSection>

        {/* Payment Records Section */}
        {enquiry.paymentRecords && enquiry.paymentRecords.length > 0 && (
          <StyledFormSection>
            <FormSectionTitle variant="subtitle1" sx={{ color: '#e65100' }}>
              <CurrencyRupeeIcon sx={{ color: '#f57c00' }} /> Payment Records
            </FormSectionTitle>
            
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead sx={{ bgcolor: '#fff3e0' }}>
                  <TableRow>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Payment Type</TableCell>
                    <TableCell align="right" sx={{ color: '#e65100', fontWeight: 'bold' }}>Amount</TableCell>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Method</TableCell>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Transaction ID</TableCell>
                    <TableCell sx={{ color: '#e65100', fontWeight: 'bold' }}>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {enquiry.paymentRecords.map((payment: any, index: number) => (
                    <TableRow key={payment.id || index}>
                      <TableCell>
                        <Chip 
                          label={
                            payment.paymentType === 'hearing_aid_test' ? 'Hearing Aid Test' :
                            payment.paymentType === 'hearing_aid_booking' ? 'Hearing Aid Booking' :
                            'Hearing Aid Sale'
                          }
                          color={
                            payment.paymentType === 'hearing_aid_test' ? 'info' :
                            payment.paymentType === 'hearing_aid_booking' ? 'warning' :
                            'success'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          ₹{payment.amount?.toLocaleString('en-IN') || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>{payment.paymentDate}</TableCell>
                      <TableCell>
                        <Chip label={payment.paymentMethod?.toUpperCase() || 'N/A'} variant="outlined" size="small" />
                      </TableCell>
                      <TableCell>{payment.transactionId || '-'}</TableCell>
                      <TableCell>{payment.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 2, p: 2, bgcolor: alpha('#f57c00', 0.1), borderRadius: 1, border: 1, borderColor: alpha('#f57c00', 0.3) }}>
              <Typography variant="h6" sx={{ color: '#e65100', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalculateIcon />
                Total Payments: ₹{enquiry.paymentRecords.reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0).toLocaleString('en-IN')}
              </Typography>
            </Box>
          </StyledFormSection>
        )}
      </Paper>
    </Box>
  );
} 