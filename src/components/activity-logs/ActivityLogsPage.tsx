'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Alert,
  Divider,
  alpha,
} from '@mui/material';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { fetchActivityLogsAdmin } from '@/lib/activity-logs/adminActivityLogsApi';
import RefreshIcon from '@mui/icons-material/Refresh';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import HistoryIcon from '@mui/icons-material/History';
import TodayIcon from '@mui/icons-material/Today';
import GroupIcon from '@mui/icons-material/Group';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { CRM_ACCENT, CRM_PAGE_BG } from '@/components/Layout/crm-theme';
import ActivityLogFilters, { type FilterState } from './ActivityLogFilters';
import ActivityLogItem from './ActivityLogItem';
import ActivityLogDiffModal from './ActivityLogDiffModal';
import type { ActivityLogDoc } from './types';

const PAGE_SIZE = 50;

export default function ActivityLogsPage() {
  const { user, loading: authLoading } = useAuth();

  // ─── Data state ─────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<ActivityLogDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  /** Last doc id from API — pass as startAfterId for the next page (admin API, full audit trail). */
  const nextPageCursorRef = useRef<string | null>(null);

  // ─── Live (polling — avoids onSnapshot WatchChangeAggregator bugs in Firestore 11.x) ─
  const [liveMode, setLiveMode] = useState(false);
  const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Filters ─────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({
    userId: '',
    module: '',
    action: '',
    dateFrom: null,
    dateTo: null,
    search: '',
  });

  // ─── Diff modal ──────────────────────────────────────────────────────────────
  const [diffLog, setDiffLog] = useState<ActivityLogDoc | null>(null);

  // ─── Stats ────────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState({
    todayCount: 0,
    activeUsers: 0,
    topModule: '',
    totalLoaded: 0,
  });

  const listQueryParams = useCallback(
    () => ({
      module: filters.module || undefined,
      userId: filters.userId || undefined,
      action: filters.action || undefined,
    }),
    [filters.module, filters.userId, filters.action],
  );

  // ─── Client-side filtering for search and dates ───────────────────────────────
  const applyClientFilters = useCallback(
    (raw: ActivityLogDoc[]): ActivityLogDoc[] => {
      let filtered = raw;

      if (filters.search.trim()) {
        const needle = filters.search.trim().toLowerCase();
        filtered = filtered.filter(
          (l) =>
            l.description?.toLowerCase().includes(needle) ||
            l.entityName?.toLowerCase().includes(needle) ||
            l.userName?.toLowerCase().includes(needle) ||
            l.userEmail?.toLowerCase().includes(needle) ||
            l.module?.toLowerCase().includes(needle),
        );
      }

      if (filters.dateFrom) {
        const from = filters.dateFrom.getTime();
        filtered = filtered.filter((l) => {
          const ts = l.timestamp instanceof Timestamp ? l.timestamp.toMillis() : 0;
          return ts >= from;
        });
      }

      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        const toMs = to.getTime();
        filtered = filtered.filter((l) => {
          const ts = l.timestamp instanceof Timestamp ? l.timestamp.toMillis() : 0;
          return ts <= toMs;
        });
      }

      return filtered;
    },
    [filters.search, filters.dateFrom, filters.dateTo],
  );

  // ─── Compute stats (declared before fetchLogs / polling) ─────────────────────
  const computeStats = useCallback((allLogs: ActivityLogDoc[]) => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const todayLogs = allLogs.filter((l) => {
      const ts = l.timestamp instanceof Timestamp ? l.timestamp.toMillis() : 0;
      return ts >= todayMs && ts <= now;
    });

    const uniqueUsers = new Set(todayLogs.map((l) => l.userId));
    const moduleCounts: Record<string, number> = {};
    allLogs.forEach((l) => {
      if (l.module) moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1;
    });
    const topModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

    setStats({
      todayCount: todayLogs.length,
      activeUsers: uniqueUsers.size,
      topModule,
      totalLoaded: allLogs.length,
    });
  }, []);

  const stopLivePolling = useCallback(() => {
    if (livePollRef.current) {
      clearInterval(livePollRef.current);
      livePollRef.current = null;
    }
  }, []);

  const pollLatestLogs = useCallback(async () => {
    if (!user) return;
    try {
      const { logs: liveDocs } = await fetchActivityLogsAdmin(user, {
        limit: 25,
        ...listQueryParams(),
      });
      setLogs(liveDocs);
      computeStats(liveDocs);
    } catch {
      // keep previous data; avoid console spam
    }
  }, [user, listQueryParams, computeStats]);

  // ─── Fetch first page (manual refresh / after leaving live mode) ─────────────
  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    nextPageCursorRef.current = null;
    setHasMore(true);

    try {
      const { logs: docs, nextCursor, hasMore: hm } = await fetchActivityLogsAdmin(user, {
        limit: PAGE_SIZE,
        ...listQueryParams(),
      });
      nextPageCursorRef.current = nextCursor;
      setHasMore(hm);
      setLogs(docs);
      computeStats(docs);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Failed to load activity logs. Check the browser console, Admin SDK env vars, and that your user has role admin in Firestore.',
      );
    } finally {
      setLoading(false);
    }
  }, [user, listQueryParams, computeStats]);

  // ─── Load more ───────────────────────────────────────────────────────────────
  const loadMore = async () => {
    if (!user || !nextPageCursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const { logs: more, nextCursor, hasMore: hm } = await fetchActivityLogsAdmin(user, {
        limit: PAGE_SIZE,
        startAfterId: nextPageCursorRef.current,
        ...listQueryParams(),
      });
      nextPageCursorRef.current = nextCursor;
      setHasMore(hm);
      setLogs((prev) => [...prev, ...more]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  // ─── Live mode toggle (polling, not onSnapshot) ──────────────────────────────
  const toggleLive = () => {
    if (liveMode) {
      stopLivePolling();
      setLiveMode(false);
      void fetchLogs();
    } else {
      stopLivePolling();
      setLiveMode(true);
      void pollLatestLogs();
      livePollRef.current = setInterval(() => {
        void pollLatestLogs();
      }, 8000);
    }
  };

  // Single effect: initial + filter changes (server reads all users via Admin SDK).
  useEffect(() => {
    if (liveMode || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      nextPageCursorRef.current = null;
      setHasMore(true);
      try {
        const { logs: docs, nextCursor, hasMore: hm } = await fetchActivityLogsAdmin(user, {
          limit: PAGE_SIZE,
          ...listQueryParams(),
        });
        if (cancelled) return;
        nextPageCursorRef.current = nextCursor;
        setHasMore(hm);
        setLogs(docs);
        computeStats(docs);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(
            e instanceof Error && e.message
              ? e.message
              : 'Failed to load activity logs. Check the browser console, Admin SDK env vars, and that your user has role admin in Firestore.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveMode, user, listQueryParams, computeStats]);

  useEffect(() => {
    return () => {
      stopLivePolling();
    };
  }, [stopLivePolling]);

  const displayedLogs = applyClientFilters(logs);

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
        <CircularProgress sx={{ color: CRM_ACCENT }} />
      </Box>
    );
  }
  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Sign in to view activity logs.</Alert>
      </Box>
    );
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', bgcolor: CRM_PAGE_BG }}>
      {/* ── Page Header ── */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        mb={3}
        gap={2}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1.5} mb={0.5}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: alpha(CRM_ACCENT, 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <HistoryIcon sx={{ color: CRM_ACCENT, fontSize: 22 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} color="text.primary">
              Activity Logs
            </Typography>
            {liveMode && (
              <Chip
                icon={<FiberManualRecordIcon sx={{ fontSize: '10px !important', color: '#22c55e !important' }} />}
                label="Live"
                size="small"
                sx={{
                  bgcolor: alpha('#22c55e', 0.12),
                  color: '#16a34a',
                  fontWeight: 600,
                  fontSize: 11,
                  height: 22,
                }}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Track every action performed across the CRM with full audit trail
          </Typography>
        </Box>

        <Stack direction="row" gap={1}>
          <Button
            variant={liveMode ? 'contained' : 'outlined'}
            size="small"
            onClick={toggleLive}
            startIcon={<FiberManualRecordIcon sx={{ fontSize: '10px !important' }} />}
            sx={{
              borderColor: liveMode ? undefined : alpha('#22c55e', 0.5),
              color: liveMode ? '#fff' : '#16a34a',
              bgcolor: liveMode ? '#22c55e' : 'transparent',
              '&:hover': { bgcolor: liveMode ? '#16a34a' : alpha('#22c55e', 0.08) },
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {liveMode ? 'Stop Live' : 'Go Live'}
          </Button>
          <Tooltip title="Refresh">
            <IconButton
              size="small"
              onClick={() => { if (!liveMode) fetchLogs(); }}
              disabled={loading || liveMode}
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── Stats Bar ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {[
          {
            label: "Today's Actions",
            value: stats.todayCount,
            icon: <TodayIcon sx={{ color: CRM_ACCENT }} />,
            color: CRM_ACCENT,
          },
          {
            label: 'Active Users Today',
            value: stats.activeUsers,
            icon: <GroupIcon sx={{ color: '#3b82f6' }} />,
            color: '#3b82f6',
          },
          {
            label: 'Top Module',
            value: stats.topModule || '—',
            icon: <TrendingUpIcon sx={{ color: '#a855f7' }} />,
            color: '#a855f7',
            isText: true,
          },
          {
            label: 'Logs Loaded',
            value: stats.totalLoaded,
            icon: <HistoryIcon sx={{ color: '#14b8a6' }} />,
            color: '#14b8a6',
          },
        ].map((stat) => (
          <Paper
            key={stat.label}
            elevation={0}
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: alpha(stat.color, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </Box>
            <Box minWidth={0}>
              <Typography
                variant="h6"
                fontWeight={700}
                lineHeight={1.2}
                color="text.primary"
                noWrap
              >
                {stat.isText ? stat.value : Number(stat.value).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {stat.label}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* ── Filters ── */}
      <ActivityLogFilters
        filters={filters}
        onChange={setFilters}
        onReset={() =>
          setFilters({ userId: '', module: '', action: '', dateFrom: null, dateTo: null, search: '' })
        }
        disabled={liveMode}
      />

      {/* ── Log List ── */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}
      >
        {/* Table header */}
        <Box
          sx={{
            px: 3,
            py: 1.5,
            bgcolor: alpha(CRM_ACCENT, 0.04),
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: '160px 1fr 100px 130px 110px 48px',
            gap: 2,
          }}
        >
          {['Time', 'User', 'Module', 'Action', 'Entity', ''].map((h) => (
            <Typography key={h} variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {h}
            </Typography>
          ))}
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" py={8}>
            <CircularProgress size={32} sx={{ color: CRM_ACCENT }} />
          </Box>
        ) : error ? (
          <Box p={3}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : displayedLogs.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={8} gap={2}>
            <HistoryIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
            <Typography color="text.secondary" variant="body2">
              No activity logs found
            </Typography>
            {Object.values(filters).some(Boolean) && (
              <Typography variant="caption" color="text.disabled">
                Try clearing some filters
              </Typography>
            )}
          </Box>
        ) : (
          <>
            {displayedLogs.map((log, idx) => (
              <React.Fragment key={log.id}>
                <ActivityLogItem log={log} onViewDiff={setDiffLog} />
                {idx < displayedLogs.length - 1 && <Divider />}
              </React.Fragment>
            ))}

            {hasMore && !liveMode && (
              <Box display="flex" justifyContent="center" py={3} borderTop="1px solid" sx={{ borderColor: 'divider' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={loadMore}
                  disabled={loadingMore}
                  startIcon={loadingMore ? <CircularProgress size={14} /> : undefined}
                  sx={{ borderColor: alpha(CRM_ACCENT, 0.4), color: CRM_ACCENT }}
                >
                  {loadingMore ? 'Loading…' : `Load more (${PAGE_SIZE} per page)`}
                </Button>
              </Box>
            )}

            {!hasMore && displayedLogs.length > 0 && (
              <Box display="flex" justifyContent="center" py={2} borderTop="1px solid" sx={{ borderColor: 'divider' }}>
                <Typography variant="caption" color="text.disabled">
                  All {displayedLogs.length} logs loaded
                </Typography>
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* ── Diff Modal ── */}
      <ActivityLogDiffModal log={diffLog} onClose={() => setDiffLog(null)} />
    </Box>
  );
}
