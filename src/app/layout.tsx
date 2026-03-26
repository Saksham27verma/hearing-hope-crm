import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import ClientProviders from './ClientProviders';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const ICON_VERSION = '1';

export const metadata: Metadata = {
  title: 'Hearing Hope CRM & Inventory',
  description: 'A comprehensive inventory and CRM system for Hearing Hope',
  icons: {
    icon: [{ url: `/favicon.png?v=${ICON_VERSION}`, type: 'image/png' }],
    shortcut: [{ url: `/favicon.png?v=${ICON_VERSION}`, type: 'image/png' }],
    apple: [{ url: `/favicon.png?v=${ICON_VERSION}` }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable} style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
