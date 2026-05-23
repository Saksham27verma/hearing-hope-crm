'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  TextField,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/context/AuthContext';
import { useWhatsAppApprovalInbox } from '@/hooks/useWhatsAppApprovalInbox';
import { useWhatsAppApprovalLiveAlerts } from '@/hooks/useWhatsAppApprovalLiveAlerts';
import type { WhatsAppApprovalAlertItem } from '@/hooks/useWhatsAppApprovalLiveAlerts';
import {
  approveInvoiceWhatsAppRequest,
  rejectInvoiceWhatsAppRequest,
} from '@/app/actions/whatsapp';
import WhatsAppApprovalLiveAlerts from './WhatsAppApprovalLiveAlerts';

export default function WhatsAppApprovalLiveAlertsHost() {
  const router = useRouter();
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { pending, isAdmin } = useWhatsAppApprovalInbox();
  const { visible, exitingIds, dismiss, dismissByRequestId } = useWhatsAppApprovalLiveAlerts(
    pending,
    isAdmin,
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<WhatsAppApprovalAlertItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const runApprove = useCallback(
    async (item: WhatsAppApprovalAlertItem) => {
      if (!user) return;
      setBusyId(item.id);
      try {
        const token = await user.getIdToken();
        const result = await approveInvoiceWhatsAppRequest(item.id, token);
        if (result.ok) {
          enqueueSnackbar(`Invoice ${item.invoiceNumber} sent on WhatsApp`, { variant: 'success' });
          dismissByRequestId(item.id);
        } else {
          enqueueSnackbar(result.error || 'Approve failed', { variant: 'error' });
        }
      } catch (e) {
        enqueueSnackbar(e instanceof Error ? e.message : 'Approve failed', { variant: 'error' });
      } finally {
        setBusyId(null);
      }
    },
    [user, enqueueSnackbar, dismissByRequestId],
  );

  const runReject = useCallback(async () => {
    if (!rejectItem || !user) return;
    setBusyId(rejectItem.id);
    try {
      const token = await user.getIdToken();
      const result = await rejectInvoiceWhatsAppRequest(rejectItem.id, token, rejectReason);
      if (result.ok) {
        enqueueSnackbar('Request rejected', { variant: 'info' });
        dismissByRequestId(rejectItem.id);
        setRejectItem(null);
        setRejectReason('');
      } else {
        enqueueSnackbar(result.error || 'Reject failed', { variant: 'error' });
      }
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Reject failed', { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  }, [rejectItem, rejectReason, user, enqueueSnackbar, dismissByRequestId]);

  if (!isAdmin) return null;

  return (
    <>
      <WhatsAppApprovalLiveAlerts
        visible={visible}
        exitingIds={exitingIds}
        busyId={busyId}
        onDismiss={dismiss}
        onApprove={runApprove}
        onReject={(item) => setRejectItem(item)}
        onOpenPage={(item) =>
          router.push(`/whatsapp-invoice-approvals?request=${encodeURIComponent(item.id)}`)
        }
      />

      <Dialog open={!!rejectItem} onClose={() => !busyId && setRejectItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reject WhatsApp request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectItem(null)} disabled={!!busyId}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={runReject} disabled={!!busyId}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
