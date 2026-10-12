/**
 * Registro das rotas do sistema: é a única fonte de verdade para os endereços das telas. As telas que dependem de uma
 * OS recebem o id (o `id` da OS na `api`) na própria rota.
 */
export const rotas = {
  app: {
    entrar: "/app/entrar",
    trocarSenha: "/app/trocar-senha",
    lista: "/app/lista",
    /** Detalhe da OS para o técnico. */
    os: (id: string) => `/app/os/${id}`,
    /** Nova APR da OS: participantes, riscos e modelo. */
    apr: (id: string) => `/app/os/${id}/apr`,
    checklist: (id: string) => `/app/os/${id}/apr/checklist`,
    bloqueio: (id: string) => `/app/os/${id}/apr/bloqueio`,
    aprovada: (id: string) => `/app/os/${id}/apr/aprovada`,
    execucao: (id: string) => `/app/os/${id}/execucao`,
    perfil: "/app/perfil",
    /** Perfil de outra pessoa (aberto pela busca). */
    perfilDe: (id: string) => `/app/perfil/${id}`,
    /** Perfil da equipe. */
    equipe: (id: string) => `/app/equipes/${id}`,
    /** Resultados da busca global (`?q=`). */
    busca: "/app/busca",
  },
  web: {
    /** Seção Ordem de Serviço (menu "Ordem de Serviço"): duas abas. `/web/os` sozinho leva ao quadro. */
    quadro: "/web/os/quadro",
    importacao: "/web/os/importacao",
    /** Detalhe da OS para a gestão. */
    os: (id: string) => `/web/os/${id}`,
    alertas: "/web/alertas",
    /**
     * Seção Indicadores e exportação: quatro dashboards com o mesmo filtro (`?periodo=` e `?equipe_id=`) — geral, equipes e
     * usuários, OS (com a entrada de OS e a baixa no SAP) e APR. `/web/indicadores` sozinho leva ao geral.
     */
    indicadores: "/web/indicadores/geral",
    indicadoresEquipes: "/web/indicadores/equipes",
    indicadoresOs: "/web/indicadores/os",
    indicadoresApr: "/web/indicadores/apr",
    /** Seção APR, Análise Preliminar de Risco (menu "APR"): duas abas. `/web/apr` sozinho leva aos modelos. */
    modelos: "/web/apr/modelos",
    atividades: "/web/apr/atividades",
    /** Um modelo de APR: versões, editor do rascunho e onde é usado. Sem `versao`, abre o rascunho ou a versão em uso. */
    modelo: (codigo: string, versao?: number) => `/web/apr/modelos/${encodeURIComponent(codigo)}${versao ? `?versao=${versao}` : ""}`,
    novoModelo: "/web/apr/modelos/novo",
    usuarios: "/web/usuarios",
    perfil: "/web/perfil",
    /** Perfil de outra pessoa (aberto pela busca). */
    perfilDe: (id: string) => `/web/perfil/${id}`,
    /** Perfil da equipe. */
    equipe: (id: string) => `/web/equipes/${id}`,
    configuracoes: "/web/configuracoes",
    /** Resultados da busca global (`?q=`). */
    busca: "/web/busca",
  },
  doc: {
    /** PDF da OS executada, dentro do painel. */
    os: (id: string) => `/doc/os/${id}`,
  },
} as const;

/** Endereço do PDF gerado pela `api` (abre no navegador). */
export const urlDoPdf = (osId: string) => `/api/os/${osId}/pdf`;
