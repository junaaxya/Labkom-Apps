import type { NextConfig } from "next";

type WebpackConfig = Parameters<NonNullable<NextConfig["webpack"]>>[0];

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

  // Bundle analyzer (dev only, requires `npm i -D webpack-bundle-analyzer`)
  ...(process.env.ANALYZE === "true" && {
    webpack: async (config: WebpackConfig) => {
      if (process.env.NODE_ENV === "development") {
        const mod: { BundleAnalyzerPlugin: new (opts: unknown) => unknown } =
          await import("webpack-bundle-analyzer" as string);
        config.plugins = config.plugins ?? [];
        config.plugins.push(
          new mod.BundleAnalyzerPlugin({
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