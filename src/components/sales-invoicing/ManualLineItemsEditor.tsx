'use client';

import React from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { ManualLineItem } from '@/lib/sales-invoicing/types';

function newLine(): ManualLineItem {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return { id, description: '', quantity: 1, rate: 0, taxPercent: 0 };
}

interface ManualLineItemsEditorProps {
  items: ManualLineItem[];
  onChange: (items: ManualLineItem[]) => void;
  formatCurrency: (n: number) => string;
}

export default function ManualLineItemsEditor({ items, onChange, formatCurrency }: ManualLineItemsEditorProps) {
  const update = (index: number, patch: Partial<ManualLineItem>) => {
    const next = items.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const subtotal = items.reduce((s, m) => s + m.quantity * m.rate, 0);
  const tax = items.reduce((s, m) => s + Math.round(m.quantity * m.rate * (m.taxPercent || 0) / 100), 0);

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5 }}>
        Manual line items (description, quantity, rate, tax %)
      </Typography>
      <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right" width={100}>
                Qty
              </TableCell>
              <TableCell align="right" width={120}>
                Rate
              </TableCell>
              <TableCell align="right" width={100}>
                Tax %
              </TableCell>
              <TableCell align="right" width={120}>
                Line total
              </TableCell>
              <TableCell width={48} />
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                  No manual lines. Add rows for services or items not in the product catalog.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row, idx) => {
                const lineSub = row.quantity * row.rate;
                const lineTax = Math.round(lineSub * (row.taxPercent || 0) / 100);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Description"
                        value={row.description}
                        onChange={(e) => update(idx, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 0, step: 0.01 }}
                        value={row.quantity}
                        onChange={(e) => update(idx, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                        sx={{ width: 88 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={row.rate}
                        onChange={(e) => update(idx, { rate: Math.max(0, Number(e.target.value) || 0) })}
                        sx={{ width: 104 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        inputProps={{ min: 0, max: 100 }}
                        value={row.taxPercent}
                        onChange={(e) => update(idx, { taxPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                        sx={{ width: 88 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(lineSub + lineTax)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => onChange(items.filter((_, i) => i !== idx))}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={2}>
        <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={() => onChange([...items, newLine()])} sx={{ borderRadius: 2 }}>
          Add line
        </Button>
        <Box textAlign="right">
          <Typography variant="caption" color="text.secondary" display="block">
            Manual subtotal {formatCurrency(subtotal)} · Tax {formatCurrency(tax)}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            Manual total {formatCurrency(subtotal + tax)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
