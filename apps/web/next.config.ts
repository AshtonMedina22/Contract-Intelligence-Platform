import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
} as NextConfig;

export default withWorkflow(nextConfig);
