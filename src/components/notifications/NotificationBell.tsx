'use client';

import { useState } from 'react';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import { alpha, useTheme } from '@mui/material/styles';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationToasts } from '@/hooks/useNotificationToasts';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

export function NotificationBell() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { notifications, unreadCount, markAsRead } = useNotifications({ limit: 60 });
  useNotificationToasts(notifications);

  return (
    <>
      <Badge
        color="error"
        variant="dot"
        overlap="circular"
        invisible={unreadCount === 0}
      >
        <IconButton
          aria-label="Open notifications"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          sx={{
            width: 40,
            height: 40,
            borderRadius: 3,
            border: '1px solid',
            borderColor: isDark ? alpha(theme.palette.common.white, 0.14) : alpha(theme.palette.common.black, 0.08),
            bgcolor: isDark ? alpha(theme.palette.common.white, 0.08) : theme.palette.background.paper,
            color: 'text.primary',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.05)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
            '&:hover': {
              bgcolor: isDark ? alpha(theme.palette.common.white, 0.14) : theme.palette.background.paper,
              transform: 'scale(1.04)',
              boxShadow: isDark
                ? `0 4px 14px ${alpha(theme.palette.common.black, 0.4)}`
                : '0 4px 12px rgba(15, 23, 42, 0.08)',
            },
          }}
        >
          <NotificationsNoneIcon fontSize="small" />
        </IconButton>
      </Badge>

      <NotificationDrawer
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        notifications={notifications}
        unreadCount={unreadCount}
        markAsRead={markAsRead}
      />
    </>
  );
}

