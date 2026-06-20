import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Documentos (contrato social, PDFs escaneados) podem passar de 1 MB,
      // limite padrão dos Server Actions. Sem isso o upload estoura.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
