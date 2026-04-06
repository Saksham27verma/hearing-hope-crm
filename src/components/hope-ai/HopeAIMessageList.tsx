'use client';

import React from 'react';
import { Avatar, Box, Paper, Stack, Typography } from '@mui/material';
import type { HopeAIMessageView } from './types';

interface Props {
  messages: HopeAIMessageView[];
}

function renderMessageBody(content: string, message: HopeAIMessageView) {
  const isUser = message.role === 'user';
  const isError = Boolean(message.error);

  const primary = isError ? 'error.light' : isUser ? 'common.white' : 'grey.100';
  const secondary = isError ? 'error.light' : isUser ? 'rgba(255,255,255,0.75)' : 'grey.400';

  return content.split('\n').map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <Box key={`spacer-${index}`} sx={{ height: 6 }} />;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      return (
        <Typography
          key={`heading-${index}`}
          variant="body2"
          fontWeight={700}
          sx={{ mt: index === 0 ? 0 : 1.5, color: primary }}
        >
          {trimmed.replace(/^#{1,3}\s/, '')}
        </Typography>
      );
    }

    if ((trimmed.endsWith(':') || trimmed.endsWith(':**')) && trimmed.length < 60) {
      return (
        <Typography
          key={`heading-${index}`}
          variant="body2"
          fontWeight={700}
          sx={{ mt: index === 0 ? 0 : 1.5, color: primary }}
        >
          {trimmed.replace(/\*\*/g, '')}
        </Typography>
      );
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const text = trimmed.startsWith('- ') ? trimmed.slice(2) : trimmed.slice(2);
      return (
        <Box key={`bullet-${index}`} display="flex" gap={1} alignItems="flex-start" sx={{ mt: 0.5 }}>
          <Box
            sx={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: isUser ? 'rgba(255,255,255,0.6)' : 'grey.500',
              mt: 0.9,
              flexShrink: 0,
            }}
          />
          <Typography
            variant="body2"
            sx={{ color: primary, '& strong': { fontWeight: 600 } }}
            dangerouslySetInnerHTML={{
              __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
            }}
          />
        </Box>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <Box key={`numbered-${index}`} display="flex" gap={1} alignItems="flex-start" sx={{ mt: 0.5 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ minWidth: 18, flexShrink: 0, color: secondary }}
          >
            {trimmed.match(/^\d+/)?.[0]}.
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: primary, '& strong': { fontWeight: 600 } }}
            dangerouslySetInnerHTML={{
              __html: trimmed.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
            }}
          />
        </Box>
      );
    }

    return (
      <Typography
        key={`line-${index}`}
        variant="body2"
        sx={{ mt: 0.25, color: primary, '& strong': { fontWeight: 600 } }}
        dangerouslySetInnerHTML={{
          __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
        }}
      />
    );
  });
}

export default function HopeAIMessageList({ messages }: Props) {
  return (
    <Stack spacing={3}>
      {messages.map((message) => {
        const isUser = message.role === 'user';
        return (
          <Box
            key={message.id}
            display="flex"
            justifyContent={isUser ? 'flex-end' : 'flex-start'}
            gap={1.5}
          >
            {!isUser && (
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  mt: 0.5,
                  bgcolor: message.error ? 'error.main' : 'grey.700',
                  color: 'common.white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                H
              </Avatar>
            )}
            <Paper
              elevation={0}
              sx={{
                p: 2,
                maxWidth: { xs: '92%', md: '82%' },
                borderRadius: 4,
                border: '1px solid',
                borderColor: isUser
                  ? 'grey.700'
                  : message.error
                    ? 'error.dark'
                    : 'grey.700',
                bgcolor: isUser ? 'grey.900' : message.error ? 'rgba(127, 29, 29, 0.25)' : 'rgba(23, 23, 23, 0.85)',
                color: isUser ? 'common.white' : 'grey.100',
                boxShadow: isUser ? '0 14px 34px rgba(0,0,0,0.35)' : '0 8px 24px rgba(0,0,0,0.25)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  fontSize: '0.6875rem',
                  color: isUser ? 'rgba(255,255,255,0.6)' : 'grey.500',
                }}
              >
                {isUser ? 'You' : 'Hope AI'}
              </Typography>
              <Box sx={message.error ? { color: 'error.light' } : undefined}>
                {renderMessageBody(message.content, message)}
              </Box>
            </Paper>
            {isUser && (
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  mt: 0.5,
                  bgcolor: 'grey.600',
                  color: 'common.white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Y
              </Avatar>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
