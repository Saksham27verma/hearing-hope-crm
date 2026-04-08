'use client';

import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CircleIcon from '@mui/icons-material/Circle';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useRouter } from 'next/navigation';
import type { NotificationWithId } from '@/lib/notifications/types';

function createdAtToMs(createdAt: unknown): number | null {
  if (!createdAt) return null;
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return createdAt;
  if (typeof createdAt === 'string') {
    const t = new Date(createdAt).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof createdAt === 'object' && createdAt !== null) {
    const anyObj = createdAt as any;
    if (typeof anyObj.toMillis === 'function') return anyObj.toMillis();
    if (typeof anyObj.seconds === 'number') return anyObj.seconds * 1000;
  }
  return null;
}

function formatRelative(ms: number | null): string {
  if (!ms) return '';
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function NotificationDrawer(props: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  notifications: NotificationWithId[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
}) {
  const { anchorEl, onClose, notifications, unreadCount, markAsRead } = props;
  const router = useRouter();
  const open = Boolean(anchorEl);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { unread, read } = useMemo(() => {
    const u: NotificationWithId[] = [];
    const r: NotificationWithId[] = [];
    notifications.forEach((n) => (n.is_read ? r.push(n) : u.push(n)));
    return { unread: u, read: r };
  }, [notifications]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={() => {
        if (busyId) return;
        onClose();
      }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            mt: 1.25,
            width: 420,
            maxWidth: 'calc(100vw - 24px)',
            borderRadius: 3,
            border: '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow: '0 16px 48px rgba(15, 23, 42, 0.14)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Paper elevation={0}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={800}>
                Notifications
              </Typography>
              {unreadCount > 0 ? (
                <Chip
                  size="small"
                  label={`${unreadCount} unread`}
                  color="error"
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              ) : (
                <Chip
                  size="small"
                  label="All caught up"
                  color="success"
                  variant="outlined"
                  sx={{ fontWeight: 700 }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              Click an item to mark it read.
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => !busyId && onClose()}
            aria-label="Close notifications"
            sx={{ mt: 0.25 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider />

        <Box sx={{ maxHeight: 420, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2.5,
                  mx: 'auto',
                  mb: 1.25,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <NotificationsNoneIcon fontSize="small" color="action" />
              </Box>
              <Typography variant="subtitle2" fontWeight={700}>
                No notifications
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                New sales, due calls, and system updates show up here.
              </Typography>
            </Box>
          ) : (
            <>
              {unread.length > 0 ? (
                <List
                  dense
                  subheader={
                    <ListSubheader component="div" sx={{ bgcolor: 'transparent', fontWeight: 800 }}>
                      Unread
                    </ListSubheader>
                  }
                >
                  {unread.map((n) => {
                    const when = formatRelative(createdAtToMs(n.createdAt));
                    return (
                      <ListItemButton
                        key={n.id}
                        disabled={busyId === n.id}
                        onClick={async () => {
                          if (busyId) return;
                          setBusyId(n.id);
                          try {
                            await markAsRead(n.id);
                            if (n.href) router.push(n.href);
                            onClose();
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        sx={{
                          alignItems: 'flex-start',
                          py: 1.25,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                          <CircleIcon sx={{ fontSize: 10, color: 'error.main' }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight={800} sx={{ flex: 1, minWidth: 0 }}>
                                {n.title}
                              </Typography>
                              {when ? (
                                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                  {when}
                                </Typography>
                              ) : null}
                            </Box>
                          }
                          secondary={
                            n.message ? (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {n.message}
                              </Typography>
                            ) : null
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              ) : null}

              {read.length > 0 ? (
                <List
                  dense
                  subheader={
                    <ListSubheader component="div" sx={{ bgcolor: 'transparent', fontWeight: 800 }}>
                      Read
                    </ListSubheader>
                  }
                >
                  {read.map((n) => {
                    const when = formatRelative(createdAtToMs(n.createdAt));
                    return (
                      <Tooltip key={n.id} title="Open">
                        <ListItemButton
                          onClick={() => {
                            if (n.href) router.push(n.href);
                            onClose();
                          }}
                          sx={{
                            alignItems: 'flex-start',
                            py: 1.25,
                            opacity: 0.82,
                            '&:hover': { bgcolor: 'action.hover', opacity: 1 },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }}>
                            <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" fontWeight={800} sx={{ flex: 1, minWidth: 0 }}>
                                  {n.title}
                                </Typography>
                                {when ? (
                                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                    {when}
                                  </Typography>
                                ) : null}
                              </Box>
                            }
                            secondary={
                              n.message ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                  {n.message}
                                </Typography>
                              ) : null
                            }
                          />
                        </ListItemButton>
                      </Tooltip>
                    );
                  })}
                </List>
              ) : null}
            </>
          )}
        </Box>
      </Paper>
    </Popover>
  );
}

