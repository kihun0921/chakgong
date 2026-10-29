import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/chakgong",   // ← 이 한 줄만 추가
  /* config options here */
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
