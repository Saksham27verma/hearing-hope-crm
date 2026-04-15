'use client';

import React from 'react';
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
      href={`/interaction/enquiries/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        event.stopPropagation();
      }}
      underline="hover"
      fontWeight={600}
      color="primary"
    >
      {children}
    </MuiLink>
  );
}
