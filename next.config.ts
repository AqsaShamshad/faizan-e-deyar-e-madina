import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["all-the-cities"],
  outputFileTracingIncludes: {
    "/api/locations/cities": ["./node_modules/all-the-cities/cities.pbf"],
  },
  experimental: {
    agentFeedback: true,
    serverActions: { bodySizeLimit: "5mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
