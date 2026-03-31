/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React from 'react';
import { ThemeRegistry } from '../theme/ThemeRegistry';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../context/AuthContext';
import { CenterScopeProvider } from '../context/CenterScopeContext';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry>
      <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
        <AuthProvider>
          <CenterScopeProvider>{children}</CenterScopeProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeRegistry>
  );
}

