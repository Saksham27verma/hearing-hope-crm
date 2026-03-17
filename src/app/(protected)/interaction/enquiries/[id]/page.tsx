'use client';

import React, { useState, useEffect } from 'react';
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
  Tab
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
  CalendarMonth as CalendarIcon
} from '@mui/icons-material';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import {
  openBookingReceiptPDF,
  downloadBookingReceiptPDF,
  openTrialReceiptPDF,
  downloadTrialReceiptPDF,
} from '@/utils/receiptGenerator';
import { getEnquiryStatusMeta } from '@/utils/enquiryStatus';
import { db } from '@/firebase/config';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import PureToneAudiogram from '@/components/enquiries/PureToneAudiogram';
import RefreshDataButton from '@/components/common/RefreshDataButton';

const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

const PageShell = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `
    radial-gradient(circle at top left, rgba(245,124,0,0.10), transparent 28%),
    radial-gradient(circle at top right, rgba(255,193,7,0.10), transparent 24%),
    linear-gradient(180deg, #fffaf5 0%, #f7f8fb 38%, #f5f7fb 100%)
  `,
  padding: theme.spacing(3),
}));

const InfoCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: theme.spacing(2.25),
  boxShadow: '0 16px 42px rgba(15, 23, 42, 0.06)',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  background: 'rgba(255,255,255,0.92)',
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
        sx={{
          width: 38,
          height: 38,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha('#f57c00', 0.1),
          color: '#f57c00',
          border: `1px solid ${alpha('#f57c00', 0.18)}`,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
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
    sx={{
      p: 2,
      borderRadius: 2.25,
      bgcolor: alpha(accent, 0.04),
      borderColor: alpha(accent, 0.15),
      boxShadow: 'none',
    }}
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
        sx={{
          color: '#f57c00',
          mt: 0.2,
          width: 34,
          height: 34,
          borderRadius: 1.75,
          display: 'grid',
          placeItems: 'center',
          bgcolor: alpha('#f57c00', 0.08),
          border: `1px solid ${alpha('#f57c00', 0.12)}`,
          flexShrink: 0,
        }}
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
                  sx={{ borderRadius: 1.5, bgcolor: alpha('#f57c00', 0.04) }}
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
  const { userProfile, loading: authLoading } = useAuth();
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [activeVisitTab, setActiveVisitTab] = useState(0);

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

  const handleRefresh = async () => {
    if (!resolvedParams || refreshing) return;
    try {
      setRefreshing(true);
      await Promise.all([fetchEnquiry(resolvedParams.id), fetchCenters()]);
    } finally {
      setRefreshing(false);
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
    fetchCenters();
  }, []);
  
  const visits = enquiry?.visits || enquiry?.visitSchedules || [];
  const hasVisits = visits.length > 0;
  const hasFollowUps = enquiry?.followUps && enquiry.followUps.length > 0;
  const paymentEntries = Array.isArray(enquiry?.paymentRecords) && enquiry.paymentRecords.length > 0
    ? enquiry.paymentRecords.map((payment: any) => ({
        label:
          payment.paymentType === 'hearing_aid_test' ? 'Test' :
          payment.paymentType === 'hearing_aid_booking' ? 'Booking' :
          payment.paymentType === 'hearing_aid_sale' ? 'Sale' :
          payment.paymentType || 'Payment',
        amount: Number(payment.amount || 0),
        date: payment.paymentDate,
        mode: payment.paymentMethod,
      }))
    : Array.isArray(enquiry?.payments)
      ? enquiry.payments.map((payment: any) => ({
          label:
            payment.paymentFor === 'hearing_test' ? 'Test' :
            payment.paymentFor === 'booking_advance' ? 'Booking' :
            payment.paymentFor === 'hearing_aid' ? 'Hearing Aid' :
            payment.paymentFor === 'accessory' ? 'Accessory' :
            payment.paymentFor === 'full_payment' ? 'Full Payment' :
            payment.paymentFor === 'partial_payment' ? 'Partial Payment' :
            payment.paymentFor || 'Payment',
          amount: Number(payment.amount || 0),
          date: payment.paymentDate,
          mode: payment.paymentMode,
        }))
      : [];
  const hasPayments = paymentEntries.length > 0 || Boolean(enquiry?.financialSummary);
  
  // Receipt data
  const bookingReceipts = visits
    .map((visit: any, index: number) => ({ visit, index }))
    .filter(({ visit }: { visit: any }) => visit.hearingAidBooked || (Number(visit.bookingAdvanceAmount) > 0));
  const trialReceipts = visits
    .map((visit: any, index: number) => ({ visit, index }))
    .filter(({ visit }: { visit: any }) => visit.trialGiven || visit.hearingAidTrial);
  const hasReceipts = bookingReceipts.length > 0 || trialReceipts.length > 0;

  const getCenterName = (visit?: any) => {
    const centerId = visit?.centerId || enquiry.visitingCenter;
    return centerId ? (centers.find(c => c.id === centerId)?.name) || undefined : undefined;
  };

  const hasValue = (value: any) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return value !== 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return Boolean(value);
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
    if (visit.hearingAidTrial || visit.trialGiven) services.push({ label: 'Trial', color: 'warning' });
    if (visit.hearingAidBooked || hasValue(visit.bookingAdvanceAmount)) services.push({ label: 'Booking', color: 'primary' });
    if (visit.hearingAidSale || visit.purchaseFromTrial) services.push({ label: 'Sale', color: 'success' });
    if (visit.accessory) services.push({ label: 'Accessory', color: 'secondary' });
    if (visit.programming) services.push({ label: 'Programming', color: 'default' });
    if (visit.repair) services.push({ label: 'Repair', color: 'error' });
    if (visit.counselling) services.push({ label: 'Counselling', color: 'default' });
    return services;
  };

  const getBookingTotal = (visit: any) =>
    (Number(visit?.bookingSellingPrice) || 0) * (Number(visit?.bookingQuantity) || 1);

  const calculateDerivedTotalDue = () => {
    let total = 0;
    visits.forEach((visit: any) => {
      if (visit.hearingTest && Number(visit.testPrice) > 0) {
        total += Number(visit.testPrice) || 0;
      }
      if (visit.hearingAidBooked && !visit.hearingAidSale) {
        total += getBookingTotal(visit);
      } else if (visit.hearingAidSale || visit.purchaseFromTrial) {
        total += Number(visit.salesAfterTax) || 0;
      }
      if (visit.accessory && !visit.accessoryFOC) {
        total += (Number(visit.accessoryAmount) || 0) * (Number(visit.accessoryQuantity) || 1);
      }
      if (visit.programming) {
        total += Number(visit.programmingAmount) || 0;
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
  const journeyStatus = getEnquiryStatusMeta(enquiry);

  const getVisitAmount = (visit: any) => {
    if (!visit) return undefined;
    if (visit.hearingAidBooked && !visit.hearingAidSale) {
      return getBookingTotal(visit) || visit.bookingAdvanceAmount || visit.hearingAidPrice;
    }
    if (visit.hearingAidSale || visit.purchaseFromTrial) {
      return visit.salesAfterTax || visit.hearingAidPrice;
    }
    return (
      visit.totalVisitAmount ||
      visit.accessoryAmount ||
      visit.programmingAmount ||
      visit.repairAmount ||
      visit.counsellingAmount ||
      visit.testPrice
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
          sx={{
            borderRadius: 99,
            borderColor: alpha('#0f172a', 0.12),
            color: 'text.primary',
            bgcolor: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(10px)',
          }}
        >
          Back to Enquiries
        </Button>
        
        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
          <RefreshDataButton
            onClick={handleRefresh}
            loading={refreshing}
            sx={{
              borderRadius: 99,
              bgcolor: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(10px)',
            }}
          />
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
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 40%, #fffdf8 100%)',
          border: '1px solid rgba(245,124,0,0.14)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(circle at 10% 10%, rgba(245,124,0,0.16), transparent 30%),
              radial-gradient(circle at 88% 16%, rgba(255,193,7,0.12), transparent 24%)
            `,
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          <Avatar sx={{ bgcolor: '#f57c00', width: 76, height: 76, boxShadow: '0 16px 32px rgba(245,124,0,0.24)' }}>
            <PersonIcon sx={{ fontSize: 38 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <SectionLabel>Patient Profile</SectionLabel>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
              {enquiry.name || 'Patient Name'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
              Clean patient profile with enquiry, visit, receipt, and payment context in one place.
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {enquiry.phone && userProfile?.role !== 'audiologist' && (
                <Chip 
                  icon={<PhoneIcon />} 
                  label={enquiry.phone} 
                  variant="outlined" 
                  size="small"
                  sx={{ borderRadius: 99, bgcolor: 'rgba(255,255,255,0.75)' }}
                />
              )}
              {enquiry.email && (
                <Chip 
                  icon={<EmailIcon />} 
                  label={enquiry.email} 
                  variant="outlined" 
                  size="small"
                  sx={{ borderRadius: 99, bgcolor: 'rgba(255,255,255,0.75)' }}
                />
              )}
              <Chip
                label={journeyStatus.label}
                color={journeyStatus.color}
                size="small"
                sx={{ borderRadius: 99, fontWeight: 700 }}
              />
            </Stack>
          </Box>

          <Grid container spacing={1.5} sx={{ width: { xs: '100%', md: 320 }, m: 0 }}>
            <Grid item xs={6}>
              <MetricCard label="Created" value={enquiry.createdAt ? new Date(enquiry.createdAt.seconds * 1000).toLocaleDateString() : '—'} />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Visits" value={String(visits.length)} accent="#0ea5e9" />
            </Grid>
            <Grid item xs={6}>
              <MetricCard label="Calls" value={String(enquiry.followUps?.length || 0)} accent="#7c3aed" />
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
                      sx={{
                        p: 2,
                        borderRadius: 2.25,
                        bgcolor: alpha('#0f172a', 0.015),
                        borderColor: alpha('#0f172a', 0.08),
                      }}
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
                  sx={{
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
                      borderColor: alpha('#0f172a', 0.08),
                      bgcolor: 'rgba(255,255,255,0.78)',
                    },
                    '& .Mui-selected': {
                      bgcolor: 'linear-gradient(135deg, #fff4e8 0%, #fff 100%)',
                      borderColor: alpha('#f57c00', 0.35),
                      boxShadow: '0 10px 24px rgba(245,124,0,0.10)',
                    },
                    '& .MuiTabs-indicator': {
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: '#f57c00',
                    },
                  }}
                >
                  {visits.map((visit: any, index: number) => (
                    <Tab
                      key={visit.id || index}
                      label={
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
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
                      sx={{
                        p: { xs: 2, md: 2.5 },
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.8)',
                        borderColor: alpha('#f57c00', 0.16),
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
                      }}
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
                            <Grid item xs={12} sm={6}>
                              {renderVisitField('Center', getCenterName(activeVisit))}
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
                        hasValue(activeVisit.testType) ||
                        hasValue(activeVisit.testDoneBy) ||
                        hasValue(activeVisit.testResults) ||
                        hasValue(activeVisit.recommendations) ||
                        activeVisitAudiogramData) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)', borderColor: alpha('#0ea5e9', 0.14) }}>
                          <SectionHeading icon={<MedicalServicesIcon fontSize="small" />} title="Hearing Test" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Test Type', activeVisit.testType)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Done By', activeVisit.testDoneBy)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Price', formatCurrency(activeVisit.testPrice))}</Grid>
                            <Grid item xs={12}>{renderVisitField('Results', activeVisit.testResults)}</Grid>
                            <Grid item xs={12}>{renderVisitField('Recommendations', activeVisit.recommendations)}</Grid>
                          </Grid>
                          {activeVisitAudiogramData && (
                            <Box sx={{ mt: 3 }}>
                              <PureToneAudiogram
                                data={activeVisitAudiogramData}
                                onChange={() => {}}
                                editable={false}
                                readOnly={true}
                              />
                            </Box>
                          )}
                        </Paper>
                      )}

                      {(activeVisit.trialGiven ||
                        activeVisit.hearingAidTrial ||
                        hasValue(activeVisit.trialStartDate) ||
                        hasValue(activeVisit.trialHearingAidBrand) ||
                        hasValue(activeVisit.trialHearingAidModel) ||
                        hasValue(activeVisit.trialSerialNumber)) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)', borderColor: alpha('#f59e0b', 0.18) }}>
                          <SectionHeading icon={<HearingIcon fontSize="small" />} title="Trial Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Brand', activeVisit.trialHearingAidBrand || activeVisit.hearingAidBrand)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Model', activeVisit.trialHearingAidModel || activeVisit.hearingAidModel)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Type', activeVisit.trialHearingAidType || activeVisit.hearingAidType)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Serial Number', activeVisit.trialSerialNumber)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Ear', activeVisit.whichEar)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Duration', hasValue(activeVisit.trialDuration) ? `${activeVisit.trialDuration} days` : undefined)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Start Date', activeVisit.trialStartDate)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('End Date', activeVisit.trialEndDate)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Result', activeVisit.trialResult)}</Grid>
                            <Grid item xs={12}>{renderVisitField('Notes', activeVisit.trialNotes)}</Grid>
                          </Grid>
                        </Paper>
                      )}

                      {(activeVisit.hearingAidBooked ||
                        hasValue(activeVisit.bookingAdvanceAmount) ||
                        hasValue(activeVisit.bookingDate) ||
                        hasValue(activeVisit.bookingSellingPrice) ||
                        hasValue(activeVisit.bookingQuantity) ||
                        hasValue(activeVisit.hearingAidBrand) ||
                        hasValue(activeVisit.hearingAidModel)) && (
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)', borderColor: alpha('#6366f1', 0.14) }}>
                          <SectionHeading icon={<ReceiptIcon fontSize="small" />} title="Booking Details" />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Brand', activeVisit.hearingAidBrand)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Device Model', activeVisit.hearingAidModel)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Type', activeVisit.hearingAidType)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Ear', activeVisit.whichEar)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Booking Date', activeVisit.bookingDate)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Advance Amount', formatCurrency(activeVisit.bookingAdvanceAmount))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Selling Price', formatCurrency(activeVisit.bookingSellingPrice))}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('Quantity', hasValue(activeVisit.bookingQuantity) ? String(activeVisit.bookingQuantity) : undefined)}</Grid>
                            <Grid item xs={12} sm={6}>{renderVisitField('MRP', formatCurrency(activeVisit.hearingAidPrice))}</Grid>
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
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)', borderColor: alpha('#16a34a', 0.15) }}>
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
                                    <TableCell sx={{ fontWeight: 700 }}>Serial</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>Price</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {activeVisit.products.map((product: any, productIndex: number) => (
                                    <TableRow key={product.id || productIndex}>
                                      <TableCell>{product.name || product.productName || '—'}</TableCell>
                                      <TableCell>{product.serialNumber || '—'}</TableCell>
                                      <TableCell align="right">
                                        {formatCurrency(product.finalAmount || product.sellingPrice || product.mrp) || '—'}
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
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)' }}>
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
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)' }}>
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
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)' }}>
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
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)' }}>
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
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.84)' }}>
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

          {/* Call History */}
          {hasFollowUps && (
            <InfoCard>
              <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
                <SectionHeading icon={<PhoneIcon fontSize="small" />} title="Call History" subtitle={`${enquiry.followUps.length} follow-up entries`} />
                
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
                      {enquiry.followUps.map((followUp: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(followUp.date).toLocaleDateString()}</TableCell>
                          <TableCell>{followUp.remarks}</TableCell>
                          <TableCell>{followUp.nextFollowUpDate ? new Date(followUp.nextFollowUpDate).toLocaleDateString() : '—'}</TableCell>
                          <TableCell>{followUp.callerName || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </InfoCard>
          )}
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
                <SectionHeading icon={<ReceiptIcon fontSize="small" />} title="Receipts" subtitle="Quick access to patient documents" />
                
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
                        MRP: {visit.hearingAidPrice ? `₹${Number(visit.hearingAidPrice).toLocaleString('en-IN')}` : '—'}
                        {' · '}
                        Qty: {Number(visit.bookingQuantity) || 1}
                        {' · '}
                        Balance: {visit.bookingSellingPrice ? `₹${Math.max(((Number(visit.bookingSellingPrice) || 0) * (Number(visit.bookingQuantity) || 1)) - Number(visit.bookingAdvanceAmount || 0), 0).toLocaleString('en-IN')}` : '—'}
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
                        {(visit.trialHearingAidType === 'home' || visit.visitType === 'home') ? 'Home Trial' : 'Clinic Trial'}
                        {visit.trialDuration ? ` · ${visit.trialDuration} days` : ''}
                        {(visit.trialHearingAidType === 'home' || visit.visitType === 'home') && visit.trialSerialNumber ? ` · ${visit.trialSerialNumber}` : ''}
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
                      key={index}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2.25,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 2,
                        bgcolor: 'rgba(255,255,255,0.8)',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {payment.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {payment.date || '—'}{payment.mode ? ` · ${String(payment.mode).toUpperCase()}` : ''}
                        </Typography>
                      </Box>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: '#0f766e' }}>
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
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.8)' }}>
                  <Typography variant="body2" color="text.secondary">Total Visits</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{visits.length}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.8)' }}>
                  <Typography variant="body2" color="text.secondary">Follow-up Calls</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{enquiry.followUps?.length || 0}</Typography>
                </Paper>
                {enquiry.followUpDate && (
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.8)' }}>
                    <Typography variant="body2" color="text.secondary">Next Follow-up</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {new Date(enquiry.followUpDate).toLocaleDateString()}
                    </Typography>
                  </Paper>
                )}
                
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25, display: 'flex', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.8)' }}>
                  <Typography variant="body2" color="text.secondary">Last Updated</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {enquiry.updatedAt ? new Date(enquiry.updatedAt.seconds * 1000).toLocaleDateString() : 'Never'}
                  </Typography>
                </Paper>
              </Stack>
            </CardContent>
          </InfoCard>
          </Box>
        </Grid>
      </Grid>
      </Box>
    </PageShell>
  );
}