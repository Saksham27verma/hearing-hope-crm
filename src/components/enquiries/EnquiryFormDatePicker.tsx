'use client';

import * as React from 'react';
import { Box } from '@mui/material';
import { alpha, type SxProps, type Theme } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { PickersActionBarAction } from '@mui/x-date-pickers/PickersActionBar';
import { format, isValid, parse, parseISO } from 'date-fns';
import { CalendarClock, CalendarDays } from 'lucide-react';

/** Stored enquiry / visit dates use `yyyy-MM-dd` strings; the date adapter uses `Date | null`. */
export function parseEnquiryDateString(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === '') return null;
  const raw = String(value).trim();
  const s = raw.slice(0, 10);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : raw;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

/** Stored follow-up / telecalling values: `yyyy-MM-dd'T'HH:mm` (local, no TZ) or date-only fallback. */
export function parseEnquiryDateTimeString(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === '') return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    const d = parse(raw, "yyyy-MM-dd'T'HH:mm", new Date());
    return isValid(d) ? d : null;
  }
  return parseEnquiryDateString(raw.length >= 10 ? raw.slice(0, 10) : raw);
}

const enquiryDatePickerPopperSlotProps = {
  popper: {
    placement: 'bottom-start' as const,
    sx: { zIndex: (t: Theme) => t.zIndex.modal + 1 },
  },
  desktopPaper: {
    sx: {
      mt: 0.5,
      p: 0,
      borderRadius: '12px',
      border: '1px solid',
      borderColor: 'divider',
      boxShadow: (t: Theme) =>
        t.palette.mode === 'light'
          ? '0 10px 40px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06)'
          : '0 12px 40px rgba(0, 0, 0, 0.45)',
      bgcolor: 'background.paper',
      overflow: 'hidden',
    },
  },
  calendarHeader: {
    sx: {
      px: 1.25,
      py: 1,
      borderBottom: '1px solid',
      borderColor: 'divider',
      bgcolor: (t: Theme) =>
        t.palette.mode === 'light' ? alpha(t.palette.grey[50], 0.95) : alpha(t.palette.common.white, 0.03),
      '& .MuiPickersCalendarHeader-labelContainer': {
        fontWeight: 700,
        fontSize: '0.9375rem',
        letterSpacing: '-0.02em',
      },
      '& .MuiIconButton-root': {
        borderRadius: 1,
        color: 'text.secondary',
        '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
      },
    },
  },
  day: {
    sx: {
      borderRadius: '8px',
      fontSize: '0.8125rem',
      fontWeight: 500,
      '&.MuiPickersDay-root.Mui-selected': {
        fontWeight: 700,
        boxShadow: (t: Theme) =>
          t.palette.mode === 'light' ? `0 2px 8px ${alpha(t.palette.primary.main, 0.35)}` : undefined,
      },
    },
  },
  actionBar: {
    actions: ['clear', 'today'] satisfies PickersActionBarAction[],
    sx: {
      px: 1.25,
      py: 1,
      borderTop: '1px solid',
      borderColor: 'divider',
      bgcolor: (t: Theme) =>
        t.palette.mode === 'light' ? alpha(t.palette.grey[50], 0.95) : alpha(t.palette.common.white, 0.04),
      '& .MuiButton-root': {
        textTransform: 'none' as const,
        fontWeight: 600,
        borderRadius: 1,
        fontSize: '0.8125rem',
      },
    },
  },
};

/** Matches enquiry form outlined fields (Pickers use `MuiPickersOutlinedInput-*`). */
const enquiryDatePickerFieldSx: SxProps<Theme> = {
  '& .MuiPickersOutlinedInput-root': {
    borderRadius: '8px',
    minWidth: 0,
    maxWidth: '100%',
    bgcolor: (t) => (t.palette.mode === 'light' ? '#ffffff' : alpha(t.palette.common.black, 0.15)),
  },
  '& .MuiPickersOutlinedInput-input': {
    fontSize: '0.875rem',
    py: 0.75,
    minHeight: 40,
    boxSizing: 'border-box',
  },
  '& .MuiPickersOutlinedInput-notchedOutline': {
    borderColor: (t) => (t.palette.mode === 'light' ? '#e2e8f0' : alpha(t.palette.common.white, 0.14)),
  },
  '&:hover .MuiPickersOutlinedInput-notchedOutline': {
    borderColor: (t) => (t.palette.mode === 'light' ? '#cbd5e1' : alpha(t.palette.common.white, 0.22)),
  },
  '& .MuiPickersOutlinedInput-input::placeholder': {
    color: 'text.disabled',
    opacity: 1,
  },
};

