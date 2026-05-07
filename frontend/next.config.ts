import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  
  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },

  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
  },

  // Bundle analyzer (dev only)
  ...(process.env.ANALYZE === "true" && {
    webpack: (config: any) => {
      if (process.env.NODE_ENV === "development") {
        const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: "server",
            openAnalyzer: false,
          })
        );
      }
      return config;
    },
  }),

  // Strict mode
  reactStrictMode: true,

  // Experimental features
  experimental: {
    optimizePackageImports: ["react-icons"],
  },
};

export default nextConfig;