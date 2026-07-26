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
    "192.168.1.119",
    "172.20.10.2",
    "172.20.10.3"
  ],
  crossOrigin: "anonymous",
  // Next 16 removed `next lint` and with it the `eslint` config key — linting
  // was already never part of `next build` here (it ran as its own CI job).
  env: {
    NEXT_PUBLIC_BACKEND_RECORDING: process.env.BACKEND_RECORDING,
    NEXT_PUBLIC_NOTIFICATIONS: process.env.NOTIFICATIONS,
    NEXT_PUBLIC_LIVE_THUMBNAIL: process.env.LIVE_THUMBNAIL,
    NEXT_PUBLIC_PREVIEW_ON_HOVER: process.env.PREVIEW_ON_HOVER,
    NEXT_PUBLIC_INTERACTION_BINDINGS: process.env.INTERACTION_BINDINGS
  },

  // Allow the /embed route to be framed by other sites (the whole point of an
  // embed). Every other route keeps the browser default (same-origin framing
  // only). Restrict which origins may embed by setting EMBED_FRAME_ANCESTORS
  // (space-separated, e.g. "https://portfolio.example https://staging.example");
  // defaults to "*" so a fresh install works as a public widget out of the box.
  async headers() {
    const frameAncestors = process.env.EMBED_FRAME_ANCESTORS?.trim() || "*";

    return [
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${ frameAncestors }`
          }
        ]
      }
    ];
  },

  // The gallery/editor moved from /templates to /sketches. Permanent (308)
  // redirects keep every previously shared link, bookmark, and indexed URL
  // alive — including old recording jobs whose stored path still starts with
  // "templates/" (Playwright follows the redirect during backend capture).
  async redirects() {
    return [
      {
        source: "/templates",
        destination: "/sketches",
        permanent: true
      },
      {
        source: "/templates/:path*",
        destination: "/sketches/:path*",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
