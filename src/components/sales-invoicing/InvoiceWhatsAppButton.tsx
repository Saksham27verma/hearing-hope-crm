'use client';

import React, { useState } from 'react';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import { WhatsApp as WhatsAppIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/context/AuthContext';
import { requestInvoiceWhatsAppApproval } from '@/app/actions/whatsapp';
import type { InvoiceWhatsAppInvoiceProps, WaStatus } from '@/lib/invoices/whatsappTypes';

export type { InvoiceWhatsAppInvoiceProps };

function statusTooltip(status: WaStatus | undefined): string {
  switch (status) {
    case 'SENT_VIA_WA':
      return 'Invoice already sent on WhatsApp';
    case 'PENDING_APPROVAL':
      return 'Awaiting admin approval to send on WhatsApp';
    case 'REJECTED':
      return 'Admin rejected — tap to request approval again';
    case 'FAILED':
      return 'Last WhatsApp send failed — tap to request approval again';
    default:
      return 'Request admin approval to send invoice on WhatsApp';
  }
}

export default function InvoiceWhatsAppButton({ invoice }: { invoice: InvoiceWhatsAppInvoiceProps }) {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  const alreadySent = invoice.waStatus === 'SENT_VIA_WA';
  const pendingApproval = invoice.waStatus === 'PENDING_APPROVAL';
  const disabled = loading || !invoice.id || alreadySent || pendingApproval;

  const handleClick = async () => {
    if (disabled) return;
    if (!user) {
      enqueueSnackbar('Sign in to send WhatsApp messages', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const result = await requestInvoiceWhatsAppApproval(
        invoice.id,
        idToken,
        invoice.invoiceNumber,
      );
      if (result.ok) {
        enqueueSnackbar('Approval request sent to admins', { variant: 'success' });
      } else {
        enqueueSnackbar(result.error || 'Could not submit approval request', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'WhatsApp send failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  let disabledReason = '';
  if (alreadySent) disabledReason = 'Already sent on WhatsApp';
  else if (pendingApproval) disabledReason = 'Awaiting admin approval';

  return (
    <Tooltip title={disabled && disabledReason ? disabledReason : statusTooltip(invoice.waStatus)}>
      <span>
        <IconButton
          size="small"
          color={
            invoice.waStatus === 'FAILED' || invoice.waStatus === 'REJECTED'
              ? 'warning'
              : pendingApproval
                ? 'default'
                : 'success'
          }
          onClick={handleClick}
          disabled={disabled}
          aria-label="Send invoice on WhatsApp"
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : <WhatsAppIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
