/**
 * APR do técnico: tipos do modelo (da `api`), o rascunho que fica no navegador até a APR ser concluída e as regras
 * puras sobre ele (perguntas, evidência faltando, payload do evento).
 *
 * O técnico não sabe quais itens são eliminatórios: o modelo que ele recebe não traz o tipo, a resposta que bloqueia
 * nem a evidência do item. Quem diz se a APR passa é a `api` (`POST /aprs/avaliar`), depois que tudo foi respondido;
 * só então aparecem os itens reprovados e a evidência que cada um pede. A APR bloqueada já fica registrada nessa hora
 * (descartar o rascunho não a apaga); a evidência dos reprovados vai depois, no evento da mesma APR.
 */

import { novoUuid } from "./uuid";

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
  permite_na: boolean;
}

/**
 * O que o item reprovado pede, além da observação: `foto` (ao menos uma), `pdf` (ao menos um documento, como um laudo
 * ou certificado) ou `texto` (só a justificativa). Fotos e PDFs a mais são sempre aceitos.
 */
export type EvidenciaDoItem = "foto" | "texto" | "pdf";

/** Item que reprovou, como a `api` o devolve em `POST /aprs/avaliar`, com a evidência que ele pede. */
export interface ItemReprovado {
  itemId: string;
  texto: string;
  evidencia: EvidenciaDoItem;
}

