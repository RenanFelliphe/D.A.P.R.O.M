import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // As telas dependem da sessão do usuário (cookies) e da `api`, então toda página é dinâmica: o modo "Cache Components"
  // do protótipo estático foi desligado.
  reactCompiler: true,
  // Permite rodar várias instâncias do `next dev` ao mesmo tempo, cada uma com a própria pasta de build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
