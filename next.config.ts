import type { NextConfig } from "next";

const isElectron = process.env.ELECTRON_BUILD === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: isElectron ? './' : undefined,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
