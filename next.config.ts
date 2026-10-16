import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build em container (VPS): NEXT_OUTPUT=standalone. Na Vercel fica desligado.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["@napi-rs/canvas"],
  // Não anuncia a tecnologia do servidor.
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/vital-norte/sistemas", destination: "/sistemas", permanent: true }];
  },
  // Cabeçalhos de segurança: a página só pode ser embutida por ela mesma (contra "clique enganoso"), o endereço de
  // origem não vaza para outros sites e câmera/microfone/localização ficam desligados.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Documentos (contrato social, PDFs escaneados) podem passar de 1 MB,
      // limite padrão dos Server Actions. Sem isso o upload estoura.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
