import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'preview-chat-7ffbf7b5-88e2-4e15-9b73-d886b768c9a8.space-z.ai',
    '.chatglm.site',
    '.space-z.ai',
  ],
};

export default nextConfig;
