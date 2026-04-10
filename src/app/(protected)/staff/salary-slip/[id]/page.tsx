'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  alpha,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  PrintOutlined as PrintIcon,
  ArrowBack as BackIcon,
  CheckCircle as PaidIcon,
  Error as UnpaidIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { generateSalarySlipHtml } from '@/utils/salarySlipHtmlTemplate';
import type { SalarySlipData } from '@/utils/salarySlipHtmlTemplate';

interface Staff {
  id?: string;
  name: string;
  staffNumber?: string;
  email: string;
  phone: string;
  joiningDate: Timestamp;
  jobRole: string;
  department?: string;
  basicSalary: number;
  status: 'active' | 'inactive';
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
}

interface Salary {
  id?: string;
  staffId: string;
  month: string;
  basicSalary: number;
  hra: number;
  travelAllowance: number;
  festivalAdvance: number;
  generalAdvance: number;
  deductions: number;
  incentives: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  isPaid: boolean;
  paidDate?: Timestamp;
  remarks?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface SalaryRecordSummary {
  id: string;
  month: string;
  netSalary: number;
  isPaid: boolean;
}

const buildSalaryDocId = (staffId: string, month: string) => `${staffId}_${month}`;

const salaryTimestampValue = (salary?: Salary) =>
  salary?.updatedAt?.seconds || salary?.createdAt?.seconds || 0;

function getFirestoreErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message;
  switch (code) {
    case 'permission-denied':
      return `${fallback}: you do not have permission to access salary records.`;
    case 'failed-precondition':
      return `${fallback}: Firestore index/config is missing. Please ask admin to create required index.`;
    case 'unavailable':
      return `${fallback}: Firestore service is temporarily unavailable. Please retry.`;
    case 'deadline-exceeded':
      return `${fallback}: request timed out. Please retry.`;
    case 'network-request-failed':
      return `${fallback}: network issue detected. Check internet and retry.`;
    default:
      return message ? `${fallback}: ${message}` : fallback;
  }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (ts?: Timestamp) => {
  if (!ts) return 'N/A';
  return format(new Date(ts.seconds * 1000), 'dd MMM yyyy');
};

const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  return format(new Date(parseInt(y), parseInt(mo) - 1), 'MMMM yyyy');
};

