import type { NextConfig } from "next";

const isElectron = process.env.ELECTRON_BUILD === "true";

const nextConfig: NextConfig = {
  output: isElectron ? "export" : undefined,
  assetPrefix: isElectron ? "./" : undefined,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
