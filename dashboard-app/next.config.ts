import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async rewrites() {
    const apiProxy = process.env.PULSE_API_PROXY_URL;
    return apiProxy ? [{
      source: "/api/v1/:path*",
      destination: `${apiProxy.replace(/\/$/, "")}/api/v1/:path*`,
    }] : [];
  },
};

export default nextConfig;
