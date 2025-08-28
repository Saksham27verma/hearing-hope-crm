'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function PurchasesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new purchase management page
    router.push('/purchase-management');
  }, [router]);

  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      alignItems="center" 
      justifyContent="center" 
      minHeight="80vh"
      gap={2}
    >
      <CircularProgress color="primary" />
      <Typography variant="body1">
        Redirecting to Purchase Management...
      </Typography>
    </Box>
  );
} 