import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  redirects: async () => [
    { source: "/trocas-e-devolucoes", destination: "/contato", permanent: false },
  ],
  headers: async () => ["/conta/:path*", "/admin/:path*", "/auth/confirm"].map((source) => ({
    source,
    headers: [
      { key: "Cache-Control", value: "private, no-store" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ],
  })),
};

export default config;
