import './globals.css';
import type { Metadata } from 'next';
import ClientProviders from './ClientProviders';

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
      <body>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
