import type {
  NextConfig
} from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    "192.168.1.155"
  ],
  crossOrigin: "anonymous",
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/templates",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
