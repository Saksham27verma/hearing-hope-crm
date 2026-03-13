'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
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
import HopeAIPromptBox from './HopeAIPromptBox';
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
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
        <Box
          sx={{
            px: { xs: 2, md: 3 },
            py: 1.75,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <Box display="flex" alignItems="center" gap={1.5} minWidth={0}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: 'grey.900',
                  color: 'common.white',
                }}
              >
                <SmartToyIcon fontSize="small" />
              </Avatar>
              <Box minWidth={0}>
                <Typography variant="h6" fontWeight={700} color="text.primary">Hope AI</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  Ask anything across your CRM with live retrieval and cited answers.
                </Typography>
                <Stack direction="row" spacing={1} mt={0.75} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={isAdmin ? 'Admin scope enabled' : 'Role-aware access'} variant="outlined" />
                  <Chip size="small" label="Live retrieval + citations" variant="outlined" />
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
                      color: 'text.secondary',
                      textTransform: 'none',
                      fontWeight: 600,
                    },
                    '& .Mui-selected': {
                      color: 'text.primary',
                      bgcolor: 'grey.100',
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
              <IconButton onClick={resetChat} sx={{ color: 'text.primary' }}>
                <RefreshIcon />
              </IconButton>
              <IconButton onClick={onClose} sx={{ color: 'text.primary' }}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>
        </Box>

        {tab === 'chat' ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.5, md: 3 }, py: 2 }}>
              <Box sx={{ maxWidth: 980, mx: 'auto', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
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
                    <Paper
                      elevation={0}
                      sx={{
                        width: '100%',
                        maxWidth: 900,
                        p: { xs: 2.5, md: 4 },
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.06)',
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={1.25}>
                        <AutoAwesomeIcon sx={{ color: 'text.primary', fontSize: 18 }} />
                        <Typography variant="subtitle2" fontWeight={700}>
                          Start A Conversation
                        </Typography>
                      </Box>
                      <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mb: 1 }}>
                        How can Hope AI help today?
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5, maxWidth: 700 }}>
                        Ask about enquiries, sales, products, inventory movement, purchases, invoice details, serial journeys, branch activity, or report summaries.
                      </Typography>
                      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                        {SUGGESTIONS.map((suggestion) => (
                          <Chip
                            key={suggestion}
                            label={suggestion}
                            clickable
                            variant="outlined"
                            onClick={() => sendPrompt(suggestion)}
                            sx={{
                              justifyContent: 'flex-start',
                              height: 'auto',
                              py: 1.25,
                              px: 0.5,
                              borderRadius: 999,
                              bgcolor: '#fafafa',
                              '& .MuiChip-label': {
                                whiteSpace: 'normal',
                                px: 1.25,
                              },
                            }}
                          />
                        ))}
                      </Stack>
                    </Paper>
                  </Box>
                )}

                {hasUserMessages && (
                  <Box sx={{ width: '100%', py: 1 }}>
                    <HopeAIMessageList messages={messages} />
                  </Box>
                )}

              {error ? <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert> : null}

                {loading ? (
                  <Box display="flex" justifyContent="flex-start" mt={2} width="100%">
                    <Paper
                      elevation={0}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 2,
                        py: 1.5,
                        borderRadius: 4,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
                      }}
                    >
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Hope AI is analyzing your CRM data...
                      </Typography>
                    </Paper>
                  </Box>
                ) : null}

                <Box ref={conversationEndRef} />
              </Box>
            </Box>

            <Box sx={{ px: { xs: 1.5, md: 3 }, py: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Box sx={{ maxWidth: 980, mx: 'auto' }}>
                <HopeAIPromptBox
                  value={prompt}
                  onChange={setPrompt}
                  onSubmit={() => sendPrompt()}
                  loading={loading}
                />
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 1.5, md: 3 }, py: 2.5 }}>
            <Box sx={{ maxWidth: 980, mx: 'auto' }}>
              {isAdmin ? <HopeAIAdminPanel getAuthToken={getAuthToken} /> : null}
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
