import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The summary deck is turned into a PDF by a headless browser, which must stay outside the bundle.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // The deck embeds its own fonts, read from disk when it is built.
  outputFileTracingIncludes: {
    "/api/deck/*": ["./src/lib/deck/fonts/**/*"],
    "/api/compose/send": ["./src/lib/deck/fonts/**/*"],
  },
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
