'use client';

import dynamic from 'next/dynamic';
import { CircularProgress, Box } from '@mui/material';

// Loading component for lazy-loaded components
const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
    <CircularProgress size={24} />
  </Box>
);

// Lazy load heavy components to improve initial page load
export const LazyInventoryPage = dynamic(() => import('@/app/(protected)/inventory/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyEnquiriesPage = dynamic(() => import('@/app/(protected)/interaction/enquiries/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazySimplifiedEnquiryForm = dynamic(() => import('@/components/enquiries/SimplifiedEnquiryForm'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyDistributionForm = dynamic(() => import('@/components/distribution/DistributionForm'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazySalesPage = dynamic(() => import('@/app/(protected)/sales/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyProductsPage = dynamic(() => import('@/app/(protected)/products/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyMaterialOutPage = dynamic(() => import('@/app/(protected)/material-out/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyMaterialInPage = dynamic(() => import('@/app/(protected)/material-in/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyStockTransferPage = dynamic(() => import('@/app/(protected)/stock-transfer/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyReportsPage = dynamic(() => import('@/app/(protected)/reports/page'), {
  loading: LoadingFallback,
  ssr: false
});

export const LazyUniversalSearch = dynamic(() => import('@/components/universal-search/UniversalSearch'), {
  loading: () => null, // No loading for search as it's a modal
  ssr: false
});

// Error Boundary Component
export const ErrorBoundary = ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) => {
  return (
    <div>
      {children}
    </div>
  );
};
