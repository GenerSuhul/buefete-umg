import type { NextConfig } from "next";
const config: NextConfig = { poweredByHeader: false, output: "standalone", reactStrictMode: true, distDir: process.env.NEXT_DIST_DIR || '.next' };
export default config;
