'use client';

import React from 'react';
import {
  Avatar,
  Box,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { HopeAIMessageView } from './types';

interface Props {
  messages: HopeAIMessageView[];
}

function renderMessageBody(content: string) {
  return content.split('\n').map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <Box key={`spacer-${index}`} sx={{ height: 6 }} />;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      return (
        <Typography key={`heading-${index}`} variant="subtitle2" fontWeight={700} sx={{ mt: index === 0 ? 0 : 1.25 }}>
          {trimmed.replace(/^#{1,3}\s/, '')}
        </Typography>
      );
    }

    if ((trimmed.endsWith(':') || trimmed.endsWith(':**')) && trimmed.length < 60) {
      return (
        <Typography key={`heading-${index}`} variant="subtitle2" fontWeight={700} sx={{ mt: index === 0 ? 0 : 1.25 }}>
          {trimmed.replace(/\*\*/g, '')}
        </Typography>
      );
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const text = trimmed.startsWith('- ') ? trimmed.slice(2) : trimmed.slice(2);
      return (
        <Box key={`bullet-${index}`} display="flex" gap={1} alignItems="flex-start" sx={{ mt: 0.5 }}>
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'text.secondary', mt: 0.9, flexShrink: 0 }} />
          <Typography variant="body2" color="text.primary" sx={{ '& strong': { fontWeight: 600 } }}
            dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
          />
        </Box>
      );
    }

    if (/^\d+\.\s/.test(trimmed)) {
      return (
        <Box key={`numbered-${index}`} display="flex" gap={1} alignItems="flex-start" sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ minWidth: 18, flexShrink: 0 }}>
            {trimmed.match(/^\d+/)?.[0]}.
          </Typography>
          <Typography variant="body2" color="text.primary" sx={{ '& strong': { fontWeight: 600 } }}
            dangerouslySetInnerHTML={{ __html: trimmed.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
          />
        </Box>
      );
    }

    return (
      <Typography key={`line-${index}`} variant="body2" color="text.primary" sx={{ mt: 0.25, '& strong': { fontWeight: 600 } }}
        dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
      />
    );
  });
}

export default function HopeAIMessageList({ messages }: Props) {
  return (
    <Stack spacing={2.5}>
      {messages.map((message) => (
        <Box
          key={message.id}
          display="flex"
          justifyContent={message.role === 'user' ? 'flex-end' : 'flex-start'}
          gap={1.25}
        >
          {message.role === 'assistant' && (
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: message.error ? 'error.main' : 'grey.900',
                color: 'common.white',
                mt: 0.5,
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
              borderColor: message.role === 'user' ? 'grey.900' : 'divider',
              bgcolor: message.role === 'user' ? 'grey.900' : 'background.paper',
              color: message.role === 'user' ? 'common.white' : 'text.primary',
              boxShadow: message.role === 'user' ? '0 14px 34px rgba(15, 23, 42, 0.14)' : '0 8px 24px rgba(15, 23, 42, 0.06)',
            }}
          >
            <Typography
              variant="caption"
              color={message.role === 'user' ? 'rgba(255,255,255,0.7)' : 'text.secondary'}
              sx={{ display: 'block', mb: 0.75 }}
            >
              {message.role === 'user' ? 'You' : 'Hope AI'}
            </Typography>
            <Box color={message.error ? 'error.main' : 'inherit'}>
              {renderMessageBody(message.content)}
            </Box>
          </Paper>
          {message.role === 'user' && (
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'grey.700', color: 'common.white', mt: 0.5 }}>
              Y
            </Avatar>
          )}
        </Box>
      ))}
    </Stack>
  );
}
