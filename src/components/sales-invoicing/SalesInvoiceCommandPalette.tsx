'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  InputAdornment,
  Typography,
  Box,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import type { UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
import { Timestamp } from 'firebase/firestore';

function formatRowDate(ts: Timestamp) {
  return new Date(ts.seconds * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface SalesInvoiceCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  rows: UnifiedInvoiceRow[];
  query: string;
  onQueryChange: (q: string) => void;
  onSelectRow: (row: UnifiedInvoiceRow) => void;
}

export default function SalesInvoiceCommandPalette({
  open,
  onClose,
  rows,
  query,
  onQueryChange,
  onSelectRow,
}: SalesInvoiceCommandPaletteProps) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows.slice(0, 50);
    return rows
      .filter((r) => {
        const inv = (r.invoiceNumber || '').toLowerCase();
        const client = r.clientName.toLowerCase();
        const enq = (r.linkedEnquiryRef || '').toLowerCase();
        return inv.includes(q) || client.includes(q) || enq.includes(q);
      })
      .slice(0, 50);
  }, [rows, query]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>Quick search</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          placeholder="Invoice #, client, enquiry reference…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        {filtered.length === 0 ? (
          <Typography color="text.secondary" align="center" py={2}>
            No matches
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto' }}>
            {filtered.map((r) => (
              <ListItemButton
                key={r.rowId}
                onClick={() => {
                  onSelectRow(r);
                  onClose();
                }}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: '55%' }}>
                        {r.clientName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {r.invoiceNumber || '—'}
                      </Typography>
                    </Box>
                  }
                  secondary={`${formatRowDate(r.date as Timestamp)} · ${r.statusLabel}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
