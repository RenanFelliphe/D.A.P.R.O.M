/**
 * Os avisos do SYNQ OS (o sino) e os e-mails que saem deles, num lugar só para a `api` e a `web` não divergirem
 * (`funcionalidades/avisos-e-emails.md`). A `api` usa esta lista no `CHECK` de `alerta.tipo` e para decidir o e-mail; a
 * `web`, para os rótulos, os filtros e as preferências do perfil.
 *
 * Todo e-mail nasce de um aviso do sino (menos o resumo diário): o aviso fica no sino e, se o tipo tem categoria de e-mail,
 * a `api` também o envia por e-mail ao destinatário, a menos que ele tenha desligado a categoria no perfil.
 */

/** Os avisos da ausência de um usuário: apontam para a ausência (e a pessoa dela), não para uma OS. */
export const AVISOS_DE_AUSENCIA = [
  "ausencia_pedida",
  "ausencia_aprovada",
  "ausencia_recusada",
  "ausencia_registrada",
  "ausencia_fim_pedido",
  "ausencia_fim_respondido",
  "ausencia_alterada",
  "ausencia_vencida",
  "ausencia_cancelada",
] as const;

/** Os avisos da sugestão e da contestação da lista de materiais de um serviço: apontam para a sugestão. */
export const AVISOS_DE_SUGESTAO_DE_MATERIAIS = [
  "sugestao_materiais_nova",
  "contestacao_materiais_nova",
  "sugestao_materiais_aceita",
  "sugestao_materiais_recusada",
] as const;

/** Os avisos de que o representante assumiu a equipe ou de que o supervisor voltou: apontam para a equipe. */
export const AVISOS_DE_REPRESENTACAO = ["representacao_iniciada", "representacao_encerrada"] as const;

export const TIPOS_DE_AVISO = [
  "bloqueio",
  "conflito_planejamento",
  "execucao_duplicada",
  "apoio_encerrado",
  "falha_importacao",
  "preventiva_proxima",
  "preventiva_vencida",
  "inspecao_com_pendencia",
  // Execução compartilhada: o pedido de um participante ao responsável, a resposta, e o aviso do que um participante fez
  "pedido_de_acao",
  "pedido_decidido",
  "acao_de_participante",
  // Execução compartilhada, etapa 3: a conferência do que a equipe registrou sem sinal em aparelhos diferentes
  "conferencia_aberta",
  "conferencia_cobranca",
  "conferencia_para_decidir",
  "conferencia_para_assinar",
  "conferencia_ressalva",
  "conferencia_tempo_esgotado",
  // Execução e assinaturas (Reunião 3)
  "apr_para_assinar",
  "direito_de_recusa",
  "lesao_ou_enfermidade",
  "os_para_assinar",
  ...AVISOS_DE_AUSENCIA,
  ...AVISOS_DE_REPRESENTACAO,
  // OS de uma pessoa
  "os_reservada",
  "os_reserva_desfeita",
  "os_ciencia",
  "pdf_os_falhou",
  // Conta e acesso
  "conta_criada",
  "acesso_liberado",
  "acesso_recusado",
  "senha_redefinida",
  "cadastro_pendente",
  "cadastro_liberado",
  "cadastro_recusado",
  "membro_desativado",
  "funcionario_readmitido",
  "conta_solicitada",
  // Equipe e sistema
  "equipe_sem_supervisor",
  "rh_leitura_falhou",
  "vitoria_sem_ia",
  "treinamento_publicado",
  "treinamento_problema",
  // Lista de materiais do serviço
  ...AVISOS_DE_SUGESTAO_DE_MATERIAIS,
  "materiais_atualizados",
] as const;
export type TipoDeAviso = (typeof TIPOS_DE_AVISO)[number];

/**
 * A que o aviso aponta (o `CHECK` `alerta_alvo` exige exatamente as colunas do alvo e mais nenhuma):
 * - `os`: `os_id` (e, no ciclo das preventivas, também o plano);
 * - `importacao`: `importacao_id` (a importação que falhou);
 * - `ausencia`: `ausencia_id` e `usuario_alvo_id` (a pessoa da ausência);
 * - `equipe`: `equipe_id`;
 * - `usuario`: `usuario_alvo_id` (a conta de quem se fala);
 * - `leitura_rh`: `leitura_rh_id` (a leitura do registro de funcionários que falhou);
 * - `treinamento`: `treinamento_id` (o treinamento de serviço);
 * - `sugestao`: `sugestao_materiais_id` (a sugestão ou contestação da lista de materiais de um serviço);
 * - `servico`: `atividade_codigo` (o serviço cuja lista de materiais mudou);
 * - `solicitacao_conta`: `solicitacao_conta_id` (o pedido de conta feito na tela de entrada);
 * - `nenhum`: o aviso é do sistema todo (a Vitória sem IA).
 */
