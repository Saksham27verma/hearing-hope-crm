'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Paper,
  Tab,
  Tabs,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import HopeAIAdminPanel from './HopeAIAdminPanel';
import HopeAIMessageList from './HopeAIMessageList';
import HopeAIComposer from './HopeAIComposer';
import type { HopeAIMessageView } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  'Show the latest high-value enquiries and their current status.',
  'Which sales were created today and what are their invoice numbers?',
  'Find stock movement for a given serial number or product.',
  'Summarize purchase activity for a supplier or invoice number.',
];

export default function HopeAIDrawer({ open, onClose }: Props) {
  const { user, userProfile } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [tab, setTab] = useState<'chat' | 'admin'>('chat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<HopeAIMessageView[]>([]);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = userProfile?.role === 'admin';
  const hasUserMessages = messages.some(message => message.role === 'user');

  const history = useMemo(
    () => messages
      .filter(message => !message.error)
      .map(message => ({ role: message.role, content: message.content })),
    [messages]
  );

  const resetChat = () => {
    setMessages([]);
    setPrompt('');
    setError('');
  };

  useEffect(() => {
    if (tab !== 'chat') return;
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, tab]);

  const getAuthToken = async () => {
    if (!user) throw new Error('You must be signed in to use Hope AI');
    return user.getIdToken();
  };

  const sendPrompt = async (forcedPrompt?: string) => {
    const nextPrompt = (forcedPrompt ?? prompt).trim();
    if (!nextPrompt) return;

    setLoading(true);
    setError('');

    const userMessage: HopeAIMessageView = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: nextPrompt,
    };

    setMessages(prev => [...prev, userMessage]);
    setPrompt('');

    try {
      const token = await getAuthToken();
      const response = await fetch('/api/hope-ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: nextPrompt,
          history,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Hope AI request failed');

      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.answer,
          citations: data.citations || [],
          exactResults: data.exactResults || [],
          retrievalMode: data.retrievalMode,
        },
      ]);
    } catch (requestError: any) {
      const message = requestError?.message || 'Failed to contact Hope AI';
      setError(message);
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: message,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: '100vw',
          maxWidth: '100vw',
          height: '100%',
          boxShadow: 'none',
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0a0a0a' }}>
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.75,
            bgcolor: 'grey.900',
            borderBottom: '1px solid',
            borderColor: 'grey.800',
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5} minWidth={0}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: 'grey.800',
                  color: 'common.white',
                }}
              >
                <SmartToyIcon fontSize="small" />
              </Avatar>
              <Box minWidth={0}>
                <Typography variant="h6" fontWeight={700} sx={{ color: 'grey.50' }}>
                  Hope AI
                </Typography>
                <Typography variant="body2" sx={{ color: 'grey.400' }} noWrap>
                  Ask anything across your CRM with live retrieval and cited answers.
                </Typography>
                <Stack direction="row" spacing={1} mt={0.75} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    label={isAdmin ? 'Admin scope enabled' : 'Role-aware access'}
                    variant="outlined"
                    sx={{ borderColor: 'grey.700', color: 'grey.300' }}
                  />
                  <Chip
                    size="small"
                    label="Live retrieval + citations"
                    variant="outlined"
                    sx={{ borderColor: 'grey.700', color: 'grey.300' }}
                  />
                </Stack>
              </Box>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {isAdmin && (
                <Tabs
                  value={tab}
                  onChange={(_, value) => setTab(value)}
                  sx={{
                    minHeight: 36,
                    mr: 0.5,
                    '& .MuiTab-root': {
                      minHeight: 36,
                      minWidth: 72,
                      px: 1.5,
                      borderRadius: 999,
                      color: 'grey.400',
                      textTransform: 'none',
                      fontWeight: 600,
                    },
                    '& .Mui-selected': {
                      color: 'warning.light',
                      bgcolor: 'rgba(255, 183, 140, 0.2)',
                    },
                    '& .MuiTabs-indicator': {
                      display: 'none',
                    },
                  }}
                >
                  <Tab value="chat" label="Chat" />
                  <Tab value="admin" label="Admin" />
                </Tabs>
              )}
              <IconButton onClick={resetChat} sx={{ color: 'grey.200' }}>
                <RefreshIcon />
              </IconButton>
              <IconButton onClick={onClose} sx={{ color: 'grey.200' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>
        </Box>

        {tab === 'chat' ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                bgcolor: '#0a0a0a',
                px: { xs: 2, md: 3 },
                py: 3,
              }}
            >
              <Box sx={{ maxWidth: 980, mx: 'auto', minHeight: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
                {!hasUserMessages && !loading && (
                  <Box
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      py: { xs: 4, md: 8 },
                    }}
                  >
                    <Stack spacing={4} alignItems="center" sx={{ width: '100%', maxWidth: 900, px: 1 }}>
                      <Box textAlign="center">
                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mb: 1.5, color: 'grey.500' }}>
                          <AutoAwesomeIcon sx={{ fontSize: 20 }} />
                          <Typography variant="caption" fontWeight={700} letterSpacing="0.12em" sx={{ color: 'grey.400' }}>
                            HOPE AI
                          </Typography>
                        </Stack>
                        <Typography
                          variant="h4"
                          component="h1"
                          fontWeight={700}
                          sx={{
                            color: 'grey.50',
                            fontSize: { xs: '1.75rem', md: '2.25rem' },
                            lineHeight: 1.2,
                          }}
                        >
                          What can Hope AI help you find?
                        </Typography>
                        <Typography
                          variant="body1"
                          sx={{
                            mt: 1.5,
                            color: 'grey.400',
                            maxWidth: 640,
                            mx: 'auto',
                            px: 1,
                          }}
                        >
                          Ask about enquiries, sales, products, inventory movement, purchases, invoice details, serial
                          journeys, branch activity, or report summaries.
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 1.5,
                          width: '100%',
                          maxWidth: 720,
                        }}
                      >
                        {SUGGESTIONS.map((suggestion) => (
                          <Button
                            key={suggestion}
                            variant="outlined"
                            onClick={() => sendPrompt(suggestion)}
                            sx={{
                              borderRadius: 999,
                              borderColor: 'grey.800',
                              bgcolor: 'grey.900',
                              color: 'grey.300',
                              textAlign: 'left',
                              justifyContent: 'flex-start',
                              py: 1.5,
                              px: 2,
                              fontSize: '0.75rem',
                              lineHeight: 1.45,
                              whiteSpace: 'normal',
                              textTransform: 'none',
                              '&:hover': {
                                borderColor: 'grey.600',
                                bgcolor: 'grey.800',
                                color: 'grey.50',
                              },
                            }}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </Box>
                    </Stack>
                  </Box>
                )}

                {hasUserMessages && (
                  <Box sx={{ width: '100%', py: 1 }}>
                    <HopeAIMessageList messages={messages} />
                  </Box>
                )}

                {error ? (
                  <Box
                    sx={{
                      mb: 2,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'rgba(180, 83, 9, 0.45)',
                      bgcolor: 'rgba(69, 26, 3, 0.45)',
                      px: 2,
                      py: 1.5,
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'warning.light' }}>
                      {error}
                    </Typography>
                  </Box>
                ) : null}

                {loading ? (
                  <Box display="flex" justifyContent="flex-start" mt={2} width="100%">
                    <Paper
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 2,
                        py: 1.5,
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'grey.800',
                        bgcolor: 'grey.900',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                      }}
                    >
                      <CircularProgress size={18} sx={{ color: 'grey.400' }} />
                      <Typography variant="body2" sx={{ color: 'grey.300' }}>
                        Hope AI is analyzing your CRM data...
                      </Typography>
                    </Paper>
                  </Box>
                ) : null}

                <Box ref={conversationEndRef} />
              </Box>
            </Box>

            <Box
              sx={{
                borderTop: '1px solid',
                borderColor: 'grey.800',
                bgcolor: '#0a0a0a',
                px: { xs: 2, md: 3 },
                py: 2,
              }}
            >
              <Box sx={{ maxWidth: 980, mx: 'auto' }}>
                <HopeAIComposer
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={() => sendPrompt()}
                  loading={loading}
                />
              </Box>
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              px: { xs: 1.5, md: 3 },
              py: 2.5,
              bgcolor: 'grey.100',
            }}
          >
            <Box sx={{ maxWidth: 980, mx: 'auto' }}>
              {isAdmin ? <HopeAIAdminPanel getAuthToken={getAuthToken} /> : null}
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
