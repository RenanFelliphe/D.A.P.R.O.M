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
  },
  web: {
    quadro: "/web/quadro",
    /** Detalhe da OS para a gestão. */
    os: (id: string) => `/web/os/${id}`,
    alertas: "/web/alertas",
    importacao: "/web/importacao",
    indicadores: "/web/indicadores",
    modelos: "/web/modelos",
    usuarios: "/web/usuarios",
  },
  doc: {
    /** PDF da OS executada, dentro do painel. */
    os: (id: string) => `/doc/os/${id}`,
  },
} as const;

/** Endereço do PDF gerado pela `api` (abre no navegador). */
export const urlDoPdf = (osId: string) => `/api/os/${osId}/pdf`;
