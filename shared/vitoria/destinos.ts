/**
 * Manifesto de destinos navegáveis da Vitória (`funcionalidades/vitoria.md`, seção 2.4): o único vocabulário que uma
 * ação "navegar" ou "destacar" pode citar. Nem a `api` nem a IA escrevem uma URL: elas só citam uma chave daqui, e é
 * este arquivo (lido pelos dois lados, por caminho relativo, sem symlink nem pacote interno) quem sabe montar o
 * caminho de verdade.
 *
 * Três formas, como o plano pede:
 * - `fixo`: um caminho que não muda.
 * - `com_contexto`: o valor vem só do contexto que o cliente manda (a tela em que a pessoa está), nunca da IA — ex.:
 *   o `os_id` da OS aberta. Sem o campo, a ação é descartada (não é um erro: a resposta em texto continua valendo).
 * - `com_filtro`: o valor pode vir da interpretação da IA (nível 3, "o que eu executei em maio"), mas só entra na URL
 *   depois de validado contra um padrão fechado (regex) — nunca livre.
 *
 * `api/scripts/verificar-manifesto-vitoria.mts` confere que cada chave aqui corresponde a um endereço real de
 * `web/src/lib/rotas.ts` (o arquivo não importa `rotas.ts` de propósito: são fontes independentes, para o teste de
 * sincronismo ter o que pegar quando uma tela mudar de endereço e este arquivo não acompanhar).
 */

export interface DestinoFixo {
  forma: "fixo";
  /** Caminho absoluto, exatamente como em `rotas.ts`. */
  caminho: string;
  /** `data-treino` do elemento a piscar quando a ação é "mostrar na tela"; sem ele, "destacar" vira só "navegar". */
  alvo?: string;
}

export interface DestinoComContexto {
  forma: "com_contexto";
  /** Nome do campo que o cliente manda no `contexto` da tela atual (nunca escrito pela IA). */
  campo: string;
  /** Gabarito do caminho, com `{<campo>}` substituído pelo valor do contexto. */
  modelo: string;
  alvo?: string;
}

export interface DestinoComFiltro {
  forma: "com_filtro";
  /** Nome do campo que a IA (ou a busca sem IA) preenche, sempre validado antes de entrar na URL. */
  campo: string;
  /** Fonte de um `RegExp` (sem flags) que o valor tem que casar inteiro. */
  padrao: string;
  /** Gabarito do caminho, com `{<campo>}` substituído pelo valor já validado. */
  modelo: string;
  alvo?: string;
}

export type Destino = DestinoFixo | DestinoComContexto | DestinoComFiltro;

/**
 * As chaves usadas pelos manuais (`api/conteudo/vitoria/*.md`) e pelas sugestões fixas (`sugestoes.ts`). Cobre as telas
 * dos dois perfis; o manual do técnico nunca cita uma chave de tela que só o admin alcança (quem decide isso é o
 * conteúdo do manual, não este arquivo).
 */
export const DESTINOS: Record<string, Destino> = {
  // ---- Comuns aos dois perfis -------------------------------------------------------------------------------------
  quadro_os: { forma: "fixo", caminho: "/app/lista", alvo: "menu-lista" },
  preventivas: { forma: "fixo", caminho: "/app/lista?preventivas=1", alvo: "menu-lista" },
  os_detalhe: { forma: "com_contexto", campo: "os_id", modelo: "/app/os/{os_id}" },
  apr_nova: { forma: "com_contexto", campo: "os_id", modelo: "/app/os/{os_id}/apr", alvo: "os-nova-apr" },
  execucao: { forma: "com_contexto", campo: "os_id", modelo: "/app/os/{os_id}/execucao", alvo: "os-iniciar-execucao" },
  perfil: { forma: "fixo", caminho: "/app/perfil" },
  equipe: { forma: "com_contexto", campo: "equipe_id", modelo: "/app/equipes/{equipe_id}" },
  busca: { forma: "fixo", caminho: "/app/busca" },
  dashboard_geral: { forma: "fixo", caminho: "/app/dashboard/geral", alvo: "menu-dashboard" },
  dashboard_meus: { forma: "fixo", caminho: "/app/dashboard/meus", alvo: "menu-dashboard" },
  dashboard_meus_periodo: { forma: "com_filtro", campo: "periodo", padrao: "\\d{4}-\\d{2}", modelo: "/app/dashboard/meus?periodo={periodo}" },
  usuarios: { forma: "fixo", caminho: "/app/usuarios", alvo: "menu-usuarios" },
  catalogo_servicos: { forma: "fixo", caminho: "/app/catalogo/servicos", alvo: "menu-catalogo" },
  catalogo_materiais: { forma: "fixo", caminho: "/app/catalogo/materiais", alvo: "menu-catalogo" },
  treinar_servico: { forma: "com_contexto", campo: "servico_codigo", modelo: "/app/catalogo/servicos/{servico_codigo}/treinar" },
  gamificacao_minha: { forma: "fixo", caminho: "/app/gamificacao/minha", alvo: "menu-gamificacao" },
  gamificacao_ranking: { forma: "fixo", caminho: "/app/gamificacao/ranking", alvo: "menu-gamificacao" },
  gamificacao_conquistas: { forma: "fixo", caminho: "/app/gamificacao/conquistas", alvo: "menu-gamificacao" },
  gamificacao_patentes: { forma: "fixo", caminho: "/app/gamificacao/patentes", alvo: "menu-gamificacao" },
  gamificacao_pontos: { forma: "fixo", caminho: "/app/gamificacao/pontos", alvo: "menu-gamificacao" },
  treino_campo: { forma: "fixo", caminho: "/app/treino", alvo: "menu-treino" },
  aguardando: { forma: "fixo", caminho: "/app/aguardando" },

  // ---- Só o admin alcança (o manual do técnico nunca cita estas chaves) ---------------------------------------------
  modelos_apr: { forma: "fixo", caminho: "/web/apr/modelos", alvo: "menu-apr" },
  atividades_apr: { forma: "fixo", caminho: "/web/apr/atividades", alvo: "menu-apr" },
  novo_modelo_apr: { forma: "fixo", caminho: "/web/apr/modelos/novo", alvo: "menu-apr" },
  modelo_apr: { forma: "com_contexto", campo: "modelo_codigo", modelo: "/web/apr/modelos/{modelo_codigo}" },
  importacao: { forma: "fixo", caminho: "/web/os/importacao", alvo: "menu-importacao" },
  auditoria: { forma: "fixo", caminho: "/web/auditoria", alvo: "menu-auditoria" },
  alertas: { forma: "fixo", caminho: "/web/alertas" },
  dashboard_os: { forma: "fixo", caminho: "/app/dashboard/os", alvo: "menu-dashboard" },
  dashboard_apr: { forma: "fixo", caminho: "/app/dashboard/apr", alvo: "menu-dashboard" },
  dashboard_equipes: { forma: "fixo", caminho: "/app/dashboard/equipes", alvo: "menu-dashboard" },
  exportacao_sap: { forma: "fixo", caminho: "/app/dashboard/os#exportacao", alvo: "menu-dashboard" },
  simulador_funcionarios: { forma: "fixo", caminho: "/simulador/funcionarios" },
  simulador_ordens: { forma: "fixo", caminho: "/simulador/ordens" },
  treinamento_servico_editor: { forma: "com_contexto", campo: "servico_codigo", modelo: "/app/catalogo/servicos/{servico_codigo}/treinamento" },
  vitoria_sem_resposta: { forma: "fixo", caminho: "/app/vitoria/sem-resposta" },
};

