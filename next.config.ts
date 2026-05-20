import type {
  NextConfig
} from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: [
    "*",
    "192.168.1.161",
    "172.20.10.2",
    "172.20.10.3"
  ],
  crossOrigin: "anonymous",
  eslint: {
    ignoreDuringBuilds: true
  },
  env: {
    NEXT_PUBLIC_BACKEND_RECORDING: process.env.BACKEND_RECORDING,
    NEXT_PUBLIC_NOTIFICATIONS: process.env.NOTIFICATIONS,
    NEXT_PUBLIC_LIVE_THUMBNAIL: process.env.LIVE_THUMBNAIL,
    NEXT_PUBLIC_PREVIEW_ON_HOVER: process.env.PREVIEW_ON_HOVER
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/templates",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
