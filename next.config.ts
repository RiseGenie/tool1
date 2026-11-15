import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server only: lets the automated browser tests (127.0.0.1) load Next's dev resources.
  allowedDevOrigins: ["127.0.0.1"],
  // Static ffmpeg/ffprobe binaries are loaded at runtime by the inline worker, so keep them out of the bundle and include them in the deployment.
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/ffprobe-static/bin/linux/x64/ffprobe"],
  },
  // ffprobe-static ships every platform; the function only needs linux/x64 (keeps the deployment under the size limit).
  outputFileTracingExcludes: {
    "/api/**/*": ["./node_modules/ffprobe-static/bin/darwin/**", "./node_modules/ffprobe-static/bin/win32/**", "./node_modules/ffprobe-static/bin/linux/ia32/**", "./node_modules/ffprobe-static/bin/linux/arm64/**"],
  },
  /* config options here */
};

export default nextConfig;