export function EnquiryFormDatePickerProvider({ children }: { children: React.ReactNode }) {
  return <LocalizationProvider dateAdapter={AdapterDateFns}>{children}</LocalizationProvider>;
}

export type EnquiryFormDatePickerProps = {
  /** Visible label (omit when using `hiddenLabel` + external `EnquiryFieldLabel`). */
  label?: string;
  /** `yyyy-MM-dd` or empty string */
  value: string;
  onChange: (yyyyMmDd: string) => void;
  disabled?: boolean;
  required?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  helperText?: string;
  placeholder?: string;
  /** Use with an external caption label; hides the floating notch label. */
  hiddenLabel?: boolean;
  id?: string;
  name?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  sx?: SxProps<Theme>;
  showActionBar?: boolean;
  closeOnSelect?: boolean;
  format?: string;
};

export function EnquiryFormDatePicker({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  size = 'small',
  fullWidth = true,
  helperText,
  placeholder = 'Select date',
  hiddenLabel = false,
  id,
  name,
  inputRef,
  onBlur,
  sx,
  showActionBar = true,
  closeOnSelect = true,
  format: formatStr = 'dd MMM yyyy',
}: EnquiryFormDatePickerProps) {
  const popperSlots = showActionBar
    ? enquiryDatePickerPopperSlotProps
    : {
        popper: enquiryDatePickerPopperSlotProps.popper,
        desktopPaper: enquiryDatePickerPopperSlotProps.desktopPaper,
        calendarHeader: enquiryDatePickerPopperSlotProps.calendarHeader,
        day: enquiryDatePickerPopperSlotProps.day,
      };

  return (
    <DatePicker
      format={formatStr}
      label={hiddenLabel ? undefined : label}
      value={parseEnquiryDateString(value)}
      onChange={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
      disabled={disabled}
      closeOnSelect={closeOnSelect}
      slots={{
        openPickerIcon: () => (
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              mr: -0.25,
            }}
          >
            <CalendarDays size={18} strokeWidth={1.5} aria-hidden />
          </Box>
        ),
      }}
      slotProps={{
        ...popperSlots,
        textField: {
          id,
          name,
          inputRef,
          onBlur,
          size,
          fullWidth,
          required,
          hiddenLabel,
          placeholder,
          helperText,
          InputLabelProps: hiddenLabel ? undefined : { shrink: true },
          sx: sx ? ([enquiryDatePickerFieldSx, sx] as SxProps<Theme>) : enquiryDatePickerFieldSx,
        },
      }}
    />
  );
}

export type EnquiryFormDateTimePickerProps = {
  label?: string;
  /** `yyyy-MM-dd'T'HH:mm` (local) or empty */
  value: string;
  onChange: (yyyyMmDdTHhMm: string) => void;
  disabled?: boolean;
  required?: boolean;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
};

/** Date + time picker aligned with telecalling records (`yyyy-MM-dd'T'HH:mm`). */
export function EnquiryFormDateTimePicker({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  size = 'small',
  fullWidth = true,
  helperText,
  sx,
}: EnquiryFormDateTimePickerProps) {
  return (
    <DateTimePicker
      format="dd MMM yyyy, HH:mm"
      ampm={false}
      label={label}
      value={parseEnquiryDateTimeString(value)}
      onChange={(d) => onChange(d && isValid(d) ? format(d, "yyyy-MM-dd'T'HH:mm") : '')}
      disabled={disabled}
      closeOnSelect={false}
      slotProps={{
        ...enquiryDatePickerPopperSlotProps,
        textField: {
          size,
          fullWidth,
          required,
          helperText,
          InputLabelProps: { shrink: true },
          sx: sx ? ([enquiryDatePickerFieldSx, sx] as SxProps<Theme>) : enquiryDatePickerFieldSx,
        },
      }}
      slots={{
        openPickerIcon: () => (
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              mr: -0.25,
            }}
          >
            <CalendarClock size={18} strokeWidth={1.5} aria-hidden />
          </Box>
        ),
      }}
    />
  );
}
