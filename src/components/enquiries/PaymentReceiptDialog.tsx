'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  attributeEnquiryPaymentLedgerLines,
  getEnquiryPaymentLedgerLines,
  sumEnquiryPaymentLedgerNetPaid,
  type EnquiryPaymentLedgerLine,
} from '@/utils/enquiryPaymentLedger';
import {
  enquiryVisitsForAttribution,
  visitDisplayLabel,
} from '@/lib/enquiries/visitPaymentAttribution';
import {
  downloadPaymentAcknowledgmentPDF,
  openPaymentAcknowledgmentPDF,
  type EnquiryLike,
} from '@/utils/receiptGenerator';

type Group = {
  key: string;
  visitIndex: number | null;
  label: string;
  lines: (EnquiryPaymentLedgerLine & { inferred: boolean })[];
};

export interface PaymentReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  enquiry: EnquiryLike & Record<string, unknown>;
  /** Pre-select one visit's payments (null / undefined = all payments). */
  initialVisitIndex?: number | null;
  centerName?: string;
  onError: (message: string) => void;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Payment slip for a whole enquiry, one visit, or a hand-picked set of payments
 * (e.g. a repeat customer who only needs the receipt for today's visit).
 */
export default function PaymentReceiptDialog({
  open,
  onClose,
  enquiry,
  initialVisitIndex,
  centerName,
  onError,
}: PaymentReceiptDialogProps) {
  const lines = useMemo(() => getEnquiryPaymentLedgerLines(enquiry), [enquiry]);
  const visits = useMemo(() => enquiryVisitsForAttribution(enquiry), [enquiry]);

  const groups = useMemo<Group[]>(() => {
    const attribution = attributeEnquiryPaymentLedgerLines(enquiry, lines);
    const byKey = new Map<string, Group>();
    for (const line of lines) {
      const a = attribution.get(line.id);
      const visitIndex = a?.visitIndex ?? null;
      const key = visitIndex == null ? 'none' : `v${visitIndex}`;
      if (!byKey.has(key)) {
        byKey.set(key, { key, visitIndex, label: visitDisplayLabel(visits, visitIndex), lines: [] });
      }
      byKey.get(key)!.lines.push({ ...line, inferred: Boolean(a?.inferred) });
    }
    // Newest visit first — the usual ask is "receipt for today's visit".
    return Array.from(byKey.values()).sort((a, b) => {
      if (a.visitIndex == null) return 1;
      if (b.visitIndex == null) return -1;
      return b.visitIndex - a.visitIndex;
    });
  }, [enquiry, lines, visits]);

  const idsForVisit = (visitIndex: number | null | undefined) =>
    groups.find((g) => g.visitIndex === visitIndex)?.lines.map((l) => l.id) ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'view' | 'download' | null>(null);

  useEffect(() => {
    if (!open) return;
    const initial =
      typeof initialVisitIndex === 'number' ? idsForVisit(initialVisitIndex) : lines.map((l) => l.id);
    setSelected(new Set(initial.length > 0 ? initial : lines.map((l) => l.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialVisitIndex, lines]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedLines = lines.filter((l) => selected.has(l.id));
  const selectedTotal = sumEnquiryPaymentLedgerNetPaid(selectedLines);
  const allSelected = selectedLines.length === lines.length;

  /** Scope label + document number suffix when the selection is exactly one visit's payments. */
  const scope = useMemo(() => {
    if (allSelected) return { label: undefined as string | undefined, docSuffix: '' };
    const single = groups.find(
      (g) =>
        g.visitIndex != null &&
        g.lines.length === selectedLines.length &&
        g.lines.every((l) => selected.has(l.id)),
    );
    if (single && single.visitIndex != null) {
      return { label: single.label, docSuffix: `-V${single.visitIndex + 1}` };
    }
    return { label: 'Selected payments', docSuffix: '' };
  }, [allSelected, groups, selected, selectedLines.length]);

  const run = async (kind: 'view' | 'download') => {
    if (selectedLines.length === 0) {
      onError('Select at least one payment.');
      return;
    }
    const enquiryId = String(enquiry.id ?? '').trim() || 'enquiry';
    const options = {
      centerName,
      ...(allSelected ? {} : { paymentIds: selectedLines.map((l) => l.id) }),
      ...(scope.label ? { scopeLabel: scope.label } : {}),
      ...(scope.docSuffix ? { documentNumber: `PA-${enquiryId}${scope.docSuffix}` } : {}),
    };
    try {
      setBusy(kind);
      if (kind === 'view') await openPaymentAcknowledgmentPDF(enquiry, options);
      else await downloadPaymentAcknowledgmentPDF(enquiry, undefined, options);
    } catch (e) {
      console.error('Payment receipt PDF failed:', e);
      onError(e instanceof Error && e.message ? e.message : 'Could not create the payment receipt.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>Payment receipt</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Pick the payments to print — a single visit, or any combination. Payments not linked to a
          visit are matched by date; link them in the enquiry form if a match looks wrong.
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip
            label={`All payments (${lines.length})`}
            color={allSelected ? 'primary' : 'default'}
            variant={allSelected ? 'filled' : 'outlined'}
            onClick={() => setSelected(new Set(lines.map((l) => l.id)))}
            sx={{ fontWeight: 700 }}
          />
          {groups
            .filter((g) => g.visitIndex != null)
            .map((g) => {
              const active = scope.docSuffix === `-V${(g.visitIndex ?? 0) + 1}`;
              return (
                <Chip
                  key={g.key}
                  label={`${g.label} (${g.lines.length})`}
                  color={active ? 'primary' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                  onClick={() => setSelected(new Set(g.lines.map((l) => l.id)))}
                />
              );
            })}
          <Chip label="Clear" variant="outlined" onClick={() => setSelected(new Set())} />
        </Stack>

        <Stack spacing={2}>
          {groups.map((g) => (
            <Box key={g.key}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
                {g.label}
              </Typography>
              <Stack spacing={0.75}>
                {g.lines.map((l) => (
                  <Box
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    sx={(t) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1,
                      py: 0.5,
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: selected.has(l.id) ? alpha(t.palette.primary.main, 0.4) : 'divider',
                      bgcolor: selected.has(l.id) ? alpha(t.palette.primary.main, 0.05) : 'transparent',
                    })}
                  >
                    <Checkbox size="small" checked={selected.has(l.id)} sx={{ p: 0.5 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {l.label}
                        {l.isOutgoing ? ' (refund)' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {l.date || '—'}
                        {l.mode ? ` · ${l.mode}` : ''}
                        {l.referenceNumber ? ` · Ref ${l.referenceNumber}` : ''}
                        {l.inferred && g.visitIndex != null ? ' · matched by date' : ''}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, color: l.isOutgoing ? 'error.main' : 'success.dark' }}
                    >
                      {l.isOutgoing ? '−' : ''}
                      {inr(l.amount)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {selectedLines.length} selected · Net {inr(selectedTotal)}
          </Typography>
          {scope.label ? (
            <Typography variant="caption" color="text.secondary">
              Prints as: {scope.label}
            </Typography>
          ) : null}
        </Box>
        <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
        <Button onClick={onClose} disabled={Boolean(busy)}>
          Close
        </Button>
        <Button
          variant="outlined"
          startIcon={busy === 'view' ? <CircularProgress size={16} /> : <VisibilityIcon />}
          disabled={Boolean(busy) || selectedLines.length === 0}
          onClick={() => run('view')}
        >
          View PDF
        </Button>
        <Button
          variant="contained"
          startIcon={busy === 'download' ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          disabled={Boolean(busy) || selectedLines.length === 0}
          onClick={() => run('download')}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
}
