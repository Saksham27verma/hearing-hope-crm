'use client';

import React from 'react';
import Link from 'next/link';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Typography,
  IconButton,
  Button,
  Box,
  Tooltip,
  Chip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  PostAdd as PostAddIcon,
  OpenInNew as OpenInNewIcon,
  HighlightOff as VoidInvoiceIcon,
} from '@mui/icons-material';
import type { UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
import { Timestamp } from 'firebase/firestore';

export type SortKey = 'invoiceNumber' | 'date' | 'client' | 'linked' | 'total';

/** Enquiry patient profile URL, or visitors list when only a visitor id is linked. */
function patientProfileHref(r: UnifiedInvoiceRow): string | null {
  if (r.kind === 'saved' && r.savedSale) {
    if (r.savedSale.enquiryId) return `/interaction/enquiries/${r.savedSale.enquiryId}`;
    if (r.savedSale.visitorId) return '/interaction/visitors';
    return null;
  }
  if (r.kind === 'enquiry_pending' && r.derivedEnquiry) {
    if (r.derivedEnquiry.enquiryId) return `/interaction/enquiries/${r.derivedEnquiry.enquiryId}`;
    if (r.derivedEnquiry.visitorId) return '/interaction/visitors';
  }
  return null;
}

function patientProfileButtonLabel(r: UnifiedInvoiceRow): string {
  if (r.kind === 'saved' && r.savedSale?.enquiryId) return 'Patient profile';
  if (r.kind === 'enquiry_pending' && r.derivedEnquiry?.enquiryId) return 'Patient profile';
  if (r.linkedEnquiryRef) return 'Open visitor list';
  return 'Profile';
}

interface SalesInvoicesDataTableProps {
  rows: UnifiedInvoiceRow[];
  page: number;
  rowsPerPage: number;
  onPageChange: (p: number) => void;
  onRowsPerPageChange: (n: number) => void;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  formatCurrency: (n: number) => string;
  formatDate: (ts: Timestamp) => string;
  onEditSaved: (row: UnifiedInvoiceRow) => void;
  onDeleteSaved: (id: string) => void;
  onPrint: (row: UnifiedInvoiceRow) => void;
  onPreview: (row: UnifiedInvoiceRow) => void;
  onCreateFromEnquiry: (row: UnifiedInvoiceRow) => void;
  isAdmin: boolean;
  highlightedRowId?: string | null;
  /** Admin-only: soft-void invoice (Firestore `cancelled`). */
  onCancelSaved?: (row: UnifiedInvoiceRow) => void;
}

export default function SalesInvoicesDataTable({
  rows,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  sortKey,
  sortDir,
  onSort,
  formatCurrency,
  formatDate,
  onEditSaved,
  onDeleteSaved,
  onPrint,
  onPreview,
  onCreateFromEnquiry,
  isAdmin,
  highlightedRowId,
  onCancelSaved,
}: SalesInvoicesDataTableProps) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const slice = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const sortable = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <TableCell align={align} sortDirection={sortKey === key ? sortDir : false}>
      <TableSortLabel active={sortKey === key} direction={sortKey === key ? sortDir : 'asc'} onClick={() => onSort(key)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 32px rgba(15, 23, 42, 0.06)',
      }}
    >
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {sortable('invoiceNumber', 'Invoice #')}
              {sortable('date', 'Date')}
              {sortable('client', 'Client')}
              {!compact && sortable('linked', 'Linked profile')}
              {sortable('total', 'Total', 'right')}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={compact ? 5 : 6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No invoices match your filters.
                </TableCell>
              </TableRow>
            ) : (
              slice.map((r) => {
                const voided = !!r.isCancelled;
                return (
                <TableRow
                  key={r.rowId}
                  hover={!voided}
                  selected={highlightedRowId === r.rowId}
                  sx={{
                    ...(voided && {
                      opacity: 0.88,
                      bgcolor: 'action.hover',
                      borderLeft: '3px solid',
                      borderLeftColor: 'warning.main',
                    }),
                    '&.Mui-selected': { bgcolor: 'rgba(79, 70, 229, 0.08)' },
                    '&:hover': { bgcolor: voided ? 'action.selected' : 'rgba(79, 70, 229, 0.04)' },
                  }}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          fontFamily: 'ui-monospace, monospace',
                          textDecoration: voided ? 'line-through' : undefined,
                          color: voided ? 'text.secondary' : undefined,
                        }}
                      >
                        {r.invoiceNumber || '—'}
                      </Typography>
                      {voided && (
                        <Chip label="Cancelled" size="small" color="warning" variant="outlined" sx={{ fontWeight: 700, height: 22 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: voided ? 'text.secondary' : undefined }}>{formatDate(r.date as Timestamp)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ color: voided ? 'text.secondary' : undefined }}>
                      {r.clientName}
                    </Typography>
                    {r.clientPhone && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {r.clientPhone}
                      </Typography>
                    )}
                  </TableCell>
                  {!compact && (
                    <TableCell>
                      {patientProfileHref(r) ? (
                        <Button
                          component={Link}
                          href={patientProfileHref(r)!}
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {patientProfileButtonLabel(r)}
                        </Button>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      textDecoration: voided ? 'line-through' : undefined,
                      color: voided ? 'text.secondary' : undefined,
                    }}
                  >
                    {formatCurrency(r.total)}
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" justifyContent="flex-end" flexWrap="wrap" gap={0.25}>
                      {r.kind === 'saved' && !voided && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" color="primary" onClick={() => onEditSaved(r)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {isAdmin && r.savedSale?.id && (
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => onDeleteSaved(r.savedSale!.id!)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {isAdmin && onCancelSaved && r.savedSale?.id && (
                            <Tooltip title="Cancel invoice (void)">
                              <IconButton size="small" color="warning" onClick={() => onCancelSaved(r)}>
                                <VoidInvoiceIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Preview PDF">
                            <IconButton size="small" onClick={() => onPreview(r)}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Print">
                            <IconButton size="small" onClick={() => onPrint(r)}>
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      {r.kind === 'saved' && voided && (
                        <Typography variant="caption" color="text.secondary" sx={{ py: 0.5, px: 0.5 }}>
                          Voided
                        </Typography>
                      )}
                      {r.kind === 'enquiry_pending' && (
                        <>
                          <Tooltip title="Create invoice from enquiry">
                            <IconButton size="small" color="primary" onClick={() => onCreateFromEnquiry(r)}>
                              <PostAddIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Print (provisional)">
                            <IconButton size="small" onClick={() => onPrint(r)}>
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={rows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        onRowsPerPageChange={(e) => {
          onRowsPerPageChange(parseInt(e.target.value, 10));
          onPageChange(0);
        }}
      />
    </Paper>
  );
}
