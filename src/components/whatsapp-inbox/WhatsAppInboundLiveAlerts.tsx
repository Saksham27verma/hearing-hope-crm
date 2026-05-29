'use client';

import {
  Box,
  Button,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import { MessageCircle, X } from 'lucide-react';
import type { WhatsAppInboundAlertItem } from '@/hooks/useWhatsAppInboundLiveAlerts';

const slideIn = keyframes`
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(16px); opacity: 0; }
`;

function truncate(text: string, max: number): string {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function InboundAlertCard({
  item,
  exiting,
  onDismiss,
  onOpenInbox,
}: {
  item: WhatsAppInboundAlertItem;
  exiting: boolean;
  onDismiss: () => void;
  onOpenInbox: () => void;
}) {
  const theme = useTheme();
  const accent = '#25D366';

  return (
    <Box
      role="alert"
      sx={{
        pointerEvents: 'auto',
        borderRadius: 2.5,
        overflow: 'hidden',
        border: `1px solid ${alpha(accent, 0.45)}`,
        bgcolor: alpha(theme.palette.background.paper, 0.98),
        backdropFilter: 'blur(12px)',
        boxShadow: `0 16px 40px ${alpha(theme.palette.common.black, 0.2)}`,
        animation: `${exiting ? slideOut : slideIn} 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
      }}
    >
      <Box
        sx={{
          px: 1.5,
          py: 0.85,
          background: `linear-gradient(90deg, ${alpha(accent, 0.22)} 0%, transparent 72%)`,
          borderBottom: `1px solid ${alpha(accent, 0.12)}`,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <MessageCircle size={15} color={accent} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: accent }}>
              WHATSAPP MESSAGE
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onDismiss} aria-label="Dismiss" sx={{ p: 0.35 }}>
            <X size={16} />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ px: 1.5, py: 1.15 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }} noWrap>
          {item.customerName || 'Unknown'}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.35,
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            color: 'text.secondary',
          }}
          noWrap
        >
          {item.customerPhone || '—'}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            mt: 1,
            color: 'text.primary',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {truncate(item.messageBody, 220) || '—'}
        </Typography>

        <Stack direction="row" spacing={0.75} sx={{ mt: 1.1 }}>
          <Button
            size="small"
            variant="contained"
            onClick={onOpenInbox}
            sx={{
              fontWeight: 800,
              bgcolor: accent,
              '&:hover': { bgcolor: '#1da851' },
            }}
          >
            Open inbox
          </Button>
          <Button size="small" variant="text" onClick={onDismiss} sx={{ fontWeight: 700 }}>
            Dismiss
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

export default function WhatsAppInboundLiveAlerts({
  visible,
  exitingIds,
  onDismiss,
  onOpenInbox,
}: {
  visible: WhatsAppInboundAlertItem[];
  exitingIds: Set<string>;
  onDismiss: (toastId: string, messageId: string) => void;
  onOpenInbox: (item: WhatsAppInboundAlertItem) => void;
}) {
  if (visible.length === 0) return null;

  return (
    <Box
      aria-live="assertive"
      sx={{
        position: 'fixed',
        zIndex: (t) => t.zIndex.snackbar + 1,
        pointerEvents: 'none',
        top: { xs: 'auto', md: 88 },
        bottom: { xs: 'calc(env(safe-area-inset-bottom) + 220px)', md: 24 },
        left: { xs: 10, md: 24 },
        right: { xs: 10, md: 'auto' },
        width: { xs: 'auto', md: 380 },
        maxWidth: { md: 380 },
      }}
    >
      <Stack spacing={1.25}>
        {visible.map((item) => (
          <InboundAlertCard
            key={item.toastId}
            item={item}
            exiting={exitingIds.has(item.toastId)}
            onDismiss={() => onDismiss(item.toastId, item.id)}
            onOpenInbox={() => onOpenInbox(item)}
          />
        ))}
      </Stack>
    </Box>
  );
}
