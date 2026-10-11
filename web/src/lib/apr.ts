/**
 * APR do técnico: tipos do modelo (da `api`), o rascunho que fica no navegador até a APR ser concluída e as regras
 * puras sobre ele (perguntas, item reprovado, evidência faltando, resultado esperado, payload do evento).
 * O resultado que vale é sempre o que a `api` calcula; aqui ele só decide qual tela mostrar.
 */

export type Resposta = "sim" | "nao" | "na";
export type Funcao = "responsavel" | "executor";

export interface RiscoDoModelo {
  id: string;
  classificacao: string;
  nome: string;
  ordem: number;
}

export interface ItemDoModelo {
  id: string;
  secao: "verificacao" | "medida_preventiva";
  risco_id: string | null;
  ordem: number;
  texto: string;
  resposta_bloqueante: "sim" | "nao" | null;
  tipo: "eliminatorio" | "alerta";
  evidencia: "foto" | "texto";
  permite_na: boolean;
}

/** Resumo de um modelo (`GET /modelos-apr`). */
export interface ModeloResumo {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
  data_documento: string | null;
  publicado_em: string | null;
  itens_total: number;
}

/** Modelo completo (`GET /modelos-apr/{codigo}/versoes/{versao}`); o PAE não é usado aqui. */
export interface ModeloCompleto {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
  data_documento: string | null;
  publicado_em: string | null;
  riscos: RiscoDoModelo[];
  itens: ItemDoModelo[];
}

/** O que do modelo o rascunho guarda: a versão exata que está sendo respondida. */
export type ModeloDoRascunho = Pick<ModeloCompleto, "id" | "codigo" | "versao" | "titulo" | "riscos" | "itens">;

export const doModeloCompleto = (m: ModeloCompleto): ModeloDoRascunho => ({ id: m.id, codigo: m.codigo, versao: m.versao, titulo: m.titulo, riscos: m.riscos, itens: m.itens });

/** Colega da equipe da OS (`GET /usuarios?equipe_id=`), no que a APR usa. */
export interface Colega {
  id: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  perfil: string;
  assinatura_path: string | null;
}

export interface FotoDoRascunho {
  /** Id da evidência (nasce no cliente). */
  id: string;
  /** Id do arquivo já enviado (`PUT /arquivos/{id}`). */
  arquivoId: string;
  capturadaEm: string;
  latitude?: number;
  longitude?: number;
  /** Miniatura (data URL): o arquivo só pode ser lido da `api` depois que a APR o referencia. */
  miniatura?: string;
}

export interface RespostaDoRascunho {
  resposta: Resposta;
  observacao: string;
  respondidaEm: string;
}

