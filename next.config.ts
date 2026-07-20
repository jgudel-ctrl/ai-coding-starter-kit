import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    // PROJ-29: Hersteller-PDFs (mehrere MB) werden per Server Action hochgeladen —
    // das Standard-Limit von 1 MB reicht nicht.
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
