import type {
  NextConfig
} from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
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
