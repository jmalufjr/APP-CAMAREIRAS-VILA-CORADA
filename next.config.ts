import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Envio de fotos de notas fiscais por Server Action (já comprimidas no
  // navegador); o padrão do Next é só 1 MB. Fica abaixo do limite de 4,5 MB
  // de corpo de requisição das funções da Vercel.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