export const ALVOS_DE_AVISO = ["os", "importacao", "ausencia", "equipe", "usuario", "leitura_rh", "treinamento", "sugestao", "servico", "solicitacao_conta", "nenhum"] as const;
export type AlvoDeAviso = (typeof ALVOS_DE_AVISO)[number];

const alvoDe = (tipo: TipoDeAviso): AlvoDeAviso => {
  if ((AVISOS_DE_AUSENCIA as readonly string[]).includes(tipo)) return "ausencia";
  if ((AVISOS_DE_REPRESENTACAO as readonly string[]).includes(tipo)) return "equipe";
  if ((AVISOS_DE_SUGESTAO_DE_MATERIAIS as readonly string[]).includes(tipo)) return "sugestao";
  switch (tipo) {
    case "falha_importacao":
      return "importacao";
    case "equipe_sem_supervisor":
      return "equipe";
    case "conta_criada":
    case "acesso_liberado":
    case "acesso_recusado":
    case "senha_redefinida":
    case "cadastro_pendente":
    case "cadastro_liberado":
    case "cadastro_recusado":
    case "membro_desativado":
    case "funcionario_readmitido":
      return "usuario";
    case "rh_leitura_falhou":
      return "leitura_rh";
    case "treinamento_publicado":
    case "treinamento_problema":
      return "treinamento";
    case "materiais_atualizados":
      return "servico";
    case "conta_solicitada":
      return "solicitacao_conta";
    case "vitoria_sem_ia":
      return "nenhum";
    default:
      return "os";
  }
};

export const ALVO_DO_AVISO = Object.fromEntries(TIPOS_DE_AVISO.map((t) => [t, alvoDe(t)])) as Record<TipoDeAviso, AlvoDeAviso>;

export const ROTULO_DO_AVISO: Record<TipoDeAviso, string> = {
  bloqueio: "Impedimento",
  conflito_planejamento: "Conflito de planejamento",
  execucao_duplicada: "Execução duplicada",
  apoio_encerrado: "Apoio encerrado",
  falha_importacao: "Falha na importação",
  preventiva_proxima: "Preventiva: ciclo próximo",
  preventiva_vencida: "Preventiva: ciclo vencido",
  inspecao_com_pendencia: "Inspeção com pendência",
  pedido_de_acao: "Pedido de um participante da execução",
  pedido_decidido: "Resposta ao seu pedido na execução",
  acao_de_participante: "Um participante agiu na execução",
  conferencia_aberta: "Conferência da execução aberta",
  conferencia_cobranca: "Conferência da execução esperando você",
  conferencia_para_decidir: "Conferência da execução: escolha as versões",
  conferencia_para_assinar: "Conferência da execução: ciência ou assinatura",
  conferencia_ressalva: "Ressalva na conferência da execução",
  conferencia_tempo_esgotado: "Conferência da execução fechada por prazo",
  apr_para_assinar: "APR aguardando a sua assinatura",
  direito_de_recusa: "Direito de recusa na APR",
  lesao_ou_enfermidade: "Lesão ou enfermidade na execução",
  os_para_assinar: "OS aguardando a sua assinatura",
  ausencia_pedida: "Ausência: pedido a responder",
  ausencia_aprovada: "Ausência aprovada",
  ausencia_recusada: "Ausência recusada",
  ausencia_registrada: "Ausência registrada",
  ausencia_fim_pedido: "Ausência: fim antecipado pedido",
  ausencia_fim_respondido: "Ausência: fim antecipado respondido",
  ausencia_alterada: "Ausência alterada",
  ausencia_vencida: "Ausência vencida",
  ausencia_cancelada: "Pedido de ausência cancelado",
  representacao_iniciada: "Representante assumiu a equipe",
  representacao_encerrada: "Supervisão devolvida ao supervisor",
  os_reservada: "OS reservada para você",
  os_reserva_desfeita: "OS não está mais reservada para você",
  os_ciencia: "Assinatura final do supervisor",
  pdf_os_falhou: "PDF da OS não gerado",
  conta_criada: "Conta criada",
  acesso_liberado: "Acesso liberado",
  acesso_recusado: "Acesso recusado",
  senha_redefinida: "Senha redefinida",
  cadastro_pendente: "Cadastro aguardando liberação",
  cadastro_liberado: "Cadastro liberado",
  cadastro_recusado: "Cadastro recusado",
  membro_desativado: "Membro da equipe desativado",
  funcionario_readmitido: "Funcionário readmitido",
  conta_solicitada: "Pedido de conta",
  equipe_sem_supervisor: "Equipe sem supervisor",
  rh_leitura_falhou: "Falha na leitura do registro de funcionários",
  vitoria_sem_ia: "Vitória sem IA",
  treinamento_publicado: "Novo treinamento",
  treinamento_problema: "Problema em treinamento",
  sugestao_materiais_nova: "Sugestão de materiais para avaliar",
  contestacao_materiais_nova: "Contestação de materiais para avaliar",
  sugestao_materiais_aceita: "Sua sugestão de materiais foi aceita",
  sugestao_materiais_recusada: "Sua sugestão de materiais foi recusada",
  materiais_atualizados: "Materiais do serviço atualizados",
};

