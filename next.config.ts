import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    devIndicators: false,
    crossOrigin: 'anonymous',
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
};

export default nextConfig;
