import path from "node:path";
import type { NextConfig } from "next";

// A raiz é a pasta do repositório, não `web/`: o manifesto da Vitória (`shared/vitoria`) fica fora de `web/` e é lido
// também pela `api`. Sem isso o Turbopack não resolve arquivos acima de `web/` (que tem o próprio pnpm-workspace).
const raizDoRepositorio = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: { root: raizDoRepositorio },
  outputFileTracingRoot: raizDoRepositorio,
  // As telas dependem da sessão do usuário (cookies) e da `api`, então toda página é dinâmica: o modo "Cache Components"
  // do protótipo estático foi desligado.
  reactCompiler: true,
  // Permite rodar várias instâncias do `next dev` ao mesmo tempo, cada uma com a própria pasta de build.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // O `proxy` guarda o corpo da requisição em memória e corta em 10 MB sem avisar quem enviou. A patente nova leva duas
  // imagens de até 5 MB cada (a das pessoas e a das equipes) no mesmo envio, então o limite sobe um pouco acima disso.
  experimental: { proxyClientMaxBodySize: "12mb" },
  // Quadro, detalhe da OS, perfil, equipe e busca são telas únicas para todos os perfis (em `/app`): os endereços antigos de
  // `/web` seguem funcionando, com a query repassada. O Dashboard e Equipes e usuários (Minha equipe) também são telas únicas, em `/app/dashboard` e `/app/usuarios`.
  // Quadro e Importação viraram abas da seção Ordem de Serviço: os endereços antigos (favoritos, links salvos) seguem
  // funcionando, com os filtros da query repassados.
  // O mesmo vale para "Modelos de APR", que virou a seção APR (`?codigo=` é tratado na aba Modelos), e para os antigos
  // Dashboard e Diagnósticos, que viraram os dashboards geral, de OS e de APR de Indicadores e exportação.
  redirects: async () => [
    // Link da OS nos e-mails de alerta e nas planilhas de baixa gerados antes da correção do endereço.
    { source: "/os/:id([0-9a-fA-F-]{36})", destination: "/app/os/:id", permanent: false },
    { source: "/web/quadro", destination: "/app/lista", permanent: false },
    { source: "/web/os/quadro", destination: "/app/lista", permanent: false },
    // O Mapa de Calor foi uma aba da seção OS (primeiro só de gestão em `/web/os`, depois de todos em `/app`); agora é o destaque do dashboard de OS.
    { source: "/web/os/mapa-calor", destination: "/app/dashboard/os", permanent: false },
    { source: "/app/mapa-calor", destination: "/app/dashboard/os", permanent: false },
    { source: "/web/os/:id([0-9a-fA-F-]{36})", destination: "/app/os/:id", permanent: false },
    { source: "/web/perfil", destination: "/app/perfil", permanent: false },
    { source: "/web/perfil/:id", destination: "/app/perfil/:id", permanent: false },
    { source: "/web/equipes/:id", destination: "/app/equipes/:id", permanent: false },
    { source: "/web/busca", destination: "/app/busca", permanent: false },
    { source: "/web/minha-equipe", destination: "/app/usuarios", permanent: false },
    { source: "/web/usuarios", destination: "/app/usuarios", permanent: false },
    // A aba Geral deixou de existir: o Dashboard abre na primeira aba de cada pessoa (Meus resultados, ou OS para o admin).
    { source: "/web/indicadores", destination: "/app/dashboard", permanent: false },
    { source: "/web/indicadores/geral", destination: "/app/dashboard", permanent: false },
    { source: "/app/dashboard/geral", destination: "/app/dashboard", permanent: false },
    { source: "/web/indicadores/:aba(equipes|os|apr)", destination: "/app/dashboard/:aba", permanent: false },
    { source: "/web/importacao", destination: "/web/os/importacao", permanent: false },
    { source: "/web/os/diagnostico", destination: "/app/dashboard/os", permanent: false },
    { source: "/web/apr/diagnostico", destination: "/app/dashboard/apr", permanent: false },
    { source: "/web/indicadores/dashboard", destination: "/app/dashboard", permanent: false },
    { source: "/web/indicadores/diagnostico-os", destination: "/app/dashboard/os", permanent: false },
    { source: "/web/indicadores/diagnostico-apr", destination: "/app/dashboard/apr", permanent: false },
    { source: "/web/modelos", has: [{ type: "query", key: "aba", value: "atividades" }], destination: "/web/apr/atividades", permanent: false },
    { source: "/web/modelos", destination: "/web/apr/modelos", permanent: false },
  ],
};

export default nextConfig;
