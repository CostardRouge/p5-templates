import type {
  NextConfig
} from "next";

const nextConfig: NextConfig = {
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
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_BACKEND_RECORDING: process.env.BACKEND_RECORDING,
    NEXT_PUBLIC_NOTIFICATIONS: process.env.NOTIFICATIONS,
    NEXT_PUBLIC_LIVE_THUMBNAIL: process.env.LIVE_THUMBNAIL,
  },
};

export default nextConfig;
