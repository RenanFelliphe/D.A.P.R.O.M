/**
 * Registro das rotas do sistema: é a única fonte de verdade para os endereços das telas. As telas que dependem de uma
 * OS recebem o id (o `id` da OS na `api`) na própria rota.
 *
 * Uma tela, um endereço: quadro, detalhe da OS, perfil, equipe e busca são os mesmos para admin, supervisor e técnico
 * (ficam em `app`); o que muda por perfil é a estrutura da página, não o link. Em `web` ficam só as telas de gestão
 * (APR, auditoria, alertas, importação).
 */
export const rotas = {
  app: {
    entrar: "/app/entrar",
    trocarSenha: "/app/trocar-senha",
    /** Técnico cadastrado por supervisor que ainda espera o admin liberar o acesso (só ele e o Campo de treino ficam abertos). */
    aguardando: "/app/aguardando",
    /** Quadro de OS (todos os perfis). */
    lista: "/app/lista",
    /** Quadro com a janela "OS preventivas" aberta (intervalo entre ciclos de cada preventiva). */
    preventivas: "/app/lista?preventivas=1",
    /** Detalhe da OS (todos os perfis). */
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
    /**
     * Seção Dashboard, a mesma para todos os perfis: geral, equipes, OS (com a entrada de OS e a baixa no SAP, só do admin) e
     * APR, com o mesmo filtro (`?periodo=` e `?equipe_id=`), mais "Meus resultados" (técnico e supervisor). `/app/dashboard`
     * sozinho leva ao geral.
     */
    dashboard: "/app/dashboard/geral",
    dashboardEquipes: "/app/dashboard/equipes",
    dashboardOs: "/app/dashboard/os",
    /** Bloco "Exportação para baixa no SAP" do dashboard de OS (só o admin o vê). */
    exportacaoSap: "/app/dashboard/os#exportacao",
    dashboardApr: "/app/dashboard/apr",
    dashboardMeus: "/app/dashboard/meus",
    /** Equipes e usuários (admin), Minha equipe com cadastro (supervisor) ou Minha equipe só para consulta (técnico): um endereço só. */
    usuarios: "/app/usuarios",
    /**
     * Catálogo de serviço, o mesmo para todos os perfis (só o admin edita): os serviços com os materiais de cada um
     * (`?busca=`, `?sem_materiais=true`, `?material_id=`) e o cadastro de materiais. `/app/catalogo` sozinho leva aos serviços.
     */
    catalogo: "/app/catalogo/servicos",
    catalogoMateriais: "/app/catalogo/materiais",
    /** Editor do treinamento de serviço (admin): explicação, fases, pré-visualizar, publicar, versões e reportes. */
    treinamentoServico: (codigo: string) => `/app/catalogo/servicos/${encodeURIComponent(codigo)}/treinamento`,
    /** Jogar o treinamento de serviço (técnico, inclusive pendente). */
    treinarServico: (codigo: string) => `/app/catalogo/servicos/${encodeURIComponent(codigo)}/treinar`,
    /**
     * Seção Gamificação, a mesma para todos os perfis (só o admin edita pontos, patentes e conquistas): Minha pontuação (técnico),
     * Ranking, Conquistas, Patentes e Como pontuar. `/app/gamificacao` sozinho abre a pontuação do técnico; o admin, que não
     * joga, vai para o ranking.
     */
    gamificacao: "/app/gamificacao",
    gamificacaoMinha: "/app/gamificacao/minha",
    /** `?tipo=pessoas|equipes` e `?temporada=<codigo>|geral`. */
    gamificacaoRanking: "/app/gamificacao/ranking",
    gamificacaoConquistas: "/app/gamificacao/conquistas",
    gamificacaoPatentes: "/app/gamificacao/patentes",
    gamificacaoPontos: "/app/gamificacao/pontos",
    /** Campo de treino: entrada com a escolha Direcionado/Livre. */
    treino: "/app/treino",
    /** Liga o modo treino (cookie) e leva à lista; `?modo=direcionado|livre` guarda a escolha. */
    treinoEntrar: (modo?: "direcionado" | "livre") => (modo ? `/app/treino/entrar?modo=${modo}` : "/app/treino/entrar"),
    /** Desliga o modo treino e volta ao sistema real. */
    treinoSair: "/app/treino/sair",
    /** Perguntas que a Vitória não soube responder (admin), para melhorar o manual. */
    vitoriaSemResposta: "/app/vitoria/sem-resposta",
  },
  web: {
    /** Aba Importação da seção Ordem de Serviço (a outra aba é o quadro, `app.lista`). */
    importacao: "/web/os/importacao",
    alertas: "/web/alertas",
    /** Seção APR, Análise Preliminar de Risco (menu "APR"): duas abas. `/web/apr` sozinho leva aos modelos. */
    modelos: "/web/apr/modelos",
    atividades: "/web/apr/atividades",
    /** Um modelo de APR: versões, editor do rascunho e onde é usado. Sem `versao`, abre o rascunho ou a versão em uso. */
    modelo: (codigo: string, versao?: number) => `/web/apr/modelos/${encodeURIComponent(codigo)}${versao ? `?versao=${versao}` : ""}`,
    novoModelo: "/web/apr/modelos/novo",
    /** Trilha de auditoria das ações de gestão (só o admin). */
    auditoria: "/web/auditoria",
  },
  /** Telas dos sistemas da empresa que o DAPROM só lê e que são simulados (só o admin): o registro de funcionários e as ordens do SAP. */
  simulador: {
    funcionarios: "/simulador/funcionarios",
    ordens: "/simulador/ordens",
  },
  doc: {
    /** PDF da OS executada, dentro do painel. */
    os: (id: string) => `/doc/os/${id}`,
  },
} as const;

/** Endereço do PDF gerado pela `api` (abre no navegador). */
export const urlDoPdf = (osId: string) => `/api/os/${osId}/pdf`;
