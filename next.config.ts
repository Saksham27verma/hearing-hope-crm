import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * jspdf / jspdf-autotable / xlsx ship mixed ESM–CJS; without transpilation webpack can throw
   * `Cannot read properties of undefined (reading 'call')` when loading export chunks.
   */
  transpilePackages: ["jspdf", "jspdf-autotable", "xlsx"],

  /**
   * Required for HTML→PDF on Vercel: without this, webpack bundles `@sparticuz/chromium` and
   * `executablePath()` / brotli extraction break → collect-payment silently falls back to the minimal pdf-lib receipt.
   */
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],

  // Performance optimizations
  poweredByHeader: false,
  compress: true,
  
  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Experimental features for better performance
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
    /** Smaller server/client modules from barrel imports — reduces flaky missing-chunk issues in dev */
    optimizePackageImports: ['lucide-react', '@mui/material', '@mui/icons-material'],
  },
  
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: true,
  },
  
  /**
   * Do not override Next's production chunk graph here.
   * In App Router builds, a custom splitChunks config can leak CSS files into
   * the root JS manifest, which causes the generated HTML to emit
   * `<script src="/_next/static/css/*.css">` and the app stalls on load.
   */
  
  async redirects() {
    return [
      {
        source: '/purchases',
        destination: '/purchase-management',
        permanent: false,
      },
    ];
  },
  
  // Headers for better caching and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