/** Resposta de `POST /aprs/avaliar`: o resultado das respostas e, se bloqueada, o que reprovou. */
export interface Avaliacao {
  resultado: "aprovada" | "bloqueada";
  reprovados: ItemReprovado[];
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

/** PDF já enviado (`PUT /arquivos/{id}` com `tipo=pdf`), anexado a um item reprovado. */
export interface DocumentoDoRascunho {
  /** Id da evidência (nasce no cliente). */
  id: string;
  arquivoId: string;
  /** Nome do arquivo escolhido, para exibir e para a `api` guardar. */
  nome: string;
  capturadaEm: string;
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
  /** PDFs por item reprovado. Ausente nos rascunhos gravados antes de existir a evidência em PDF. */
  documentos?: Record<string, DocumentoDoRascunho[]>;
  observacaoGeral: string;
  /** Posição (base 0) na lista de perguntas. */
  indice: number;
  modo: "pergunta" | "revisao";
  /** Quando o técnico concluiu e validou (define o dia de validade da APR). */
  concluidaEm: string | null;
  /**
   * O que a `api` disse ao validar as respostas. Com `bloqueada`, as respostas ficam travadas: só falta a evidência dos
   * reprovados e o envio. Qualquer mudança nas respostas de uma APR aprovada apaga isto e exige validar de novo.
   */
  avaliacao: Avaliacao | null;
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

const vazio = (texto: string | undefined) => !texto || texto.trim() === "";

/** Os PDFs anexados a um item do rascunho. */
export const documentosDe = (r: RascunhoApr, itemId: string): DocumentoDoRascunho[] => r.documentos?.[itemId] ?? [];

/** Reprovado sem a evidência exigida: observação sempre; mais uma foto ou um PDF, conforme o item (o de texto, nada). */
export function faltaEvidencia(r: RascunhoApr, reprovado: ItemReprovado): boolean {
  if (vazio(r.respostas[reprovado.itemId]?.observacao)) return true;
  if (reprovado.evidencia === "foto") return (r.fotos[reprovado.itemId]?.length ?? 0) === 0;
  if (reprovado.evidencia === "pdf") return documentosDe(r, reprovado.itemId).length === 0;
  return false;
}

/** Itens que a `api` reprovou e ainda estão sem a evidência exigida. */
export const reprovadosSemEvidencia = (r: RascunhoApr) => (r.avaliacao?.reprovados ?? []).filter((x) => faltaEvidencia(r, x));

/** "NA" exige observação. */
export const faltaObservacaoNa = (r: RascunhoApr, item: ItemDoModelo) => r.respostas[item.id]?.resposta === "na" && vazio(r.respostas[item.id]?.observacao);

export interface ResumoDoRascunho {
  perguntas: ItemDoModelo[];
  respondidas: number;
  /** Perguntas sem resposta. */
  semResposta: ItemDoModelo[];
  naSemObservacao: ItemDoModelo[];
  /** Pode validar: tudo respondido e nenhum "NA" sem observação. */
  completo: boolean;
}

export function resumoDe(r: RascunhoApr): ResumoDoRascunho {
  const perguntas = perguntasDe(r.modelo, r.riscos);
  const semResposta = perguntas.filter((i) => !r.respostas[i.id]);
  const naSemObservacao = perguntas.filter((i) => faltaObservacaoNa(r, i));
  return {
    perguntas,
    respondidas: perguntas.length - semResposta.length,
    semResposta,
    naSemObservacao,
    completo: perguntas.length > 0 && semResposta.length === 0 && naSemObservacao.length === 0,
  };
}

/** A `api` já reprovou (e registrou) esta APR: as respostas não mudam mais, só falta a evidência e o envio. */
export const estaTravada = (r: RascunhoApr) => r.avaliacao?.resultado === "bloqueada";

/** Onde o rascunho continua: a APR aprovada vai para as assinaturas; a em andamento e a bloqueada, para o checklist. */
export const continuaNasAssinaturas = (r: RascunhoApr) => r.avaliacao?.resultado === "aprovada";

/** Pergunta antes de descartar o rascunho. A APR bloqueada já está registrada: descartar só abre mão da evidência. */
export const avisoAoDescartar = (r: RascunhoApr) =>
  estaTravada(r)
    ? "Esta APR já foi registrada como bloqueada e o supervisor foi avisado. Descartar o rascunho só deixa de anexar a evidência (observações, fotos e PDFs). Descartar mesmo assim?"
    : "Descartar esta APR em andamento? As respostas e as fotos deste rascunho serão perdidas.";

// ---------------------------------------------------------------------------------------------------------------
// Alterações do rascunho (funções puras)
// ---------------------------------------------------------------------------------------------------------------

/** Registra a resposta de um item. A observação só vale para "NA": mudar a resposta para outra coisa a descarta. */
export function responder(r: RascunhoApr, item: ItemDoModelo, resposta: Resposta, agora = new Date()): RascunhoApr {
  const anterior = r.respostas[item.id];
  return {
    ...r,
    respostas: {
      ...r.respostas,
      [item.id]: { resposta, observacao: resposta === "na" ? (anterior?.observacao ?? "") : "", respondidaEm: agora.toISOString() },
    },
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

export function adicionarDocumento(r: RascunhoApr, itemId: string, documento: DocumentoDoRascunho): RascunhoApr {
  return { ...r, documentos: { ...r.documentos, [itemId]: [...documentosDe(r, itemId), documento] } };
}

export function removerDocumento(r: RascunhoApr, itemId: string, documentoId: string): RascunhoApr {
  return { ...r, documentos: { ...r.documentos, [itemId]: documentosDe(r, itemId).filter((d) => d.id !== documentoId) } };
}

/** Tira da APR quem não está presente (o técnico logado sempre fica); se saiu o responsável, o técnico logado assume. */
export function retirarParticipante(r: RascunhoApr, usuarioId: string): RascunhoApr {
  if (usuarioId === r.usuarioId) return r;
  const restantes = r.participantes.filter((p) => p.usuarioId !== usuarioId);
  const semResponsavel = !restantes.some((p) => p.funcao === "responsavel");
  return { ...r, participantes: restantes.map((p) => (semResponsavel && p.usuarioId === r.usuarioId ? { ...p, funcao: "responsavel" as const } : p)) };
}

// ---------------------------------------------------------------------------------------------------------------
// Evento `apr_concluida`
// ---------------------------------------------------------------------------------------------------------------

/** A APR do rascunho, sem as fotos, nos campos do evento (`api/src/dominio/eventos-apr.ts`). */
function dadosDaApr(r: RascunhoApr) {
  const resultado = r.avaliacao?.resultado;
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
    respostas: perguntasDe(r.modelo, r.riscos).map((i) => {
      const resp = r.respostas[i.id]!;
      return { item_id: i.id, resposta: resp.resposta, ...(vazio(resp.observacao) ? {} : { observacao: resp.observacao.trim() }), respondida_em: resp.respondidaEm };
    }),
    ...(vazio(r.observacaoGeral) ? {} : { observacao_geral: r.observacaoGeral.trim() }),
    concluida_em: r.concluidaEm ?? new Date().toISOString(),
  };
}

/**
 * Corpo de `POST /aprs/avaliar`: a APR inteira, menos as fotos (o técnico ainda não sabe o que reprovou). Se ela
 * reprovar, é com isto que a `api` já a registra; `concluidaEm` é a hora da conclusão.
 */
export const montarAvaliacao = (r: RascunhoApr) => ({ ...dadosDaApr({ ...r, avaliacao: null }), os_id: r.osId });

/**
 * Payload exato do evento `apr_concluida`; o `os_id` vai no envelope. As fotos e os PDFs são só dos itens que a `api`
 * reprovou (`avaliacao`). Na APR bloqueada, que a `api` registrou ao validar, o evento leva a evidência dos reprovados.
 */
export function montarPayload(r: RascunhoApr) {
  const evidencias = (r.avaliacao?.reprovados ?? []).flatMap((i) => [
    ...(r.fotos[i.itemId] ?? []).map((f) => ({
      id: f.id,
      arquivo_id: f.arquivoId,
      item_id: i.itemId,
      capturada_em: f.capturadaEm,
      ...(f.latitude !== undefined && f.longitude !== undefined ? { latitude: f.latitude, longitude: f.longitude } : {}),
    })),
    ...documentosDe(r, i.itemId).map((d) => ({ id: d.id, arquivo_id: d.arquivoId, tipo: "pdf" as const, nome: d.nome, item_id: i.itemId, capturada_em: d.capturadaEm })),
  ]);
  return { ...dadosDaApr(r), evidencias };
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
  const novoId = d.id ?? novoUuid;
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
    documentos: {},
    observacaoGeral: "",
    indice: 0,
    modo: "pergunta",
    concluidaEm: null,
    avaliacao: null,
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
