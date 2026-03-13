'use client';

import React from 'react';
import {
  Box,
  Button,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

export default function HopeAIPromptBox({ value, onChange, onSubmit, loading }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
      }}
    >
      <Box display="flex" gap={1.5} alignItems="flex-end">
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          placeholder="Ask Hope AI about enquiries, products, sales, stock, reports, invoices, or centers..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                Ask
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              bgcolor: '#fafafa',
            },
          }}
        />
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          sx={{
            minWidth: 132,
            height: 56,
            borderRadius: 3,
            bgcolor: 'grey.900',
            '&:hover': {
              bgcolor: 'grey.800',
            },
          }}
          startIcon={<SendIcon />}
        >
          {loading ? 'Thinking...' : 'Send'}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Press Enter to send, Shift+Enter for a new line.
      </Typography>
    </Paper>
  );
}