export interface RascunhoApr {
  versao: 1;
  osId: string;
  usuarioId: string;
  /** Ids que o evento leva; guardados para um reenvio não duplicar a APR. */
  aprId: string;
  eventoId: string;
  criadoEm: string;
  modelo: ModeloDoRascunho;
  participantes: { usuarioId: string; funcao: Funcao }[];
  /** Riscos marcados ("( )" da planilha): só as medidas deles entram no checklist. */
  riscos: string[];
  respostas: Record<string, RespostaDoRascunho>;
  fotos: Record<string, FotoDoRascunho[]>;
  observacaoGeral: string;
  /** Posição (base 0) na lista de perguntas. */
  indice: number;
  modo: "pergunta" | "revisao";
  /** Quando o técnico concluiu e validou (define o dia de validade da APR). */
  concluidaEm: string | null;
  /** Participante → instante em que confirmou a assinatura do perfil (só APR aprovada). */
  assinaturas: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------------------------
// Perguntas e regras
// ---------------------------------------------------------------------------------------------------------------

/** Itens de verificação mais as medidas dos riscos marcados, na ordem do modelo. */
export function perguntasDe(modelo: ModeloDoRascunho, riscosMarcados: string[]): ItemDoModelo[] {
  const marcados = new Set(riscosMarcados);
  return modelo.itens.filter((i) => i.secao === "verificacao" || (i.risco_id !== null && marcados.has(i.risco_id))).sort((a, b) => a.ordem - b.ordem);
}

/** Quantas perguntas o checklist terá com estes riscos marcados. */
export const totalDePerguntas = (modelo: ModeloDoRascunho, riscosMarcados: string[]) => perguntasDe(modelo, riscosMarcados).length;

/** Item reprovado: `eliminatorio` com a resposta igual à `resposta_bloqueante`. */
export const estaReprovado = (item: ItemDoModelo, resposta: Resposta | undefined) =>
  item.tipo === "eliminatorio" && item.resposta_bloqueante !== null && resposta === item.resposta_bloqueante;

/** Item de alerta com a resposta que o marca: segue, mas aparece no PDF e no painel. */
export const geraAlerta = (item: ItemDoModelo, resposta: Resposta | undefined) =>
  item.tipo === "alerta" && item.resposta_bloqueante !== null && resposta === item.resposta_bloqueante;

const vazio = (texto: string | undefined) => !texto || texto.trim() === "";

/** Reprovado sem a evidência exigida: observação sempre; foto, salvo quando a evidência do item é só texto. */
export function faltaEvidencia(r: RascunhoApr, item: ItemDoModelo): boolean {
  const resp = r.respostas[item.id];
  if (!estaReprovado(item, resp?.resposta)) return false;
  if (vazio(resp?.observacao)) return true;
  return item.evidencia === "foto" && (r.fotos[item.id]?.length ?? 0) === 0;
}

/** "NA" exige observação. */
export const faltaObservacaoNa = (r: RascunhoApr, item: ItemDoModelo) => r.respostas[item.id]?.resposta === "na" && vazio(r.respostas[item.id]?.observacao);

export interface ResumoDoRascunho {
  perguntas: ItemDoModelo[];
  respondidas: number;
  /** Perguntas sem resposta. */
  semResposta: ItemDoModelo[];
  reprovados: ItemDoModelo[];
  alertas: ItemDoModelo[];
  semEvidencia: ItemDoModelo[];
  naSemObservacao: ItemDoModelo[];
  /** Pode concluir: tudo respondido e nenhuma evidência ou observação faltando. */
  completo: boolean;
}

export function resumoDe(r: RascunhoApr): ResumoDoRascunho {
  const perguntas = perguntasDe(r.modelo, r.riscos);
  const semResposta = perguntas.filter((i) => !r.respostas[i.id]);
  const reprovados = perguntas.filter((i) => estaReprovado(i, r.respostas[i.id]?.resposta));
  const alertas = perguntas.filter((i) => geraAlerta(i, r.respostas[i.id]?.resposta));
  const semEvidencia = perguntas.filter((i) => faltaEvidencia(r, i));
  const naSemObservacao = perguntas.filter((i) => faltaObservacaoNa(r, i));
  return {
    perguntas,
    respondidas: perguntas.length - semResposta.length,
    semResposta,
    reprovados,
    alertas,
    semEvidencia,
    naSemObservacao,
    completo: perguntas.length > 0 && semResposta.length === 0 && semEvidencia.length === 0 && naSemObservacao.length === 0,
  };
}

/** Resultado que a `api` deve calcular; só decide a tela (assinaturas ou impedimento). */
export const resultadoEsperado = (r: RascunhoApr): "aprovada" | "bloqueada" => (resumoDe(r).reprovados.length > 0 ? "bloqueada" : "aprovada");

// ---------------------------------------------------------------------------------------------------------------
// Alterações do rascunho (funções puras)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Registra a resposta de um item. Evidência só vale para item reprovado e observação só para reprovado ou "NA": mudar a
 * resposta para outra coisa descarta o que não se aplica mais.
 */
export function responder(r: RascunhoApr, item: ItemDoModelo, resposta: Resposta, agora = new Date()): RascunhoApr {
  const anterior = r.respostas[item.id];
  const guardaObservacao = estaReprovado(item, resposta) || resposta === "na";
  const guardaFotos = estaReprovado(item, resposta);
  const fotos = { ...r.fotos };
  if (!guardaFotos) delete fotos[item.id];
  return {
    ...r,
    respostas: {
      ...r.respostas,
      [item.id]: { resposta, observacao: guardaObservacao ? (anterior?.observacao ?? "") : "", respondidaEm: agora.toISOString() },
    },
    fotos,
  };
}

export function observar(r: RascunhoApr, itemId: string, texto: string): RascunhoApr {
  const atual = r.respostas[itemId];
  if (!atual) return r;
  return { ...r, respostas: { ...r.respostas, [itemId]: { ...atual, observacao: texto } } };
}

export function adicionarFoto(r: RascunhoApr, itemId: string, foto: FotoDoRascunho): RascunhoApr {
  return { ...r, fotos: { ...r.fotos, [itemId]: [...(r.fotos[itemId] ?? []), foto] } };
}

export function removerFoto(r: RascunhoApr, itemId: string, fotoId: string): RascunhoApr {
  return { ...r, fotos: { ...r.fotos, [itemId]: (r.fotos[itemId] ?? []).filter((f) => f.id !== fotoId) } };
}

// ---------------------------------------------------------------------------------------------------------------
// Evento `apr_concluida`
// ---------------------------------------------------------------------------------------------------------------

/** Payload exato do evento (`api/src/dominio/eventos-apr.ts`); o `os_id` vai no envelope. */
export function montarPayload(r: RascunhoApr, resultado: "aprovada" | "bloqueada") {
  const perguntas = perguntasDe(r.modelo, r.riscos);
  const concluidaEm = r.concluidaEm ?? new Date().toISOString();
  const evidencias = perguntas
    .filter((i) => estaReprovado(i, r.respostas[i.id]?.resposta))
    .flatMap((i) =>
      (r.fotos[i.id] ?? []).map((f) => ({
        id: f.id,
        arquivo_id: f.arquivoId,
        item_id: i.id,
        capturada_em: f.capturadaEm,
        ...(f.latitude !== undefined && f.longitude !== undefined ? { latitude: f.latitude, longitude: f.longitude } : {}),
      })),
    );
  return {
    id: r.aprId,
    modelo_apr_id: r.modelo.id,
    participantes: r.participantes.map((p) => ({
      usuario_id: p.usuarioId,
      funcao: p.funcao,
      // Só a APR aprovada passa pela confirmação das assinaturas; na bloqueada a `api` assume a hora da conclusão.
      ...(resultado === "aprovada" ? { assinada_em: r.assinaturas[p.usuarioId] ?? new Date().toISOString() } : {}),
    })),
    riscos: r.riscos,
    respostas: perguntas.map((i) => {
      const resp = r.respostas[i.id]!;
      return { item_id: i.id, resposta: resp.resposta, ...(vazio(resp.observacao) ? {} : { observacao: resp.observacao.trim() }), respondida_em: resp.respondidaEm };
    }),
    evidencias,
    ...(vazio(r.observacaoGeral) ? {} : { observacao_geral: r.observacaoGeral.trim() }),
    concluida_em: concluidaEm,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Rascunho novo
// ---------------------------------------------------------------------------------------------------------------

export function novoRascunho(d: {
  osId: string;
  usuarioId: string;
  modelo: ModeloDoRascunho;
  participantes: { usuarioId: string; funcao: Funcao }[];
  riscos: string[];
  id?: () => string;
}): RascunhoApr {
  const novoId = d.id ?? (() => crypto.randomUUID());
  return {
    versao: 1,
    osId: d.osId,
    usuarioId: d.usuarioId,
    aprId: novoId(),
    eventoId: novoId(),
    criadoEm: new Date().toISOString(),
    modelo: d.modelo,
    participantes: d.participantes,
    riscos: d.riscos,
    respostas: {},
    fotos: {},
    observacaoGeral: "",
    indice: 0,
    modo: "pergunta",
    concluidaEm: null,
    assinaturas: {},
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Navegação entre as perguntas
// ---------------------------------------------------------------------------------------------------------------

/** Vai para a próxima pergunta; depois da última, abre a revisão. */
export function avancar(r: RascunhoApr): RascunhoApr {
  const total = totalDePerguntas(r.modelo, r.riscos);
  return r.indice < total - 1 ? { ...r, indice: r.indice + 1 } : { ...r, modo: "revisao" };
}

export const voltar = (r: RascunhoApr): RascunhoApr => (r.indice > 0 ? { ...r, indice: r.indice - 1 } : r);

export const irPara = (r: RascunhoApr, indice: number): RascunhoApr => ({ ...r, indice, modo: "pergunta" });

export const abrirRevisao = (r: RascunhoApr): RascunhoApr => ({ ...r, modo: "revisao" });

/** Volta da revisão para a última pergunta. */
export const voltarDaRevisao = (r: RascunhoApr): RascunhoApr => ({ ...r, indice: Math.max(0, totalDePerguntas(r.modelo, r.riscos) - 1), modo: "pergunta" });
