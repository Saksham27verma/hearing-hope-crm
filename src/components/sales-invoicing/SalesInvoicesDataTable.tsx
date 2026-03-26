'use client';

import React from 'react';
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
  Chip,
  Box,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  PostAdd as PostAddIcon,
} from '@mui/icons-material';
import type { UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
import { Timestamp } from 'firebase/firestore';

export type SortKey = 'invoiceNumber' | 'date' | 'client' | 'linked' | 'total' | 'status';

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
}

function statusChipColor(variant: UnifiedInvoiceRow['statusVariant']): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (variant) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'overdue':
      return 'error';
    case 'uninvoiced':
      return 'info';
    default:
      return 'default';
  }
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
              {!compact && sortable('linked', 'Linked enquiry')}
              {sortable('total', 'Total', 'right')}
              {sortable('status', 'Status')}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={compact ? 6 : 7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No invoices match your filters.
                </TableCell>
              </TableRow>
            ) : (
              slice.map((r) => (
                <TableRow
                  key={r.rowId}
                  hover
                  selected={highlightedRowId === r.rowId}
                  sx={{
                    '&.Mui-selected': { bgcolor: 'rgba(79, 70, 229, 0.08)' },
                    '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.04)' },
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'ui-monospace, monospace' }}>
                      {r.invoiceNumber || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(r.date as Timestamp)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
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
                      <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
                        {r.linkedEnquiryRef ? `${r.linkedEnquiryRef.slice(0, 10)}…` : '—'}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatCurrency(r.total)}
                  </TableCell>
                  <TableCell>
                    <Chip label={r.statusLabel} size="small" color={statusChipColor(r.statusVariant)} variant={r.statusVariant === 'uninvoiced' ? 'outlined' : 'filled'} sx={{ fontWeight: 600 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" justifyContent="flex-end" flexWrap="wrap" gap={0.25}>
                      {r.kind === 'saved' && (
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
              ))
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
