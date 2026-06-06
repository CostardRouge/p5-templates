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
  // Keep heavy, server-only binaries out of serverless function bundles on
  // Vercel preview deployments (they'd blow the function size limit). These
  // packages are only used by the backend-recording pipeline, which is disabled
  // on Vercel previews anyway. This is a no-op for the NAS deployment, which
  // runs `next start` with the full node_modules (no output tracing).
  outputFileTracingExcludes: {
    "*": [
      "node_modules/playwright/**",
      "node_modules/playwright-core/**"
    ]
  },
  env: {
    NEXT_PUBLIC_BACKEND_RECORDING: process.env.BACKEND_RECORDING,
    NEXT_PUBLIC_NOTIFICATIONS: process.env.NOTIFICATIONS,
    NEXT_PUBLIC_LIVE_THUMBNAIL: process.env.LIVE_THUMBNAIL,
    NEXT_PUBLIC_PREVIEW_ON_HOVER: process.env.PREVIEW_ON_HOVER
  }
  // async redirects() {
  //   return [
  //     {
  //       source: "/",
  //       destination: "/templates",
  //       permanent: false
  //     }
  //   ];
  // }
};

export default nextConfig;
