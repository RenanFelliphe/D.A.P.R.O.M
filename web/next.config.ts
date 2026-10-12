import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // As telas dependem da sessão do usuário (cookies) e da `api`, então toda página é dinâmica: o modo "Cache Components"
  // do protótipo estático foi desligado.
  reactCompiler: true,
  // Permite rodar várias instâncias do `next dev` ao mesmo tempo, cada uma com a própria pasta de build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Quadro e Importação viraram abas da seção Ordem de Serviço: os endereços antigos (favoritos, links salvos) seguem
  // funcionando, com os filtros da query repassados.
  // O mesmo vale para "Modelos de APR", que virou a seção APR (`?codigo=` é tratado na aba Modelos), e para os antigos
  // Dashboard e Diagnósticos, que viraram os dashboards geral, de OS e de APR de Indicadores e exportação.
  redirects: async () => [
    { source: "/web/quadro", destination: "/web/os/quadro", permanent: false },
    { source: "/web/importacao", destination: "/web/os/importacao", permanent: false },
    { source: "/web/os/diagnostico", destination: "/web/indicadores/os", permanent: false },
    { source: "/web/apr/diagnostico", destination: "/web/indicadores/apr", permanent: false },
    { source: "/web/indicadores/dashboard", destination: "/web/indicadores/geral", permanent: false },
    { source: "/web/indicadores/diagnostico-os", destination: "/web/indicadores/os", permanent: false },
    { source: "/web/indicadores/diagnostico-apr", destination: "/web/indicadores/apr", permanent: false },
    { source: "/web/modelos", has: [{ type: "query", key: "aba", value: "atividades" }], destination: "/web/apr/atividades", permanent: false },
    { source: "/web/modelos", destination: "/web/apr/modelos", permanent: false },
  ],
};

export default nextConfig;
