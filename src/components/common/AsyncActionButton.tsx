'use client';

import React from 'react';
import { Button, ButtonProps, CircularProgress } from '@mui/material';

interface AsyncActionButtonProps extends Omit<ButtonProps, 'children'> {
  loading?: boolean;
  loadingText?: React.ReactNode;
  children: React.ReactNode;
}

export default function AsyncActionButton({
  loading = false,
  loadingText,
  disabled,
  startIcon,
  children,
  ...props
}: AsyncActionButtonProps) {
  return (
    <Button
      {...props}
      disabled={loading || disabled}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : startIcon}
    >
      {loading ? (loadingText ?? children) : children}
    </Button>
  );
}
