'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/context/AuthContext';
import { useWhatsAppInboundInbox } from '@/hooks/useWhatsAppInboundInbox';
import {
  clearAllWhatsAppInboundViaApi,
  deleteWhatsAppInboundMessage,
} from '@/lib/whatsapp/deleteInboundMessage';

function formatWhen(createdAt: unknown): string {
  if (!createdAt) return '';
  const any = createdAt as { toDate?: () => Date; seconds?: number };
  const d =
    typeof any.toDate === 'function'
      ? any.toDate()
      : typeof any.seconds === 'number'
        ? new Date(any.seconds * 1000)
        : null;
  if (!d) return '';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function waMeLink(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '#';
  return `https://wa.me/${digits}`;
}

export default function WhatsAppInboundInboxPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { messages, loading, error } = useWhatsAppInboundInbox();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    customerName: string;
  } | null>(null);

  const isAdmin = userProfile?.role === 'admin';

  const handleDeleteOne = useCallback(async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      await deleteWhatsAppInboundMessage(confirmDelete.id);
      enqueueSnackbar('Message deleted', { variant: 'success' });
      setConfirmDelete(null);
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Failed to delete message', {
        variant: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  }, [confirmDelete, enqueueSnackbar]);

  const handleDeleteAll = useCallback(async () => {
    if (!user) {
      enqueueSnackbar('Sign in to delete messages', { variant: 'warning' });
      return;
    }
    setClearingAll(true);
    try {
      const token = await user.getIdToken();
      const { messagesDeleted, notificationsDeleted } = await clearAllWhatsAppInboundViaApi(token);
      enqueueSnackbar(
        `Deleted ${messagesDeleted} message${messagesDeleted === 1 ? '' : 's'}${notificationsDeleted > 0 ? ` and ${notificationsDeleted} notification${notificationsDeleted === 1 ? '' : 's'}` : ''}`,
        { variant: 'success' },
      );
      setClearAllOpen(false);
    } catch (e) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Failed to delete all messages', {
        variant: 'error',
      });
    } finally {
      setClearingAll(false);
    }
  }, [user, enqueueSnackbar]);

  useEffect(() => {
    if (userProfile && !isAdmin) {
      router.replace('/sales');
    }
  }, [userProfile, isAdmin, router]);

  const countLabel = useMemo(() => {
    if (loading) return 'Loading…';
    return `${messages.length} message${messages.length === 1 ? '' : 's'}`;
  }, [loading, messages.length]);

  if (userProfile && !isAdmin) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          mb: 1,
        }}
      >
        <Typography variant="h5" fontWeight={800}>
          WhatsApp Inbox
        </Typography>
        <Button
          color="error"
          variant="contained"
          startIcon={clearingAll ? <CircularProgress size={18} color="inherit" /> : <DeleteSweepIcon />}
          disabled={loading || clearingAll || messages.length === 0}
          onClick={() => setClearAllOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          Delete all messages
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Incoming customer text messages received via Pinnacle. New messages also appear in the
        notification bell.
      </Typography>

      <Chip label={countLabel} size="small" sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="error">{error}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            If this mentions a missing index, create the Firestore composite index for{' '}
            <code>whatsapp_inbound_messages</code> ordered by <code>createdAt</code>.
          </Typography>
        </Paper>
      ) : messages.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No inbound messages yet.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Send a test text to your business WhatsApp number after the webhook is registered.
          </Typography>
        </Paper>
      ) : (
        <Paper variant="outlined">
          <List disablePadding>
            {messages.map((m) => (
              <ListItem
                key={m.id}
                divider
                alignItems="flex-start"
                sx={{ flexDirection: 'column', alignItems: 'stretch', py: 2, px: 2 }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {m.customerName || 'Unknown'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {formatWhen(m.createdAt)}
                    </Typography>
                    <Tooltip title="Delete message">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label="Delete message"
                          disabled={deletingId === m.id || clearingAll}
                          onClick={() =>
                            setConfirmDelete({
                              id: m.id,
                              customerName: m.customerName || 'Unknown',
                            })
                          }
                        >
                          {deletingId === m.id ? (
                            <CircularProgress size={18} color="inherit" />
                          ) : (
                            <DeleteOutlineIcon fontSize="small" />
                          )}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
                <Link
                  href={waMeLink(m.customerPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                  sx={{ mb: 1 }}
                >
                  {m.customerPhone}
                </Link>
                <ListItemText
                  primary={m.messageBody}
                  primaryTypographyProps={{ whiteSpace: 'pre-wrap' }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      <Dialog open={Boolean(confirmDelete)} onClose={() => !deletingId && setConfirmDelete(null)}>
        <DialogTitle>Delete message?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Remove this message from the inbox and delete related notifications. This cannot be
            undone.
            {confirmDelete ? (
              <>
                <br />
                <br />
                <strong>{confirmDelete.customerName}</strong>
              </>
            ) : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={Boolean(deletingId)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteOne} disabled={Boolean(deletingId)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={clearAllOpen} onClose={() => !clearingAll && setClearAllOpen(false)}>
        <DialogTitle>Delete all messages?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes every message in the WhatsApp inbox from Firebase
            {messages.length > 0
              ? ` (including ${messages.length} shown here, and any older ones not on screen)`
              : ''}
            , plus related notification bell entries. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearAllOpen(false)} disabled={clearingAll}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteAll} disabled={clearingAll}>
            {clearingAll ? 'Deleting…' : 'Delete all messages'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
