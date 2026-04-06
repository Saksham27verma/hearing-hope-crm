'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ENQUIRY_STATUS_OPTIONS,
  type EnquiryJourneyStatus,
  type EnquiryStatusChipColor,
} from '@/utils/enquiryStatus';

/** `auto` = store `journeyStatusOverride: null` (follow visits + lead outcome). */
export type JourneySelectValue = 'auto' | EnquiryJourneyStatus;

export interface JourneyConfirmDialogProps {
  open: boolean;
  /** What automatic derivation would show (override stripped). */
  suggested: { label: string; key: EnquiryJourneyStatus; color: EnquiryStatusChipColor };
  value: JourneySelectValue;
  onChange: (next: JourneySelectValue) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function JourneyConfirmDialog({
  open,
  suggested,
  value,
  onChange,
  onConfirm,
  onCancel,
}: JourneyConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Journey tag</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The system suggests a tag from visits and lead outcome. If that looks wrong, pick another
          below — or set the tag from the enquiries list / profile later.
        </Typography>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2">Automatic suggestion:</Typography>
          <Chip label={suggested.label} color={suggested.color} size="small" sx={{ fontWeight: 600 }} />
        </Box>
        <FormControl fullWidth size="small">
          <InputLabel id="journey-save-select-label">Save tag as</InputLabel>
          <Select
            labelId="journey-save-select-label"
            label="Save tag as"
            value={value}
            onChange={(e) => onChange(e.target.value as JourneySelectValue)}
          >
            <MenuItem value="auto">
              Automatic — follow visits (suggested: {suggested.label})
            </MenuItem>
            {ENQUIRY_STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                Pin: {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>
          Save enquiry
        </Button>
      </DialogActions>
    </Dialog>
  );
}
