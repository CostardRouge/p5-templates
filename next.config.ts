import type {
  NextConfig
} from "next";
import path from "path";

// `@tensorflow-models/body-segmentation` (pulled in by ARPortraitDepth in the
// video-point-cloud depth mode) statically imports `@mediapipe/selfie_segmentation`,
// a non-ESM UMD bundle that breaks the build. We only use the tfjs runtime, so
// we alias that module to a harmless stub (both Turbopack and webpack paths).
const selfieSegmentationShimRelative =
  "./src/templates/p5/utils/depth/selfieSegmentationShim.js";
const selfieSegmentationShim = path.resolve(
  process.cwd(),
  "src/templates/p5/utils/depth/selfieSegmentationShim.js"
);

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@mediapipe/selfie_segmentation": selfieSegmentationShimRelative
    }
  },
  webpack: ( config ) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...( config.resolve.alias || {} ),
      "@mediapipe/selfie_segmentation": selfieSegmentationShim
    };

    return config;
  },
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
