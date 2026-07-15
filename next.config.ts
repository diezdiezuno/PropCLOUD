import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Herramientas PropTools (HTML estático en public/tools)
      { source: "/tools/:slug", destination: "/tools/:slug/index.html" },
      { source: "/tools/:slug/", destination: "/tools/:slug/index.html" },
    ];
  },
  async redirects() {
    return [
      // Clientes → Contactos (rename). Next preserva el query string.
      { source: "/admin/clientes", destination: "/admin/contactos", permanent: false },
    ];
  },
};

export default nextConfig;
