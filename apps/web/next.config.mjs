import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@office-reminder/shared"],
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
};

export default nextConfig;
