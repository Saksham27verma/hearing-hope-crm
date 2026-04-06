'use client';

import { type KeyboardEvent } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowUpward as ArrowUpwardIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';

export interface HopeAIComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  placeholder?: string;
}

const DEFAULT_PLACEHOLDER =
  'Ask Hope AI about enquiries, products, sales, stock, reports, invoices, or centers...';

export default function HopeAIComposer({
  value,
  onChange,
  onSubmit,
  loading = false,
  placeholder = DEFAULT_PLACEHOLDER,
}: HopeAIComposerProps) {
  const canSend = !loading && value.trim().length > 0;

  const handleSubmit = () => {
    if (!canSend) return;
    onSubmit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'grey.800',
          bgcolor: 'grey.900',
          overflow: 'hidden',
        }}
      >
        <TextField
          multiline
          minRows={2}
          maxRows={8}
          fullWidth
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          variant="standard"
          InputProps={{
            disableUnderline: true,
            sx: {
              px: 2,
              py: 1.5,
              color: 'common.white',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              alignItems: 'flex-start',
              '&::placeholder': {
                color: 'grey.500',
                opacity: 1,
              },
            },
          }}
          sx={{
            '& .MuiInputBase-input': {
              '&::placeholder': {
                color: 'grey.500',
                opacity: 1,
              },
            },
            '& .MuiInputBase-root.Mui-disabled': {
              opacity: 0.6,
            },
          }}
        />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            py: 1,
          }}
        >
          <IconButton
            size="small"
            disabled
            title="Coming soon"
            aria-disabled
            sx={{
              color: 'grey.500',
              opacity: 0.6,
              borderRadius: 2,
            }}
          >
            <AttachFileIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label={loading ? 'Sending' : 'Send'}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: canSend ? 'grey.600' : 'grey.700',
              bgcolor: canSend ? 'common.white' : 'transparent',
              color: canSend ? 'common.black' : 'grey.500',
              '&:hover': {
                bgcolor: canSend ? 'grey.100' : 'transparent',
              },
              '&.Mui-disabled': {
                borderColor: 'grey.700',
                color: 'grey.500',
              },
            }}
          >
            {loading ? (
              <CircularProgress size={18} sx={{ color: 'grey.700' }} />
            ) : (
              <ArrowUpwardIcon sx={{ fontSize: 18, color: canSend ? 'common.black' : 'grey.500' }} />
            )}
          </IconButton>
        </Box>
      </Box>
      <Typography
        variant="caption"
        sx={{ display: 'block', mt: 1.5, textAlign: 'center', color: 'grey.500' }}
      >
        Press Enter to send, Shift+Enter for a new line.
      </Typography>
    </Box>
  );
}
