import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static", "sharp"],
  outputFileTracingIncludes: {
    "/api/cron/content-auto": ["./node_modules/ffmpeg-static/ffmpeg", "./node_modules/sharp/**/*"],
  },
};

export default nextConfig;
