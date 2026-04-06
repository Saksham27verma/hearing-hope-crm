'use client';

import React from 'react';
import NextLink from 'next/link';
import MuiLink from '@mui/material/Link';

type Props = {
  enquiryId: string;
  children: React.ReactNode;
};

/** Navigates to the enquiry profile (`/interaction/enquiries/[id]`). */
export default function EnquiryProfileLink({ enquiryId, children }: Props) {
  const id = String(enquiryId || '').trim();
  if (!id) return <>{children}</>;
  return (
    <MuiLink
      component={NextLink}
      href={`/interaction/enquiries/${id}`}
      underline="hover"
      fontWeight={600}
      color="primary"
    >
      {children}
    </MuiLink>
  );
}
