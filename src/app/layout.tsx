'use client';

import './globals.css';
import { ThemeRegistry } from '../theme/ThemeRegistry';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Favicon (place your file at: public/favicon.png) */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </head>
      <body>
        <ThemeRegistry>
          <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </SnackbarProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
