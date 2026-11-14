import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server only: lets the automated browser tests (127.0.0.1) load Next's dev resources.
  allowedDevOrigins: ["127.0.0.1"],
  /* config options here */
};

export default nextConfig;