// ---- E-mail ------------------------------------------------------------------------------------------------------

/**
 * As categorias de e-mail que cada pessoa liga ou desliga no perfil (`usuario.emails_desligados`). As obrigatórias não
 * desligam: a segurança do campo e o acesso à própria conta.
 */
export const CATEGORIAS_DE_EMAIL = ["seguranca", "conta", "os", "preventivas", "ausencias", "equipe", "treinamentos", "sistema", "resumo_diario"] as const;
export type CategoriaDeEmail = (typeof CATEGORIAS_DE_EMAIL)[number];

export const CATEGORIAS_OBRIGATORIAS: readonly CategoriaDeEmail[] = ["seguranca", "conta"];

export const ehCategoriaObrigatoria = (c: CategoriaDeEmail) => CATEGORIAS_OBRIGATORIAS.includes(c);

/**
 * A categoria do e-mail de cada aviso; `null` é o aviso que fica só no sino. A falha de importação só vai por e-mail quando é
 * a leitura do SAP (a planilha e o PDF mostram o erro na hora para quem enviou) e uma vez por falha seguida, não a cada
 * tentativa (`dominio/alertas.ts`).
 */
export const CATEGORIA_DO_AVISO: Record<TipoDeAviso, CategoriaDeEmail | null> = {
  bloqueio: "seguranca",
  conflito_planejamento: "os",
  execucao_duplicada: "os",
  apoio_encerrado: "os",
  falha_importacao: "sistema",
  preventiva_proxima: "preventivas",
  preventiva_vencida: "preventivas",
  inspecao_com_pendencia: "os",
  // Só no sino: o pedido vale por 2 minutos, e o e-mail não chegaria a tempo; os avisos da ação ficam no sino para não fazer barulho.
  pedido_de_acao: null,
  pedido_decidido: null,
  acao_de_participante: null,
  // A conferência dura horas ou dias (a equipe sincroniza quando tem sinal): o e-mail chega a tempo e ajuda. Categoria Equipe.
  conferencia_aberta: "equipe",
  conferencia_cobranca: "equipe",
  conferencia_para_decidir: "equipe",
  conferencia_para_assinar: "equipe",
  conferencia_ressalva: "equipe",
  conferencia_tempo_esgotado: "equipe",
  // Só no sino: quem assina está ao lado de quem preencheu a APR.
  apr_para_assinar: null,
  // A lesão no trabalho, mesmo leve, é acidente de trabalho: o aviso por e-mail é obrigatório, como o do impedimento.
  direito_de_recusa: "seguranca",
  lesao_ou_enfermidade: "seguranca",
  os_para_assinar: "os",
  ausencia_pedida: "ausencias",
  ausencia_aprovada: "ausencias",
  ausencia_recusada: "ausencias",
  ausencia_registrada: "ausencias",
  ausencia_fim_pedido: "ausencias",
  ausencia_fim_respondido: "ausencias",
  ausencia_alterada: "ausencias",
  ausencia_vencida: "ausencias",
  ausencia_cancelada: "ausencias",
  representacao_iniciada: "equipe",
  representacao_encerrada: "equipe",
  os_reservada: "os",
  os_reserva_desfeita: "os",
  os_ciencia: "os",
  pdf_os_falhou: "sistema",
  conta_criada: "conta",
  acesso_liberado: "conta",
  acesso_recusado: "conta",
  senha_redefinida: "conta",
  cadastro_pendente: "sistema",
  cadastro_liberado: "equipe",
  cadastro_recusado: "equipe",
  membro_desativado: "equipe",
  funcionario_readmitido: "sistema",
  // O pedido de conta vai ao admin e a quem responde pela equipe escolhida (o supervisor não vê a categoria Sistema).
  conta_solicitada: "equipe",
  equipe_sem_supervisor: "sistema",
  rh_leitura_falhou: "sistema",
  vitoria_sem_ia: "sistema",
  treinamento_publicado: "treinamentos",
  treinamento_problema: "treinamentos",
  // A sugestão a avaliar e a resposta ao autor vão por e-mail (categoria Equipe); a lista que mudou fica só no sino: avisa muita gente.
  sugestao_materiais_nova: "equipe",
  contestacao_materiais_nova: "equipe",
  sugestao_materiais_aceita: "equipe",
  sugestao_materiais_recusada: "equipe",
  materiais_atualizados: null,
};

