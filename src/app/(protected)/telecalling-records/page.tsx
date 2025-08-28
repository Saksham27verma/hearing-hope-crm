'use client'

import React, { useState, useEffect, useMemo } from 'react';
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
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Schedule as ScheduleIcon,
  Notes as NotesIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { format, parseISO, isWithinInterval } from 'date-fns';

interface FollowUp {
  id: string;
  date: string;
  remarks: string;
  nextFollowUpDate: string;
  callerName: string;
  createdAt?: {
    seconds: number;
    nanoseconds: number;
  };
}

interface Enquiry {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  subject?: string;
  status?: string;
  assignedTo?: string;
  telecaller?: string;
  followUps: FollowUp[];
}

interface TelecallingRecord {
  id: string;
  enquiryId: string;
  enquiryName: string;
  enquiryPhone: string;
  enquiryEmail?: string;
  enquirySubject?: string;
  assignedTo?: string;
  followUpId: string;
  followUpDate: string;
  telecaller: string;
  remarks: string;
  nextFollowUpDate: string;
  createdAt: Date;
}

export default function TelecallingRecordsPage() {
  const [records, setRecords] = useState<TelecallingRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<TelecallingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTelecaller, setSelectedTelecaller] = useState('');
  const [followUpDateFrom, setFollowUpDateFrom] = useState<Date | null>(null);
  const [followUpDateTo, setFollowUpDateTo] = useState<Date | null>(null);
  const [nextFollowUpDateFrom, setNextFollowUpDateFrom] = useState<Date | null>(null);
  const [nextFollowUpDateTo, setNextFollowUpDateTo] = useState<Date | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Fetch data
  const fetchTelecallingRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      // console.log('Fetching telecalling records...');

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

      enquiriesSnapshot.forEach((doc) => {
        try {
          const enquiryData = doc.data() as Enquiry;
          const enquiryId = doc.id;

          // console.log(`Processing enquiry ${enquiryId}:`, {
          //   name: enquiryData.name,
          //   followUpsCount: enquiryData.followUps?.length || 0
          // });

          if (enquiryData.followUps && Array.isArray(enquiryData.followUps) && enquiryData.followUps.length > 0) {
            enquiryData.followUps.forEach((followUp, index) => {
              try {
                // Handle different timestamp formats
                let createdAtDate = new Date();
                if (followUp.createdAt) {
                  if (typeof followUp.createdAt === 'object' && 'seconds' in followUp.createdAt) {
                    createdAtDate = new Date(followUp.createdAt.seconds * 1000);
                  } else {
                    // Handle other timestamp formats
                    createdAtDate = new Date(followUp.createdAt as any);
                  }
                }

                const record: TelecallingRecord = {
                  id: `${enquiryId}_${followUp.id || index}`,
                  enquiryId,
                  enquiryName: enquiryData.name || 'Unknown',
                  enquiryPhone: enquiryData.phone || '',
                  enquiryEmail: enquiryData.email || '',
                  enquirySubject: enquiryData.subject || '',
                  assignedTo: enquiryData.assignedTo || '',
                  followUpId: followUp.id || `followup_${index}`,
                  followUpDate: followUp.date || '',
                  telecaller: followUp.callerName || 'Unknown',
                  remarks: followUp.remarks || '',
                  nextFollowUpDate: followUp.nextFollowUpDate || '',
                  createdAt: createdAtDate
                };

                allRecords.push(record);
                // console.log(`Added follow-up record:`, record);
              } catch (followUpError) {
                console.error(`Error processing follow-up ${index} for enquiry ${enquiryId}:`, followUpError);
              }
            });
          }
        } catch (docError) {
          console.error(`Error processing enquiry document ${doc.id}:`, docError);
        }
      });

      // console.log(`Total records processed: ${allRecords.length}`);

      // Sort by created date (most recent first)
      allRecords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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
          try {
            const recordDate = parseISO(dateRange.type === 'followUp' ? record.followUpDate : record.nextFollowUpDate);
            const startOfDay = new Date(dateRange.from);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(dateRange.to);
            endOfDay.setHours(23, 59, 59, 999);
            return isWithinInterval(recordDate, { start: startOfDay, end: endOfDay });
          } catch {
            return false;
          }
        });
      }
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        record.enquiryName.toLowerCase().includes(term) ||
        record.enquiryPhone.includes(term) ||
        record.telecaller.toLowerCase().includes(term) ||
        record.remarks.toLowerCase().includes(term) ||
        record.enquirySubject?.toLowerCase().includes(term) ||
        record.enquiryEmail?.toLowerCase().includes(term)
      );
    }

    // Telecaller filter
    if (selectedTelecaller) {
      filtered = filtered.filter(record => record.telecaller === selectedTelecaller);
    }

    // Follow-up date range filter (only if not using quick filter)
    if (!quickFilter && (followUpDateFrom || followUpDateTo)) {
      filtered = filtered.filter(record => {
        try {
          const recordDate = parseISO(record.followUpDate);
          if (followUpDateFrom && followUpDateTo) {
            return isWithinInterval(recordDate, { start: followUpDateFrom, end: followUpDateTo });
          } else if (followUpDateFrom) {
            return recordDate >= followUpDateFrom;
          } else if (followUpDateTo) {
            return recordDate <= followUpDateTo;
          }
          return true;
        } catch {
          return true;
        }
      });
    }

    // Next follow-up date range filter (only if not using quick filter)
    if (!quickFilter && (nextFollowUpDateFrom || nextFollowUpDateTo)) {
      filtered = filtered.filter(record => {
        try {
          const recordDate = parseISO(record.nextFollowUpDate);
          if (nextFollowUpDateFrom && nextFollowUpDateTo) {
            return isWithinInterval(recordDate, { start: nextFollowUpDateFrom, end: nextFollowUpDateTo });
          } else if (nextFollowUpDateFrom) {
            return recordDate >= nextFollowUpDateFrom;
          } else if (nextFollowUpDateTo) {
            return recordDate <= nextFollowUpDateTo;
          }
          return true;
        } catch {
          return true;
        }
      });
    }

    setFilteredRecords(filtered);
    setPage(0); // Reset to first page when filters change
  }, [records, searchTerm, selectedTelecaller, quickFilter, followUpDateFrom, followUpDateTo, nextFollowUpDateFrom, nextFollowUpDateTo]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedTelecaller('');
    setQuickFilter('');
    setFollowUpDateFrom(null);
    setFollowUpDateTo(null);
    setNextFollowUpDateFrom(null);
    setNextFollowUpDateTo(null);
  };

  // Quick filter options
  const quickFilterOptions = [
    { label: 'All Calls', value: '', color: 'default' },
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
    try {
      return format(parseISO(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  // Format datetime
  const formatDateTime = (date: Date) => {
    return format(date, 'dd MMM yyyy HH:mm');
  };

  // Paginated records
  const paginatedRecords = filteredRecords.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Telecalling Records
            </Typography>
            <Typography variant="body1" color="text.secondary">
              View and filter all follow-up calls made to enquiries
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchTelecallingRecords}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
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
              <li>Follow-ups exist but don't have the expected data structure</li>
              <li>Database connection issues</li>
            </ul>
          </Alert>
        )}

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <PhoneIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" component="div">
                      {filteredRecords.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Calls
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main' }}>
                    <PersonIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" component="div">
                      {uniqueTelecallers.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Telecallers
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CalendarIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" component="div">
                      {filteredRecords.filter(r => {
                        try {
                          const nextDate = parseISO(r.nextFollowUpDate);
                          const today = new Date();
                          return nextDate.toDateString() === today.toDateString();
                        } catch { return false; }
                      }).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Due Today
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <ScheduleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" component="div">
                      {filteredRecords.filter(r => {
                        try {
                          const nextDate = parseISO(r.nextFollowUpDate);
                          const today = new Date();
                          return nextDate < today;
                        } catch { return false; }
                      }).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overdue
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Quick Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Quick Filters
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {quickFilterOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                color={quickFilter === option.value ? option.color as any : 'default'}
                variant={quickFilter === option.value ? 'filled' : 'outlined'}
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
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Advanced Filters
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                onClick={clearFilters}
                disabled={!searchTerm && !selectedTelecaller && !quickFilter && !followUpDateFrom && !followUpDateTo && !nextFollowUpDateFrom && !nextFollowUpDateTo}
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
            placeholder="Search by name, phone, telecaller, remarks, or subject..."
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
                <DatePicker
                  label="Follow-up Date From"
                  value={followUpDateFrom}
                  onChange={(newValue) => setFollowUpDateFrom(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Follow-up Date To"
                  value={followUpDateTo}
                  onChange={(newValue) => setFollowUpDateTo(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Next Follow-up From"
                  value={nextFollowUpDateFrom}
                  onChange={(newValue) => setNextFollowUpDateFrom(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Next Follow-up To"
                  value={nextFollowUpDateTo}
                  onChange={(newValue) => setNextFollowUpDateTo(newValue)}
                  slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                />
              </Grid>
            </Grid>
          </Collapse>
        </Paper>

        {/* Results Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Enquiry Details</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Follow-up Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Telecaller</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Remarks</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Next Follow-up</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRecords.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {record.enquiryName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {record.enquiryPhone}
                        </Typography>
                        {record.enquiryEmail && (
                          <Typography variant="body2" color="text.secondary">
                            {record.enquiryEmail}
                          </Typography>
                        )}
                        {record.enquirySubject && (
                          <Typography variant="caption" color="text.secondary">
                            Subject: {record.enquirySubject}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {formatDate(record.followUpDate)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                          {record.telecaller.charAt(0).toUpperCase()}
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
                            try {
                              const nextDate = parseISO(record.nextFollowUpDate);
                              const today = new Date();
                              if (nextDate.toDateString() === today.toDateString()) return 'success.main';
                              if (nextDate < today) return 'error.main';
                              return 'text.primary';
                            } catch { return 'text.primary'; }
                          })()}
                        >
                          {formatDate(record.nextFollowUpDate)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(record.createdAt)}
                      </Typography>
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
                ? 'No follow-ups have been recorded yet. Add follow-ups to enquiries to see them here.' 
                : 'Try adjusting your filters to see more results'
              }
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
    </LocalizationProvider>
  );
}
