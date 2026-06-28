import type {
  NextConfig
} from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the runtime
  // image only ships the modules actually traced by the build instead of the
  // whole node_modules tree. Started with `node server.js`.
  output: "standalone",
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
  }
};

export default nextConfig;