export const ROTULO_DA_CATEGORIA: Record<CategoriaDeEmail, string> = {
  seguranca: "Segurança",
  conta: "Sua conta",
  os: "Ordens de serviço",
  preventivas: "Preventivas",
  ausencias: "Ausências",
  equipe: "Equipe",
  treinamentos: "Treinamentos",
  sistema: "Sistema",
  resumo_diario: "Resumo diário",
};

export const DESCRICAO_DA_CATEGORIA: Record<CategoriaDeEmail, string> = {
  seguranca: "APR bloqueada, execução interrompida por risco, direito de recusa e lesão ou enfermidade na execução, nas equipes que você supervisiona.",
  conta: "Conta criada, acesso liberado ou recusado e senha redefinida.",
  os: "OS reservada para você ou tirada de você, assinatura final do supervisor na OS que você executou, OS aguardando a sua assinatura de supervisor, OS de apoio encerrada, inspeção com pendência, conflitos e execuções duplicadas.",
  preventivas: "Ciclo das preventivas próximo do vencimento ou vencido.",
  ausencias: "Pedidos, aprovações, recusas, alterações e retorno das ausências.",
  equipe: "Representante que assume ou devolve a equipe, membro desativado, técnico que você cadastrou liberado ou recusado, pedido de conta de quem ainda não tem uma, e sugestões e contestações de materiais (a avaliar, aceitas ou recusadas), e a conferência da execução registrada sem sinal (aberta, a escolher, a assinar, com ressalva ou fechada por prazo).",
  treinamentos: "Novo treinamento de serviço publicado e problema reportado num treinamento.",
  sistema: "Falha na leitura do SAP ou do registro de funcionários, cadastro aguardando liberação, funcionário readmitido, equipe sem supervisor, PDF de OS não gerado e a Vitória sem IA.",
  resumo_diario: "Um e-mail por dia, de manhã, com o que espera por você: OS aguardando ciência, pedidos de ausência, cadastros a liberar e OS reservadas.",
};

/** As categorias que fazem sentido para cada perfil na tela de preferências (o técnico não recebe os avisos do sistema). */
export function categoriasDoPerfil(perfil: "tecnico" | "admin"): CategoriaDeEmail[] {
  return CATEGORIAS_DE_EMAIL.filter((c) => perfil === "admin" || c !== "sistema");
}

/** Se o aviso vai por e-mail para quem desligou estas categorias (as obrigatórias sempre vão). */
export function emailLigado(tipo: TipoDeAviso, desligadas: readonly string[]): boolean {
  const categoria = CATEGORIA_DO_AVISO[tipo];
  if (!categoria) return false;
  return ehCategoriaObrigatoria(categoria) || !desligadas.includes(categoria);
}

// ---- Para onde o aviso leva -------------------------------------------------------------------------------------

