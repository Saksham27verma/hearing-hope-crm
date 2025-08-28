'use client';

import React from 'react';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px' }}>
      <h1>CRM System</h1>
      {children}
    </div>
  );
}
