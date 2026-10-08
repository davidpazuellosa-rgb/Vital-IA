import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build em container (VPS): NEXT_OUTPUT=standalone. Na Vercel fica desligado.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  serverExternalPackages: ["@napi-rs/canvas"],
  experimental: {
    serverActions: {
      // Documentos (contrato social, PDFs escaneados) podem passar de 1 MB,
      // limite padrão dos Server Actions. Sem isso o upload estoura.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
