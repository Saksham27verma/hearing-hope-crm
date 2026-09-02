'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  HighlightOff as HighlightOffIcon,
  Star as StarIcon,
} from '@mui/icons-material';

export type GoogleReviewPromptAnswer = {
  taken: boolean;
  reason: string;
};

export default function GoogleReviewPromptDialog({
  open,
  patientName,
  onConfirm,
}: {
  open: boolean;
  patientName: string;
  onConfirm: (answer: GoogleReviewPromptAnswer) => void;
}) {
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    if (!open) return;
    setChoice(null);
    setReason('');
    setReasonError('');
  }, [open]);

  const reasonTrimmed = reason.trim();
  const canSubmitNo = reasonTrimmed.length >= 5;

  const submitYes = () => {
    onConfirm({ taken: true, reason: '' });
  };

  const submitNo = () => {
    if (!canSubmitNo) {
      setReasonError('Please enter a reason (at least 5 characters). This is required.');
      return;
    }
    onConfirm({ taken: false, reason: reasonTrimmed });
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      onClose={(_, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
      }}
      PaperProps={{
        sx: {
          borderRadius: 4,
          minHeight: { xs: '78vh', sm: 640 },
          overflow: 'hidden',
          border: '4px solid #1a73e8',
        },
      }}
    >
      <Box
        sx={{
          px: { xs: 2.5, sm: 4 },
          py: 2.5,
          background: 'linear-gradient(135deg, #1a73e8 0%, #174ea6 55%, #0d47a1 100%)',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 1 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <StarIcon key={i} sx={{ fontSize: 36, color: '#fbbc04' }} />
          ))}
        </Box>
        <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, sm: 32 }, lineHeight: 1.15, letterSpacing: 0.2 }}>
          Google review required
        </Typography>
        <Typography sx={{ mt: 1, fontWeight: 600, fontSize: { xs: 15, sm: 18 }, opacity: 0.95 }}>
          Ask the patient for a Google review before you leave this screen.
        </Typography>
      </Box>

      <DialogContent sx={{ px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 4 } }}>
        <Box
          sx={{
            mb: 3,
            p: 2.5,
            borderRadius: 3,
            bgcolor: 'rgba(26, 115, 232, 0.08)',
            border: '2px solid rgba(26, 115, 232, 0.25)',
            textAlign: 'center',
          }}
        >
          <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 1.2, color: 'text.secondary' }}>
            Patient
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 22, sm: 28 }, lineHeight: 1.2 }}>
            {patientName || 'This patient'}
          </Typography>
        </Box>

        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: 20, sm: 26 },
            textAlign: 'center',
            mb: 3,
            lineHeight: 1.25,
          }}
        >
          Have you taken a Google review from this patient?
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            mb: 3,
          }}
        >
          <Button
            variant={choice === 'yes' ? 'contained' : 'outlined'}
            color="success"
            onClick={() => {
              setChoice('yes');
              setReasonError('');
              submitYes();
            }}
            sx={{
              py: 3.5,
              borderRadius: 3,
              borderWidth: 3,
              fontSize: { xs: 18, sm: 22 },
              fontWeight: 900,
              textTransform: 'none',
              minHeight: 96,
            }}
            startIcon={<CheckCircleIcon sx={{ fontSize: 36 }} />}
          >
            Yes — review taken
          </Button>
          <Button
            variant={choice === 'no' ? 'contained' : 'outlined'}
            color="error"
            onClick={() => setChoice('no')}
            sx={{
              py: 3.5,
              borderRadius: 3,
              borderWidth: 3,
              fontSize: { xs: 18, sm: 22 },
              fontWeight: 900,
              textTransform: 'none',
              minHeight: 96,
            }}
            startIcon={<HighlightOffIcon sx={{ fontSize: 36 }} />}
          >
            No — not taken
          </Button>
        </Box>

        {choice === 'no' ? (
          <Box>
            <Typography sx={{ fontWeight: 800, mb: 1.25, fontSize: 18 }}>
              Why was the review not taken? (required)
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError('');
              }}
              placeholder="e.g. Patient was in a hurry, will send the link on WhatsApp, declined, language barrier…"
              error={Boolean(reasonError)}
              helperText={reasonError || 'This reason is saved on the enquiry. You cannot skip this step.'}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: 18,
                  borderRadius: 2,
                },
              }}
            />
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={submitNo}
              disabled={!canSubmitNo}
              sx={{
                mt: 2.5,
                py: 2,
                borderRadius: 3,
                fontSize: 20,
                fontWeight: 900,
                textTransform: 'none',
              }}
            >
              Confirm reason & continue
            </Button>
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600, fontSize: 16 }}>
            This popup appears only once, the first time this sale is saved. You cannot close it without answering.
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