export type ChaveDeDestino = keyof typeof DESTINOS;

/** O que a IA (ou o fallback sem IA) produz, antes de validar contra o manifesto. */
export interface AcaoBruta {
  tipo: "navegar" | "destacar" | "nenhuma" | "nao_sei";
  /** Obrigatório quando `tipo` é "navegar" ou "destacar": uma chave de `DESTINOS`. */
  destino?: string;
  /** Só quando o destino é `com_filtro`. */
  filtro?: string;
}

/**
 * O que a api devolve ao cliente: a ação já resolvida, com a URL pronta. Leva também `destino` (e `valor`, quando veio
 * de um filtro) para a web conferir de nascisco com `resolverAcao` antes de navegar — a dupla checagem da
 * especificação não é só confiar na `url` pronta, é refazer a validação com o próprio contexto do cliente.
 */
export interface AcaoResolvida {
  tipo: "navegar" | "destacar";
  url: string;
  /** `data-treino` do elemento a piscar; só quando `tipo` é "destacar" e o destino tem `alvo`. */
  alvo?: string;
  /** A chave de `DESTINOS` usada; a web recomputa a ação com ela antes de confiar na `url`. */
  destino: string;
  /** Só quando o destino é `com_filtro`: o valor já validado, para a web validar de novo com o próprio padrão. */
  valor?: string;
}

export interface ResultadoDaAcao {
  /** A ação pronta para o cliente usar, ou `null` quando não há nada para oferecer (texto puro, sem botão). */
  resolvida: AcaoResolvida | null;
  /** A chave citada não existe no manifesto: é hallucinação da IA, não um descarte normal (quem chama grava "não sei"). */
  destinoDesconhecido: boolean;
}

/**
 * Valida e monta a URL de uma ação bruta contra o manifesto. É a mesma função que a `api` usa antes de devolver a
 * ação e que a web usa de novo antes de navegar (dupla checagem, como a especificação pede): nenhum dos dois lados
 * confia em uma URL que não tenha passado por aqui.
 */
export function resolverAcao(bruta: AcaoBruta, contexto: Record<string, string> = {}): ResultadoDaAcao {
  if (bruta.tipo !== "navegar" && bruta.tipo !== "destacar") return { resolvida: null, destinoDesconhecido: false };
  const chave = bruta.destino?.trim();
  const destino = chave ? DESTINOS[chave] : undefined;
  if (!chave || !destino) return { resolvida: null, destinoDesconhecido: true };

  let url: string | null = null;
  let valorDoFiltro: string | undefined;
  if (destino.forma === "fixo") {
    url = destino.caminho;
  } else if (destino.forma === "com_contexto") {
    const valor = contexto[destino.campo]?.trim();
    url = valor ? destino.modelo.replace(`{${destino.campo}}`, encodeURIComponent(valor)) : null;
  } else {
    const valor = bruta.filtro?.trim();
    const casa = valor ? new RegExp(`^${destino.padrao}$`).test(valor) : false;
    url = valor && casa ? destino.modelo.replace(`{${destino.campo}}`, encodeURIComponent(valor)) : null;
    if (url) valorDoFiltro = valor;
  }
  if (url === null) return { resolvida: null, destinoDesconhecido: false };

  const alvo = bruta.tipo === "destacar" ? destino.alvo : undefined;
  return {
    resolvida: { tipo: alvo ? "destacar" : "navegar", url, destino: chave, ...(alvo ? { alvo } : {}), ...(valorDoFiltro ? { valor: valorDoFiltro } : {}) },
    destinoDesconhecido: false,
  };
}
