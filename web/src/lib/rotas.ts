/**
 * Registro das rotas do sistema: é a única fonte de verdade para os endereços das telas. As telas que dependem de uma
 * OS recebem o id (o `id` da OS na `api`) na própria rota.
 *
 * Uma tela, um endereço: quadro, detalhe da OS, perfil, equipe e busca são os mesmos para admin, supervisor e técnico
 * (ficam em `app`); o que muda por perfil é a estrutura da página, não o link. Em `web` ficam só as telas de gestão
 * (APR, auditoria, alertas, importação).
 */

/** As telas do treinamento de serviço do admin, além da visão geral (`rotas.app.treinamentoServico`). */
export type TelaDoTreinamento = "criar" | "gerar" | "explicacao" | "fases" | "revisao" | "publicar" | "validar" | "versoes" | "problemas";

export const rotas = {
  app: {
    entrar: "/app/entrar",
    /** O pedido de conta de quem trabalha na empresa e ainda não tem uma (aberto sem login). */
    solicitarConta: "/app/entrar/solicitar",
    trocarSenha: "/app/trocar-senha",
    /** Cadastro da assinatura: a primeira coisa depois da liberação, antes de qualquer outra tela. */
    assinatura: "/app/assinatura",
    /** Técnico cadastrado por supervisor que ainda espera o admin liberar o acesso (só ele e o Campo de treino ficam abertos). */
    aguardando: "/app/aguardando",
    /** Quadro de OS (todos os perfis). */
    lista: "/app/lista",
    /** Quadro com a janela "OS preventivas" aberta (intervalo entre ciclos de cada preventiva). */
    preventivas: "/app/lista?preventivas=1",
    /**
     * Aba Mapa de Calor da seção Ordem de Serviço, a mesma para todos os perfis: onde as OS foram executadas, pelo
     * escopo de sempre (técnico, a própria equipe; supervisor, as que supervisiona; admin, todas).
     */
    mapaCalor: "/app/mapa-calor",
    /** Detalhe da OS (todos os perfis). */
    os: (id: string) => `/app/os/${id}`,
    /** Nova APR da OS: participantes, riscos e modelo. */
    apr: (id: string) => `/app/os/${id}/apr`,
    checklist: (id: string) => `/app/os/${id}/apr/checklist`,
    bloqueio: (id: string) => `/app/os/${id}/apr/bloqueio`,
    aprovada: (id: string) => `/app/os/${id}/apr/aprovada`,
    execucao: (id: string) => `/app/os/${id}/execucao`,
    /** A conferência do que a equipe registrou sem sinal, em aparelhos diferentes (`id` da OS); `conferenciaId` abre uma em especial (os avisos levam sem ele). */
    conferencia: (id: string, conferenciaId?: string) => `/app/os/${id}/conferencia${conferenciaId ? `?c=${conferenciaId}` : ""}`,
    perfil: "/app/perfil",
    /** Perfil de outra pessoa (aberto pela busca). */
    perfilDe: (id: string) => `/app/perfil/${id}`,
    /** O perfil da Vitória (fictício, com o modelo de IA de verdade): aberto pelo cabeçalho do chat. */
    perfilDaVitoria: "/app/perfil/vitoria",
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
    /**
     * Treinamento de serviço do admin. Sem `tela`, a visão geral (o caminho até publicar); as abas `explicacao`, `fases`,
     * `revisao`, `versoes` e `problemas`; e as telas de fluxo `criar` (com a Vitória ou à mão), `gerar` (rascunho pela IA), `publicar`
     * (enviar para validação ou, o admin, publicar direto) e `validar` (a decisão de quem valida).
     */
    treinamentoServico: (codigo: string, tela?: TelaDoTreinamento) => `/app/catalogo/servicos/${encodeURIComponent(codigo)}/treinamento${tela ? `/${tela}` : ""}`,
    /** Os treinamentos que esperam a validação do supervisor (as 3 equipes que mais fazem o serviço validam; 2 assinam). */
    treinamentosParaValidar: "/app/treinamentos/validar",
    /** A capa do treinamento de serviço (técnico, inclusive pendente); o jogo abre numa janela por cima. */
    treinarServico: (codigo: string) => `/app/catalogo/servicos/${encodeURIComponent(codigo)}/treinar`,
    /** Sugestões e contestações da lista de materiais (todos os perfis; o admin só avalia): `?aba=avaliar` abre a fila de quem avalia. */
    sugestoesDeMateriais: "/app/catalogo/sugestoes",
    /** Enviar uma sugestão de lista ou a contestação da lista recomendada de um serviço (o admin edita a lista direto). */
    sugerirMateriais: (codigo: string, tipo: "sugestao" | "contestacao") => `/app/catalogo/servicos/${encodeURIComponent(codigo)}/materiais/sugerir?tipo=${tipo}`,
    /** Uma sugestão ou contestação: o que muda na lista e, para quem avalia, aceitar, ajustar ou recusar. */
    sugestaoDeMateriais: (codigo: string, id: string) => `/app/catalogo/servicos/${encodeURIComponent(codigo)}/materiais/sugestoes/${id}`,
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
    /** Aba Importação da seção Ordem de Serviço (as outras abas, o quadro e o mapa de calor, ficam em `/app`). */
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
  /** Telas dos sistemas da empresa que o SYNQ OS só lê e que são simulados (só o admin): o registro de funcionários e as ordens do SAP. */
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

/** Endereço do relatório da execução (PDF à parte, para o supervisor ler antes de assinar; só supervisor e admin). */
export const urlDoRelatorio = (osId: string) => `/api/os/${osId}/relatorio-execucao`;
