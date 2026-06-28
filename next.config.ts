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

  // Node-only server dependencies that must never reach the browser. Marking
  // them external stops Turbopack (and webpack) from parsing/transforming them
  // into the module graph on every server compile — they are `require()`d
  // straight from node_modules at runtime instead. This trims the dev-compile
  // cost of the recording/API routes and the sketch-studio server route that
  // pull these in. Next already ships @aws-sdk/client-s3, sharp, prisma and
  // playwright in its default external list, so only the deps NOT covered by
  // that list are added here (see node_modules/next/dist/lib/
  // server-external-packages.json). Browser deps used for client-side recording
  // (mediabunny, gif.js) are deliberately NOT listed — they must stay bundled.
  serverExternalPackages: [
    "@aws-sdk/s3-request-presigner",
    "archiver",
    "tar",
    "bullmq",
    "ioredis",
    "web-push"
  ],

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