export default function SalarySlipPage({ params }: { params: { id: string } }) {
  const { user, isAllowedModule } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryRecordSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [monthLoading, setMonthLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  /* ── Build SalarySlipData for the HTML template ────────────── */
  const buildSlipData = useCallback((): SalarySlipData | null => {
    if (!staff || !salary) return null;
    return {
      staffId: staff.id || params.id,
      staffName: staff.name,
      staffNumber: staff.staffNumber,
      email: staff.email,
      phone: staff.phone,
      jobRole: staff.jobRole,
      department: staff.department,
      joiningDate: staff.joiningDate,
      bankName: staff.bankName,
      accountNumber: staff.accountNumber,
      ifscCode: staff.ifscCode,
      panNumber: staff.panNumber,
      month: salary.month,
      basicSalary: salary.basicSalary,
      hra: salary.hra,
      travelAllowance: salary.travelAllowance,
      incentives: salary.incentives,
      festivalAdvance: salary.festivalAdvance,
      generalAdvance: salary.generalAdvance,
      deductions: salary.deductions,
      totalEarnings: salary.totalEarnings,
      totalDeductions: salary.totalDeductions,
      netSalary: salary.netSalary,
      isPaid: salary.isPaid,
      paidDate: salary.paidDate,
      remarks: salary.remarks,
      logoUrl: '/images/logohope.svg',
    };
  }, [staff, salary, params.id]);

  /* ── Print: open HTML template in a new window and print ───── */
  const handlePrint = useCallback(() => {
    const slipData = buildSlipData();
    if (!slipData) return;
    setPrinting(true);
    try {
      const html = generateSalarySlipHtml(slipData);
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) {
        setToastMsg({ msg: 'Popup blocked. Allow popups and try again.', severity: 'error' });
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.onload = () => {
        win.focus();
        win.print();
      };
    } finally {
      setPrinting(false);
    }
  }, [buildSlipData]);

  /* ── Download PDF: call server API ─────────────────────────── */
  const handleDownloadPdf = useCallback(async () => {
    if (!staff || !salary) return;
    setDownloading(true);
    try {
      const url = `/api/staff/salary-slip-pdf?staffId=${encodeURIComponent(staff.id || params.id)}&month=${encodeURIComponent(salary.month)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || 'Failed to generate PDF');
      }
      const blob = await res.blob();
      const safeName = staff.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
      const filename = `salary-slip-${safeName}-${salary.month}.pdf`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      setToastMsg({ msg: 'PDF downloaded successfully', severity: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to download PDF';
      setToastMsg({ msg, severity: 'error' });
    } finally {
      setDownloading(false);
    }
  }, [staff, salary, params.id]);

  /* ── Preview in new tab ─────────────────────────────────────── */
  const handlePreview = useCallback(() => {
    const slipData = buildSlipData();
    if (!slipData) return;
    const html = generateSalarySlipHtml(slipData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [buildSlipData]);

  useEffect(() => {
    if (!user) return;
    if (isAllowedModule('staff')) {
      fetchStaffAndSalary();
    } else {
      setLoading(false);
      setError('You do not have permission to access this page');
    }
  }, [user, params.id, isAllowedModule]);

  /* ── Data fetching ────────────────────────────────────────── */
  const fetchStaffAndSalary = async () => {
    try {
      setLoading(true);
      const staffDoc = await getDoc(doc(db, 'staff', params.id));
      if (!staffDoc.exists()) {
        setError('Staff member not found');
        setLoading(false);
        return;
      }
      setStaff({ id: staffDoc.id, ...(staffDoc.data() as Staff) });

      const salaryQuery = query(
        collection(db, 'salaries'),
        where('staffId', '==', params.id)
      );
      const snap = await getDocs(salaryQuery);

      if (snap.empty) {
        setError('No salary records found for this staff member');
        setLoading(false);
        return;
      }

      const bestRecord = new Map<string, SalaryRecordSummary>();
      const bestData = new Map<string, Salary>();
      snap.docs.forEach((d) => {
        const data = d.data() as Salary;
        const existing = bestData.get(data.month);
        const prefer =
          !existing ||
          salaryTimestampValue(data) > salaryTimestampValue(existing) ||
          d.id === buildSalaryDocId(params.id, data.month);
        if (prefer) {
          bestRecord.set(data.month, { id: d.id, month: data.month, netSalary: data.netSalary || 0, isPaid: !!data.isPaid });
          bestData.set(data.month, { id: d.id, ...data });
        }
      });

      const history = Array.from(bestRecord.values()).sort((a, b) => b.month.localeCompare(a.month));
      setSalaryHistory(history);

      const requestedMonth = searchParams.get('month') || history[0].month;
      const chosen = bestData.get(requestedMonth) || bestData.get(history[0].month);
      const chosenMonth = bestData.has(requestedMonth) ? requestedMonth : history[0].month;
      setSelectedMonth(chosenMonth);
      setSalary(chosen || null);
      setLoading(false);
    } catch (err) {
      console.error('Salary slip load error:', err);
      setError(getFirestoreErrorMessage(err, 'Failed to load salary slip data'));
      setLoading(false);
    }
  };

  const handleMonthChange = async (month: string) => {
    if (!staff?.id) return;
    try {
      setMonthLoading(true);
      setSelectedMonth(month);
      setError(null);
      router.replace(`/staff/salary-slip/${staff.id}?month=${month}`);

      const deterministicRef = doc(db, 'salaries', buildSalaryDocId(staff.id, month));
      const deterministicDoc = await getDoc(deterministicRef);
      if (deterministicDoc.exists()) {
        setSalary({ id: deterministicDoc.id, ...(deterministicDoc.data() as Salary) });
        return;
      }

      const fallback = await getDocs(
        query(collection(db, 'salaries'), where('staffId', '==', staff.id), where('month', '==', month))
      );
      if (!fallback.empty) {
        setSalary({ id: fallback.docs[0].id, ...(fallback.docs[0].data() as Salary) });
      } else {
        setError(`No salary record found for ${fmtMonth(month)}.`);
      }
    } catch (err) {
      console.error('Salary month load error:', err);
      setError(getFirestoreErrorMessage(err, `Failed to load salary data for ${fmtMonth(month)}`));
    } finally {
      setMonthLoading(false);
    }
  };

  /* ── Derived display values ───────────────────────────────── */
  const employeeId = useMemo(() => {
    if (!staff) return '—';
    if (staff.staffNumber) return staff.staffNumber;
    return staff.id ? `HH-${staff.id.substring(0, 6).toUpperCase()}` : '—';
  }, [staff]);

  const department = useMemo(() => {
    if (!staff) return '—';
    return staff.department || staff.jobRole || '—';
  }, [staff]);

  /* ── Loading / error states ───────────────────────────────── */
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !staff || !salary) {
    return (
      <Box textAlign="center" p={6}>
        <Typography variant="h5" color="error" gutterBottom fontWeight={700}>
          {error || 'Data not available'}
        </Typography>
        <Button variant="outlined" href="/staff" sx={{ mt: 2, borderRadius: 2 }}>
          Return to Staff List
        </Button>
      </Box>
    );
  }

  /* ── Table row helper ─────────────────────────────────────── */
  const SlipRow = ({
    earning,
    earningAmt,
    deduction,
    deductionAmt,
    bold = false,
  }: {
    earning: string;
    earningAmt: number | null;
    deduction: string;
    deductionAmt: number | null;
    bold?: boolean;
  }) => (
    <TableRow
      sx={{
        bgcolor: bold ? (t) => alpha(t.palette.primary.main, 0.06) : 'transparent',
        '&:last-child td': { borderBottom: 'none' },
      }}
    >
      <TableCell sx={{ py: 1, fontWeight: bold ? 700 : 400, borderRight: '1px solid', borderRightColor: 'divider', color: bold ? 'text.primary' : 'text.secondary', fontSize: bold ? 13 : 12 }}>
        {earning}
      </TableCell>
      <TableCell align="right" sx={{ py: 1, fontWeight: bold ? 700 : 500, borderRight: '1px solid', borderRightColor: 'divider', fontSize: bold ? 13 : 12, color: bold ? 'success.dark' : 'text.primary' }}>
        {earningAmt !== null ? fmt(earningAmt) : ''}
      </TableCell>
      <TableCell sx={{ py: 1, fontWeight: bold ? 700 : 400, borderRight: '1px solid', borderRightColor: 'divider', color: bold ? 'text.primary' : 'text.secondary', fontSize: bold ? 13 : 12 }}>
        {deduction}
      </TableCell>
      <TableCell align="right" sx={{ py: 1, fontWeight: bold ? 700 : 500, fontSize: bold ? 13 : 12, color: bold ? 'error.dark' : 'text.primary' }}>
        {deductionAmt !== null ? fmt(deductionAmt) : ''}
      </TableCell>
    </TableRow>
  );

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <Box p={{ xs: 2, sm: 3 }}>
      {/* ── SCREEN-ONLY TOOLBAR ─── */}
      <Box
        className="salary-slip-toolbar"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
          pb: 2.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '@media print': { display: 'none' },
        }}
      >
        {/* Back + breadcrumb */}
        <Box display="flex" alignItems="center" gap={1} flex={1}>
          <Tooltip title="Back to Staff">
            <IconButton size="small" onClick={() => router.push('/staff')} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
              <BackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1 }}>
              Staff &rsaquo; Salary Slip
            </Typography>
            <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {staff.name}
            </Typography>
          </Box>
        </Box>

        {/* Month selector */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Salary Month</InputLabel>
          <Select
            value={selectedMonth}
            label="Salary Month"
            onChange={(e) => void handleMonthChange(e.target.value)}
            disabled={monthLoading}
            sx={{ borderRadius: 1.5, fontWeight: 600 }}
          >
            {salaryHistory.map((row) => (
              <MenuItem key={row.id} value={row.month}>
                <Box display="flex" alignItems="center" gap={1.5} width="100%">
                  <Typography variant="body2" flex={1}>
                    {fmtMonth(row.month)}
                  </Typography>
                  <Chip
                    size="small"
                    label={row.isPaid ? 'Paid' : 'Unpaid'}
                    color={row.isPaid ? 'success' : 'default'}
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10, '& .MuiChip-label': { px: 0.75 } }}
                  />
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Action buttons */}
        <Tooltip title="Open professional HTML slip in a new tab">
          <IconButton
            size="small"
            onClick={handlePreview}
            disabled={!staff || !salary}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          variant="outlined"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={!staff || !salary || printing}
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          {printing ? 'Opening…' : 'Print Slip'}
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadPdf}
          disabled={!staff || !salary || downloading}
          sx={{ borderRadius: 2, fontWeight: 700, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
        >
          {downloading ? 'Generating…' : 'Download PDF'}
        </Button>
      </Box>

      {/* ── THE SALARY SLIP DOCUMENT ──────────────────────────── */}
      <Paper
        className="salary-slip-doc"
        elevation={2}
        sx={{
          maxWidth: 800,
          mx: 'auto',
          borderRadius: 3,
          overflow: 'hidden',
          '@media print': { boxShadow: 'none', borderRadius: 0, maxWidth: '100%', mx: 0 },
        }}
      >
        {/* ── Slip Header ── */}
        <Box
          sx={{
            background: (t) =>
              `linear-gradient(135deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 100%)`,
            color: 'white',
            px: 4,
            py: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Box>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{ letterSpacing: '-0.5px', lineHeight: 1.2 }}
            >
              Hearing Hope
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', mt: 0.25 }}>
              Hearing Hope Center &nbsp;·&nbsp; India
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                fontWeight: 800,
                letterSpacing: 2,
                fontSize: 11,
                opacity: 0.85,
                lineHeight: 1,
              }}
            >
              Salary Slip
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3, mt: 0.5 }}>
              {fmtMonth(salary.month)}
            </Typography>
            {salary.isPaid && salary.paidDate && (
              <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', mt: 0.25 }}>
                Paid on {fmtDate(salary.paidDate)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* ── Status bar ── */}
        <Box
          sx={{
            px: 4,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: salary.isPaid
              ? (t) => alpha(t.palette.success.main, 0.08)
              : (t) => alpha(t.palette.warning.main, 0.08),
            borderBottom: '1px solid',
            borderBottomColor: 'divider',
          }}
        >
          {salary.isPaid ? (
            <PaidIcon sx={{ fontSize: 15, color: 'success.main' }} />
          ) : (
            <UnpaidIcon sx={{ fontSize: 15, color: 'warning.main' }} />
          )}
          <Typography
            variant="caption"
            fontWeight={700}
            color={salary.isPaid ? 'success.dark' : 'warning.dark'}
            sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}
          >
            {salary.isPaid ? 'Salary Paid' : 'Payment Pending'}
          </Typography>
          {salary.isPaid && salary.paidDate && (
            <Typography variant="caption" color="text.secondary">
              &mdash; Disbursed on {fmtDate(salary.paidDate)}
            </Typography>
          )}
          <Box flex={1} />
          <Typography variant="caption" color="text.disabled">
            Slip generated {format(new Date(), 'dd MMM yyyy')}
          </Typography>
        </Box>

        {/* ── Employee Details ── */}
        <Box sx={{ px: 4, py: 3 }}>
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, letterSpacing: 1.5, color: 'text.disabled', fontSize: 10 }}
          >
            Employee Information
          </Typography>
          <Box
            sx={{
              mt: 1.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 0,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {[
              { label: 'Full Name', value: staff.name },
              { label: 'Designation', value: staff.jobRole },
              { label: 'Employee ID', value: employeeId },
              { label: 'Department', value: department },
              { label: 'Date of Joining', value: fmtDate(staff.joiningDate) },
              { label: 'Email', value: staff.email || '—' },
              { label: 'Phone', value: staff.phone || '—' },
              { label: 'Status', value: staff.status === 'active' ? 'Active' : 'Inactive' },
            ].map((item, idx) => (
              <Box
                key={item.label}
                sx={{
                  px: 2.5,
                  py: 1.5,
                  borderBottom: idx < 6 ? '1px solid' : 'none',
                  borderRight: idx % 2 === 0 ? { sm: '1px solid' } : 'none',
                  borderColor: 'divider',
                  bgcolor: idx % 4 < 2 ? (t) => alpha(t.palette.grey[50], 0.8) : 'transparent',
                }}
              >
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ mx: 4 }} />

        {/* ── Salary Breakdown ── */}
        <Box sx={{ px: 4, py: 3 }}>
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, letterSpacing: 1.5, color: 'text.disabled', fontSize: 10 }}
          >
            Salary Breakdown
          </Typography>
          <TableContainer
            sx={{
              mt: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: (t) => alpha(t.palette.grey[100], 0.8) }}>
                  <TableCell
                    sx={{
                      py: 1.25,
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: 'success.dark',
                      borderRight: '1px solid',
                      borderRightColor: 'divider',
                    }}
                  >
                    Earnings
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      py: 1.25,
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: 'success.dark',
                      borderRight: '1px solid',
                      borderRightColor: 'divider',
                    }}
                  >
                    Amount
                  </TableCell>
                  <TableCell
                    sx={{
                      py: 1.25,
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: 'error.dark',
                      borderRight: '1px solid',
                      borderRightColor: 'divider',
                    }}
                  >
                    Deductions
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      py: 1.25,
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: 'error.dark',
                    }}
                  >
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <SlipRow earning="Basic Salary" earningAmt={salary.basicSalary} deduction="Festival Advance" deductionAmt={salary.festivalAdvance} />
                <SlipRow earning="HRA" earningAmt={salary.hra} deduction="General Advance" deductionAmt={salary.generalAdvance} />
                <SlipRow earning="Travel Allowance" earningAmt={salary.travelAllowance} deduction="Other Deductions" deductionAmt={salary.deductions} />
                <SlipRow earning="Incentives / Bonus" earningAmt={salary.incentives} deduction="" deductionAmt={null} />
                <SlipRow
                  earning="Total Earnings"
                  earningAmt={salary.totalEarnings}
                  deduction="Total Deductions"
                  deductionAmt={salary.totalDeductions}
                  bold
                />
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* ── Net Salary ── */}
        <Box sx={{ px: 4, pb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2.5,
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
            }}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: 'primary.main',
                  fontSize: 10,
                  display: 'block',
                  lineHeight: 1,
                }}
              >
                Net Salary Payable
              </Typography>
              <Typography variant="caption" color="text.secondary">
                (Total Earnings &minus; Total Deductions)
              </Typography>
            </Box>
            <Typography
              variant="h4"
              fontWeight={800}
              color="primary.main"
              sx={{ letterSpacing: '-1px' }}
            >
              {fmt(salary.netSalary)}
            </Typography>
          </Box>
        </Box>

        {/* ── Remarks ── */}
        {salary.remarks && (
          <Box
            sx={{
              mx: 4,
              mb: 3,
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.grey[50], 0.6),
            }}
          >
            <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Remarks
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {salary.remarks}
            </Typography>
          </Box>
        )}

        {/* ── Bank Info (if available) ── */}
        {(staff.bankName || staff.accountNumber) && (
          <Box sx={{ px: 4, pb: 3 }}>
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 1.5, color: 'text.disabled', fontSize: 10 }}>
              Bank Details
            </Typography>
            <Box
              sx={{
                mt: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              {[
                { label: 'Bank Name', value: staff.bankName || '—' },
                { label: 'Account No.', value: staff.accountNumber || '—' },
                { label: 'IFSC Code', value: staff.ifscCode || '—' },
              ].map((item, idx) => (
                <Box
                  key={item.label}
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderRight: idx < 2 ? '1px solid' : 'none',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Divider sx={{ mx: 4 }} />

        {/* ── Signatures ── */}
        <Box
          sx={{
            px: 4,
            py: 3,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
          }}
        >
          {['Employee Signature', 'Authorized Signatory'].map((label) => (
            <Box key={label} textAlign="center">
              <Box
                sx={{
                  height: 48,
                  borderBottom: '1.5px solid',
                  borderColor: 'text.secondary',
                  mb: 0.75,
                }}
              />
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* ── Footer ── */}
        <Box
          sx={{
            px: 4,
            py: 1.75,
            bgcolor: (t) => alpha(t.palette.grey[100], 0.6),
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="caption" color="text.disabled">
            This is a computer-generated document and does not require a physical signature.
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Generated: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </Typography>
        </Box>
      </Paper>

      {/* Toast */}
      <Snackbar
        open={!!toastMsg}
        autoHideDuration={5000}
        onClose={() => setToastMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={toastMsg?.severity || 'info'}
          variant="filled"
          onClose={() => setToastMsg(null)}
          sx={{ borderRadius: 2 }}
        >
          {toastMsg?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