/** O que é preciso saber do aviso para montar o link; os mesmos endereços de `web/src/lib/rotas.ts`. */
export interface ReferenciasDoAviso {
  id: string;
  tipo: TipoDeAviso;
  destinatarioId: string;
  osId: string | null;
  /** A equipe da ausência (é nela que o supervisor responde). */
  ausenciaEquipeId: string | null;
  usuarioAlvoId: string | null;
  /** A equipe dos avisos que apontam para ela (`representacao_*`, `equipe_sem_supervisor`). */
  equipeAlvoId: string | null;
  /** O código do serviço do treinamento (`treinamento_*`). */
  treinamentoCodigo: string | null;
  /** A sugestão de materiais (`sugestao_materiais_*`, `contestacao_materiais_nova`) e o código do serviço dela; no `materiais_atualizados`, só o código. */
  sugestaoId: string | null;
  servicoCodigo: string | null;
}

/** O endereço da tela de alertas da gestão, já com o aviso aberto. */
export const caminhoNaTelaDeAlertas = (id: string) => `/web/alertas?alerta=${id}`;

/**
 * Para onde o aviso leva quem o recebe, fora da tela de alertas: a OS, a ausência (o perfil de quem está ausente, a equipe de
 * quem responde), a equipe, o treinamento. Os avisos que só o admin recebe e que têm uma ação no detalhe (reativar a conta,
 * escolher o supervisor, ler o registro de novo) levam à tela de alertas, com o aviso aberto. Usado no sino do técnico e nos
 * e-mails (com o endereço do painel na frente).
 */
export function caminhoDoAviso(a: ReferenciasDoAviso): string {
  const alvo = ALVO_DO_AVISO[a.tipo];
  switch (a.tipo) {
    case "conta_criada":
    case "senha_redefinida":
    case "acesso_recusado":
      return "/app/entrar";
    case "acesso_liberado":
      return "/app/lista";
    case "cadastro_liberado":
    case "cadastro_recusado":
    case "membro_desativado":
      return "/app/usuarios";
    case "conta_solicitada":
      return "/app/usuarios#solicitacoes";
    case "apr_para_assinar":
      return a.osId ? `/app/os/${a.osId}/apr/aprovada` : "/app/lista";
    // A conferência da execução: a tela dela é da OS (a execução compartilhada, etapa 3).
    case "conferencia_aberta":
    case "conferencia_cobranca":
    case "conferencia_para_decidir":
    case "conferencia_para_assinar":
    case "conferencia_ressalva":
    case "conferencia_tempo_esgotado":
      return a.osId ? `/app/os/${a.osId}/conferencia` : "/app/lista";
    case "treinamento_publicado":
      return a.treinamentoCodigo ? `/app/catalogo/servicos/${encodeURIComponent(a.treinamentoCodigo)}/treinar` : "/app/catalogo/servicos";
    case "treinamento_problema":
      return a.treinamentoCodigo ? `/app/catalogo/servicos/${encodeURIComponent(a.treinamentoCodigo)}/treinamento/problemas` : "/app/catalogo/servicos";
    case "sugestao_materiais_nova":
    case "contestacao_materiais_nova":
    case "sugestao_materiais_aceita":
    case "sugestao_materiais_recusada":
      return a.servicoCodigo && a.sugestaoId
        ? `/app/catalogo/servicos/${encodeURIComponent(a.servicoCodigo)}/materiais/sugestoes/${a.sugestaoId}`
        : "/app/catalogo/sugestoes";
    case "materiais_atualizados":
      return a.servicoCodigo ? `/app/catalogo?busca=${encodeURIComponent(a.servicoCodigo)}` : "/app/catalogo";
    case "falha_importacao":
      return "/web/os/importacao";
    case "pdf_os_falhou":
    case "cadastro_pendente":
    case "funcionario_readmitido":
    case "equipe_sem_supervisor":
    case "rh_leitura_falhou":
    case "vitoria_sem_ia":
      return caminhoNaTelaDeAlertas(a.id);
    default:
      break;
  }
  if (alvo === "ausencia") {
    // Quem está ausente cuida dela no próprio perfil; quem responde, na equipe.
    if (a.usuarioAlvoId === a.destinatarioId || !a.ausenciaEquipeId) return "/app/perfil#ausencias";
    return `/app/equipes/${a.ausenciaEquipeId}#ausencias`;
  }
  if (alvo === "equipe") return a.equipeAlvoId ? `/app/equipes/${a.equipeAlvoId}#representante` : "/app/usuarios";
  if (alvo === "os" && a.osId) return `/app/os/${a.osId}`;
  return "/app/lista";
}
