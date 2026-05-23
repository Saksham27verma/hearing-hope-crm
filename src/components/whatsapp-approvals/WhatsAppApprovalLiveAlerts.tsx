'use client';

import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import { ExternalLink, MessageSquare, X } from 'lucide-react';
import type { WhatsAppApprovalAlertItem } from '@/hooks/useWhatsAppApprovalLiveAlerts';

const slideIn = keyframes`
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const slideOut = keyframes`
  from { transform: translateY(0); opacity: 1; }
  to { transform: translateY(16px); opacity: 0; }
`;

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

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'right' }} noWrap>
        {value || '—'}
      </Typography>
    </Stack>
  );
}

function ApprovalAlertCard({
  item,
  exiting,
  busy,
  onDismiss,
  onApprove,
  onReject,
  onOpenPage,
}: {
  item: WhatsAppApprovalAlertItem;
  exiting: boolean;
  busy: boolean;
  onDismiss: () => void;
  onApprove: () => void;
  onReject: () => void;
  onOpenPage: () => void;
}) {
  const theme = useTheme();
  const accent = theme.palette.warning.main;

  return (
    <Box
      role="alert"
      sx={{
        pointerEvents: 'auto',
        borderRadius: 2.5,
        overflow: 'hidden',
        border: `1px solid ${alpha(accent, 0.4)}`,
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
          background: `linear-gradient(90deg, ${alpha(accent, 0.2)} 0%, transparent 72%)`,
          borderBottom: `1px solid ${alpha(accent, 0.12)}`,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <MessageSquare size={15} color={accent} />
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: accent }}>
              WHATSAPP APPROVAL
            </Typography>
          </Stack>
          <IconButton size="small" onClick={onDismiss} aria-label="Dismiss" sx={{ p: 0.35 }}>
            <X size={16} />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ px: 1.5, py: 1.15 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }} noWrap>
          {item.customerName || 'Customer'}
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
          {item.invoiceNumber || '—'}
        </Typography>

        <Stack spacing={0.25} sx={{ mt: 0.75 }}>
          <DetailLine label="Phone" value={item.customerPhone || '—'} />
          <DetailLine label="Requested by" value={item.requestedBy?.name || '—'} />
          <DetailLine label="Role" value={item.requestedBy?.role || '—'} />
          <DetailLine label="When" value={formatWhen(item.requestedAt)} />
        </Stack>

        <Stack direction="row" spacing={0.75} sx={{ mt: 1.1 }} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="contained"
            color="success"
            disabled={busy}
            onClick={onApprove}
            sx={{ fontWeight: 800, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}
          >
            {busy ? <CircularProgress size={16} color="inherit" /> : 'Approve & send'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={busy}
            onClick={onReject}
            sx={{ fontWeight: 700, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}
          >
            Reject
          </Button>
          {item.pdfUrl ? (
            <Button
              size="small"
              variant="text"
              component="a"
              href={item.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<ExternalLink size={14} />}
              sx={{ fontWeight: 700 }}
            >
              PDF
            </Button>
          ) : null}
          <Button size="small" variant="text" onClick={onOpenPage} sx={{ fontWeight: 700 }}>
            Open
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

export default function WhatsAppApprovalLiveAlerts({
  visible,
  exitingIds,
  busyId,
  onDismiss,
  onApprove,
  onReject,
  onOpenPage,
}: {
  visible: WhatsAppApprovalAlertItem[];
  exitingIds: Set<string>;
  busyId: string | null;
  onDismiss: (toastId: string) => void;
  onApprove: (item: WhatsAppApprovalAlertItem) => void;
  onReject: (item: WhatsAppApprovalAlertItem) => void;
  onOpenPage: (item: WhatsAppApprovalAlertItem) => void;
}) {
  if (visible.length === 0) return null;

  return (
    <Box
      aria-live="assertive"
      sx={{
        position: 'fixed',
        zIndex: (t) => t.zIndex.snackbar + 2,
        pointerEvents: 'none',
        top: { xs: 'auto', md: 88 },
        bottom: { xs: 'calc(env(safe-area-inset-bottom) + 92px)', md: 24 },
        left: { xs: 10, md: 'auto' },
        right: { xs: 10, md: 24 },
        width: { xs: 'auto', md: 380 },
        maxWidth: { md: 380 },
      }}
    >
      <Stack spacing={1.25}>
        {visible.map((item) => (
          <ApprovalAlertCard
            key={item.toastId}
            item={item}
            exiting={exitingIds.has(item.toastId)}
            busy={busyId === item.id}
            onDismiss={() => onDismiss(item.toastId)}
            onApprove={() => onApprove(item)}
            onReject={() => onReject(item)}
            onOpenPage={() => onOpenPage(item)}
          />
        ))}
      </Stack>
    </Box>
  );
}
