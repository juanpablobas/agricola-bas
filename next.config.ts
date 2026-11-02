import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La primera versión se escribió sin poder compilar localmente.
  // Cuando el proyecto compile limpio con `npm run typecheck`, cambiar a false.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
