'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Chip,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { useWhatsAppInboundInbox } from '@/hooks/useWhatsAppInboundInbox';

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
  const { userProfile } = useAuth();
  const { messages, loading, error } = useWhatsAppInboundInbox();

  const isAdmin = userProfile?.role === 'admin';

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
      <Typography variant="h5" fontWeight={800} gutterBottom>
        WhatsApp Inbox
      </Typography>
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
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {formatWhen(m.createdAt)}
                  </Typography>
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
    </Box>
  );
}
