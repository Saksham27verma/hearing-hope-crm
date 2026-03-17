'use client';

import React from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import AsyncActionButton from '@/components/common/AsyncActionButton';
import { ButtonProps } from '@mui/material';

interface RefreshDataButtonProps extends Omit<ButtonProps, 'children'> {
  loading?: boolean;
  label?: React.ReactNode;
}

export default function RefreshDataButton({
  loading = false,
  label = 'Refresh',
  variant = 'outlined',
  ...props
}: RefreshDataButtonProps) {
  return (
    <AsyncActionButton
      {...props}
      variant={variant}
      startIcon={<RefreshIcon />}
      loading={loading}
      loadingText="Refreshing..."
    >
      {label}
    </AsyncActionButton>
  );
}
