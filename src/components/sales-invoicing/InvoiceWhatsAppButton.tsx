'use client';

import React, { useState } from 'react';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import { WhatsApp as WhatsAppIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/context/AuthContext';
import { sendInvoiceWhatsApp } from '@/app/actions/whatsapp';
import type { InvoiceWhatsAppInvoiceProps, WaStatus } from '@/lib/invoices/whatsappTypes';

export type { InvoiceWhatsAppInvoiceProps };

function statusTooltip(status: WaStatus | undefined): string {
  switch (status) {
    case 'SENT_VIA_WA':
      return 'Invoice already sent on WhatsApp';
    case 'FAILED':
      return 'Last WhatsApp send failed — tap to retry';
    default:
      return 'Send invoice PDF on WhatsApp (approval)';
  }
}

export default function InvoiceWhatsAppButton({ invoice }: { invoice: InvoiceWhatsAppInvoiceProps }) {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  const alreadySent = invoice.waStatus === 'SENT_VIA_WA';
  /** Phone may exist only on linked enquiry — server resolves on send. */
  const disabled = loading || !invoice.id || alreadySent;

  const handleClick = async () => {
    if (disabled) return;
    if (!user) {
      enqueueSnackbar('Sign in to send WhatsApp messages', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const result = await sendInvoiceWhatsApp(invoice.id, idToken);
      if (result.ok) {
        enqueueSnackbar(`Invoice ${invoice.invoiceNumber} sent on WhatsApp`, { variant: 'success' });
      } else {
        enqueueSnackbar(result.error || 'WhatsApp send failed', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'WhatsApp send failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const disabledReason = alreadySent ? 'Already sent on WhatsApp' : '';

  return (
    <Tooltip title={disabled && disabledReason ? disabledReason : statusTooltip(invoice.waStatus)}>
      <span>
        <IconButton
          size="small"
          color={invoice.waStatus === 'FAILED' ? 'warning' : 'success'}
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
