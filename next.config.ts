import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  async redirects() {
    return [
      {
        source: '/purchases',
        destination: '/purchase-management',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
