import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["pdfjs-dist"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async redirects() {
    return [
      { source: "/proposals", destination: "/procurement/opportunities", permanent: false },
      { source: "/procurement/requirements", destination: "/procurement/opportunities", permanent: false },
      { source: "/intelligence", destination: "/intelligence/market", permanent: false },
    ];
  },
} as NextConfig;

export default withWorkflow(nextConfig);
