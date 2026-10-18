import { and, asc, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import {
  atividade,
  atividadeMaterial,
  material,
  treinamentoServico,
  treinamentoServicoReporte,
  treinamentoServicoResposta,
  treinamentoServicoTentativa,
  treinamentoServicoVersao,
  usuario,
} from "../db/schema";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { contar } from "../http/paginacao";
import { validar } from "../http/validacao";
import type { ContextoDePontos, Ganho } from "./lancamentos";
import { pontuarTreinamentoServico } from "./pontuacao";
import { avisarAdmins, criarAviso } from "./alertas";
import { pendenciasAbertas, type PendenciaAberta } from "../../../shared/treinamento-servico/ia";
import {
  esquemaFases,
  esquemaRespostaEscolha,
  esquemaRespostaPares,
  esquemaRespostaSelecionados,
  esquemaRespostaSequencia,
  validarConteudo,
  validarFasesContraCatalogo,
  validarPublicavel,
  validarSemPendencias,
  type ConteudoDoTreinamento,
  type FaseEntrada,
  type PassoExplicacao,
} from "./treinamento-servico-esquema";

/**
 * Domínio dos treinamentos de serviço (seção 3 do `vitoria.md`). Segue o espírito de `modelo-apr-banco.ts`
 * (rascunho → publicada → substituída), mas sem tabelas filhas: a explicação e as fases ficam em jsonb, validadas em
 * `treinamento-servico-esquema.ts`. O embaralhamento (`apresentacao`) é a parte mais sensível: tudo que o jogador recebe
 * antes de responder passa por `fasesParaJogar`, nunca pelo objeto `fases` cru (que é o gabarito).
 */

export const TERMO_TREINAMENTO = (codigo: string, descricao: string) =>
  `Declaro que revisei este treinamento e que a explicação, as fases e as respostas estão de acordo com as normas da empresa e com o fluxo correto do serviço ${codigo} — ${descricao}.`;

type VersaoLinha = typeof treinamentoServicoVersao.$inferSelect;
type TentativaLinha = typeof treinamentoServicoTentativa.$inferSelect;

function explicacaoDe(linha: VersaoLinha): PassoExplicacao[] {
  return (linha.explicacao as PassoExplicacao[]) ?? [];
}
function fasesDe(linha: VersaoLinha): FaseEntrada[] {
  return esquemaFases.parse(linha.fases ?? []);
}

export async function treinamentoDoCodigo(db: Db, atividadeCodigo: string) {
  const [linha] = await db.select().from(treinamentoServico).where(eq(treinamentoServico.atividadeCodigo, atividadeCodigo)).limit(1);
  return linha;
}

export async function rascunhoDoTreinamento(db: Db, treinamentoId: string) {
  const [linha] = await db.select().from(treinamentoServicoVersao).where(and(eq(treinamentoServicoVersao.treinamentoId, treinamentoId), eq(treinamentoServicoVersao.estado, "rascunho"))).limit(1);
  return linha;
}

export async function versaoPublicadaDoTreinamento(db: Db, treinamentoId: string) {
  const [linha] = await db.select().from(treinamentoServicoVersao).where(and(eq(treinamentoServicoVersao.treinamentoId, treinamentoId), eq(treinamentoServicoVersao.estado, "publicada"))).limit(1);
  return linha;
}

// ---- Leitura para quem treina ---------------------------------------------------------------------------------------

export interface TreinamentoDaLista {
  atividadeCodigo: string;
  descricao: string;
  versao: number;
  publicadaEm: Date;
  totalFases: number;
  concluido: boolean;
  fasesCertas: number;
}

/** Os treinamentos publicados, com a situação de quem pede (concluído e fases certas, se já pontuou). */
export async function listarTreinamentosPublicados(db: Db, usuarioId: string): Promise<TreinamentoDaLista[]> {
  const linhas = await db
    .select({
      atividadeCodigo: treinamentoServico.atividadeCodigo,
      descricao: atividade.descricao,
      versao: treinamentoServicoVersao.versao,
      publicadaEm: treinamentoServicoVersao.publicadaEm,
      fases: treinamentoServicoVersao.fases,
      treinamentoId: treinamentoServico.id,
    })
    .from(treinamentoServicoVersao)
    .innerJoin(treinamentoServico, eq(treinamentoServico.id, treinamentoServicoVersao.treinamentoId))
    .innerJoin(atividade, eq(atividade.codigo, treinamentoServico.atividadeCodigo))
    .where(eq(treinamentoServicoVersao.estado, "publicada"))
    .orderBy(asc(atividade.codigo));
  if (linhas.length === 0) return [];

  const pontuadas = await db
    .select({ treinamentoId: treinamentoServicoTentativa.treinamentoId, fasesCertas: treinamentoServicoTentativa.fasesCertas })
    .from(treinamentoServicoTentativa)
    .where(
      and(
        eq(treinamentoServicoTentativa.usuarioId, usuarioId),
        eq(treinamentoServicoTentativa.pontuada, true),
        inArray(
          treinamentoServicoTentativa.treinamentoId,
          linhas.map((l) => l.treinamentoId),
        ),
      ),
    );
  const pontuadaPorTreinamento = new Map(pontuadas.map((p) => [p.treinamentoId, p.fasesCertas]));

  return linhas.map((l) => ({
    atividadeCodigo: l.atividadeCodigo,
    descricao: l.descricao,
    versao: l.versao,
    publicadaEm: l.publicadaEm!,
    totalFases: ((l.fases as unknown[]) ?? []).length,
    concluido: pontuadaPorTreinamento.has(l.treinamentoId),
    fasesCertas: pontuadaPorTreinamento.get(l.treinamentoId) ?? 0,
  }));
}

export interface TreinamentoParaJogador {
  atividadeCodigo: string;
  descricao: string;
  treinamentoId: string;
  versaoId: string;
  versao: number;
  explicacao: PassoExplicacao[];
  cenarioPath: string | null;
  totalFases: number;
  publicadaEm: Date;
  publicadaPorNome: string;
}

/** A versão publicada do serviço, sem o gabarito: a explicação inteira (não tem segredo) e só o total de fases. */
export async function treinamentoParaJogador(db: Db, atividadeCodigo: string): Promise<TreinamentoParaJogador | null> {
  const [linha] = await db
    .select({
      descricao: atividade.descricao,
      treinamentoId: treinamentoServico.id,
      versaoId: treinamentoServicoVersao.id,
      versao: treinamentoServicoVersao.versao,
      explicacao: treinamentoServicoVersao.explicacao,
      fases: treinamentoServicoVersao.fases,
      cenarioPath: treinamentoServicoVersao.cenarioPath,
      publicadaEm: treinamentoServicoVersao.publicadaEm,
      publicadaPorNome: usuario.nome,
    })
    .from(treinamentoServicoVersao)
    .innerJoin(treinamentoServico, eq(treinamentoServico.id, treinamentoServicoVersao.treinamentoId))
    .innerJoin(atividade, eq(atividade.codigo, treinamentoServico.atividadeCodigo))
    .leftJoin(usuario, eq(usuario.id, treinamentoServicoVersao.publicadaPor))
    .where(and(eq(treinamentoServico.atividadeCodigo, atividadeCodigo), eq(treinamentoServicoVersao.estado, "publicada")))
    .limit(1);
  if (!linha) return null;
  return {
    atividadeCodigo,
    descricao: linha.descricao,
    treinamentoId: linha.treinamentoId,
    versaoId: linha.versaoId,
    versao: linha.versao,
    // Sem a meta da IA (o trecho de origem e as pendências): é coisa do editor, não de quem treina.
    explicacao: ((linha.explicacao as PassoExplicacao[]) ?? []).map(({ ia: _ia, ...passo }) => passo),
    cenarioPath: linha.cenarioPath,
    totalFases: ((linha.fases as unknown[]) ?? []).length,
    publicadaEm: linha.publicadaEm!,
    publicadaPorNome: linha.publicadaPorNome ?? "um administrador",
  };
}

// ---- Embaralhamento (apresentação) -----------------------------------------------------------------------------------

/** Fisher-Yates: embaralha sem repetir nem perder nenhum. */
function embaralhar<T>(itens: readonly T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}
/** Uma permutação de `0..n-1`: a posição mostrada → o índice original no gabarito. Não revela nada sozinha. */
const permutacao = (n: number): number[] => embaralhar([...Array(n).keys()]);

interface ApItemComOrdem {
  tipo: "quiz" | "decisao" | "ordem";
  ordem: number[];
}
interface ApSepararItens {
  tipo: "separar_itens";
  itens: { materialId: string; descricao: string }[];
}
interface ApLigar {
  tipo: "ligar";
  esquerdaOrdem: number[];
  direitaOrdem: number[];
}
type ApresentacaoFase = ApItemComOrdem | ApSepararItens | ApLigar;
interface Apresentacao {
  fases: ApresentacaoFase[];
}

/** Materiais ativos de outros serviços, para misturar em "separar os itens"; nunca os já certos desta fase. */
async function sortearItensErrados(db: Db, atividadeAtual: string, materialIdsCertos: string[], quantidade: number) {
  const candidatos = await db
    .selectDistinctOn([material.id], { id: material.id, descricao: material.descricao })
    .from(atividadeMaterial)
    .innerJoin(material, eq(material.id, atividadeMaterial.materialId))
    .where(
      and(
        ne(atividadeMaterial.atividadeCodigo, atividadeAtual),
        eq(material.ativo, true),
        materialIdsCertos.length > 0 ? notInArray(material.id, materialIdsCertos) : undefined,
      ),
    );
  return embaralhar(candidatos).slice(0, quantidade);
}

/** Gera a apresentação (embaralhamento) e o que o jogador vê de cada fase, nunca o gabarito. */
async function montarApresentacao(db: Db, atividadeCodigo: string, fases: FaseEntrada[]) {
  const apFases: ApresentacaoFase[] = [];
  const paraJogar: Record<string, unknown>[] = [];

  for (let indice = 0; indice < fases.length; indice++) {
    const fase = fases[indice]!;
    if (fase.tipo === "quiz") {
      const ordem = permutacao(fase.opcoes.length);
      apFases.push({ tipo: "quiz", ordem });
      paraJogar.push({ indice, tipo: "quiz", enunciado: fase.enunciado, opcoes: ordem.map((i) => fase.opcoes[i]) });
    } else if (fase.tipo === "decisao") {
      const ordem = permutacao(fase.opcoes.length);
      apFases.push({ tipo: "decisao", ordem });
      paraJogar.push({ indice, tipo: "decisao", situacao: fase.situacao, opcoes: ordem.map((i) => fase.opcoes[i]!.texto) });
    } else if (fase.tipo === "separar_itens") {
      const certos = await db.select({ id: material.id, descricao: material.descricao }).from(material).where(inArray(material.id, fase.material_ids));
      const errados = await sortearItensErrados(db, atividadeCodigo, fase.material_ids, fase.quantidade_errados);
      const pool = embaralhar([...certos, ...errados]).map((m) => ({ materialId: m.id, descricao: m.descricao }));
      apFases.push({ tipo: "separar_itens", itens: pool });
      paraJogar.push({ indice, tipo: "separar_itens", enunciado: fase.enunciado, itens: pool });
    } else if (fase.tipo === "ligar") {
      const n = fase.pares.length;
      const esquerdaOrdem = permutacao(n);
      const direitaOrdem = permutacao(n);
      apFases.push({ tipo: "ligar", esquerdaOrdem, direitaOrdem });
      paraJogar.push({ indice, tipo: "ligar", esquerda: esquerdaOrdem.map((i) => fase.pares[i]!.esquerda), direita: direitaOrdem.map((i) => fase.pares[i]!.direita) });
    } else {
      const ordem = permutacao(fase.etapas.length);
      apFases.push({ tipo: "ordem", ordem });
      paraJogar.push({ indice, tipo: "ordem", enunciado: fase.enunciado, etapas: ordem.map((i) => fase.etapas[i]) });
    }
  }
  return { apresentacao: { fases: apFases } satisfies Apresentacao, paraJogar };
}

export interface TentativaAberta {
  tentativaId: string;
  totalFases: number;
  fases: Record<string, unknown>[];
}

async function criarTentativa(db: Db, args: { treinamentoId: string; versaoId: string; atividadeCodigo: string; fases: FaseEntrada[]; usuarioId: string; preVisualizacao: boolean }): Promise<TentativaAberta> {
  const { apresentacao, paraJogar } = await montarApresentacao(db, args.atividadeCodigo, args.fases);
  const [tentativa] = await db
    .insert(treinamentoServicoTentativa)
    .values({ treinamentoId: args.treinamentoId, versaoId: args.versaoId, usuarioId: args.usuarioId, apresentacao, preVisualizacao: args.preVisualizacao })
    .returning({ id: treinamentoServicoTentativa.id });
  return { tentativaId: tentativa!.id, totalFases: args.fases.length, fases: paraJogar };
}

/** Abre uma tentativa na versão publicada (quem treina, inclusive pendente). */
export async function abrirTentativa(db: Db, usuarioId: string, atividadeCodigo: string): Promise<TentativaAberta> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  const publicada = treinamento && (await versaoPublicadaDoTreinamento(db, treinamento.id));
  if (!treinamento || !publicada) throw naoEncontrado("Treinamento não publicado");
  return criarTentativa(db, { treinamentoId: treinamento.id, versaoId: publicada.id, atividadeCodigo, fases: fasesDe(publicada), usuarioId, preVisualizacao: false });
}

/** Pré-visualização do rascunho pelo admin: o mesmo motor do jogo, mas a tentativa nunca pontua. */
export async function abrirPreVisualizacao(db: Db, usuarioId: string, atividadeCodigo: string): Promise<TentativaAberta> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  const rascunho = treinamento && (await rascunhoDoTreinamento(db, treinamento.id));
  if (!treinamento || !rascunho) throw naoEncontrado("Rascunho não encontrado");
  const fases = fasesDe(rascunho);
  if (fases.length === 0) throw invalido("sem_fases", "O rascunho ainda não tem fases para pré-visualizar");
  return criarTentativa(db, { treinamentoId: treinamento.id, versaoId: rascunho.id, atividadeCodigo, fases, usuarioId, preVisualizacao: true });
}

// ---- Corrigir cada fase (o gabarito nunca sai daqui antes da resposta) -----------------------------------------------

export interface ResultadoDaResposta {
  certa: boolean;
  explicacao: string;
  gabarito: Record<string, unknown>;
}

function corrigirFase(fase: FaseEntrada, ap: ApresentacaoFase, respostaBruta: unknown): ResultadoDaResposta {
  if (fase.tipo === "quiz" || fase.tipo === "decisao") {
    if (ap.tipo !== fase.tipo) throw invalido("resposta_invalida", "Fase incompatível com a apresentação gravada");
    const { escolha } = validar(esquemaRespostaEscolha, respostaBruta);
    if (escolha >= ap.ordem.length) throw invalido("resposta_invalida", "escolha fora do intervalo das opções mostradas");
    const original = ap.ordem[escolha]!;
    const certa = original === fase.correta;
    const opcaoCorretaMostrada = ap.ordem.indexOf(fase.correta);
    if (fase.tipo === "quiz") return { certa, explicacao: fase.explicacao, gabarito: { opcao_correta: opcaoCorretaMostrada } };
    return {
      certa,
      explicacao: fase.explicacao,
      gabarito: { opcao_correta: opcaoCorretaMostrada, consequencia_escolhida: fase.opcoes[original]!.consequencia, consequencia_correta: fase.opcoes[fase.correta]!.consequencia },
    };
  }
  if (fase.tipo === "separar_itens") {
    if (ap.tipo !== "separar_itens") throw invalido("resposta_invalida", "Fase incompatível com a apresentação gravada");
    const { selecionados } = validar(esquemaRespostaSelecionados, respostaBruta);
    const apresentados = new Set(ap.itens.map((i) => i.materialId));
    if (selecionados.some((id) => !apresentados.has(id))) throw invalido("resposta_invalida", "item fora da lista apresentada");
    const certos = new Set(fase.material_ids);
    const certa = selecionados.length === certos.size && selecionados.every((id) => certos.has(id));
    return { certa, explicacao: fase.explicacao, gabarito: { certos: ap.itens.filter((i) => certos.has(i.materialId)).map((i) => i.materialId) } };
  }
  if (fase.tipo === "ligar") {
    if (ap.tipo !== "ligar") throw invalido("resposta_invalida", "Fase incompatível com a apresentação gravada");
    const { pares } = validar(esquemaRespostaPares, respostaBruta);
    const n = fase.pares.length;
    if (pares.length !== n) throw invalido("resposta_invalida", "faltam pares para ligar");
    if (pares.some((p) => p.esquerda >= ap.esquerdaOrdem.length || p.direita >= ap.direitaOrdem.length)) throw invalido("resposta_invalida", "par fora do intervalo mostrado");
    const ligados = pares.map((p) => ({ l: ap.esquerdaOrdem[p.esquerda]!, r: ap.direitaOrdem[p.direita]! }));
    const certa = new Set(ligados.map((x) => x.l)).size === n && ligados.every((x) => x.l === x.r);
    return { certa, explicacao: fase.explicacao, gabarito: { pares: fase.pares } };
  }
  // ordem
  if (ap.tipo !== "ordem") throw invalido("resposta_invalida", "Fase incompatível com a apresentação gravada");
  const { sequencia } = validar(esquemaRespostaSequencia, respostaBruta);
  if (sequencia.length !== fase.etapas.length) throw invalido("resposta_invalida", "sequência incompleta");
  if (sequencia.some((p) => p >= ap.ordem.length)) throw invalido("resposta_invalida", "posição fora do intervalo mostrado");
  const originais = sequencia.map((pos) => ap.ordem[pos]!);
  const certa = originais.every((v, i) => v === i);
  return { certa, explicacao: fase.explicacao, gabarito: { etapas: fase.etapas } };
}

/** Responde uma fase: confere contra o gabarito privado da versão e grava (a primeira resposta vence: `onConflictDoNothing`). */
export async function responderFase(db: Db, usuarioId: string, tentativaId: string, faseIndice: number, respostaBruta: unknown): Promise<ResultadoDaResposta> {
  const [tentativa] = await db.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.id, tentativaId));
  if (!tentativa || tentativa.usuarioId !== usuarioId) throw naoEncontrado("Tentativa não encontrada");
  if (tentativa.concluidaEm) throw conflito("tentativa_concluida", "Esta tentativa já foi concluída");
  const [versao] = await db.select().from(treinamentoServicoVersao).where(eq(treinamentoServicoVersao.id, tentativa.versaoId));
  const fases = fasesDe(versao!);
  const fase = fases[faseIndice];
  const apresentacao = tentativa.apresentacao as Apresentacao;
  const apFase = apresentacao.fases[faseIndice];
  if (!fase || !apFase) throw naoEncontrado("Fase não encontrada");

  const resultado = corrigirFase(fase, apFase, respostaBruta);
  await db
    .insert(treinamentoServicoResposta)
    .values({ tentativaId, fase: faseIndice, resposta: respostaBruta as object, certa: resultado.certa })
    .onConflictDoNothing();
  return resultado;
}

export interface ResultadoDaConclusao {
  fasesCertas: number;
  totalFases: number;
  pontuada: boolean;
  ganhos: Ganho[];
}

/** Conclui a tentativa: pontua só na primeira conclusão do treinamento (nunca na pré-visualização do admin). */
export async function concluirTentativa(c: ContextoDePontos, usuarioId: string, tentativaId: string): Promise<ResultadoDaConclusao> {
  const [tentativa] = await c.tx.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.id, tentativaId));
  if (!tentativa || tentativa.usuarioId !== usuarioId) throw naoEncontrado("Tentativa não encontrada");
  const [versao] = await c.tx.select({ fases: treinamentoServicoVersao.fases }).from(treinamentoServicoVersao).where(eq(treinamentoServicoVersao.id, tentativa.versaoId));
  const totalFases = ((versao?.fases as unknown[]) ?? []).length;

  if (tentativa.concluidaEm) return { fasesCertas: tentativa.fasesCertas, totalFases, pontuada: tentativa.pontuada, ganhos: [] };

  const [linhaDaContagem] = await c.tx
    .select({ fasesCertas: sql<number>`count(*) filter (where ${treinamentoServicoResposta.certa})::int` })
    .from(treinamentoServicoResposta)
    .where(eq(treinamentoServicoResposta.tentativaId, tentativaId));
  const fasesCertas = linhaDaContagem?.fasesCertas ?? 0;

  let pontuada = false;
  if (!tentativa.preVisualizacao) {
    const [jaPontuada] = await c.tx
      .select({ id: treinamentoServicoTentativa.id })
      .from(treinamentoServicoTentativa)
      .where(and(eq(treinamentoServicoTentativa.usuarioId, usuarioId), eq(treinamentoServicoTentativa.treinamentoId, tentativa.treinamentoId), eq(treinamentoServicoTentativa.pontuada, true)))
      .limit(1);
    pontuada = !jaPontuada;
  }
  await c.tx.update(treinamentoServicoTentativa).set({ concluidaEm: c.agora, fasesCertas, pontuada }).where(eq(treinamentoServicoTentativa.id, tentativaId));
  const ganhos = pontuada ? await pontuarTreinamentoServico(c, usuarioId, tentativa.treinamentoId, fasesCertas, c.agora) : [];
  return { fasesCertas, totalFases, pontuada, ganhos };
}

/** "Reportar problema": vale para o treinamento publicado que a pessoa está jogando. */
export async function reportarProblema(db: Db, usuarioId: string, atividadeCodigo: string, dados: { fase: number | null; texto: string }) {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  const publicada = treinamento && (await versaoPublicadaDoTreinamento(db, treinamento.id));
  if (!treinamento || !publicada) throw naoEncontrado("Treinamento não publicado");
  if (dados.fase !== null && (dados.fase < 0 || dados.fase >= fasesDe(publicada).length)) throw invalido("fase_invalida", "Fase inexistente nesta versão");
  const [reporte] = await db.insert(treinamentoServicoReporte).values({ versaoId: publicada.id, fase: dados.fase, usuarioId, texto: dados.texto }).returning();
  return reporte!;
}

// ---- Editor e publicação (admin) ---------------------------------------------------------------------------------

export interface RascunhoDoEditor {
  treinamentoId: string;
  versaoId: string;
  versao: number;
  explicacao: PassoExplicacao[];
  fases: FaseEntrada[];
  cenarioPath: string | null;
  temPublicada: boolean;
  /** O texto do procedimento que o admin colou para a IA (nulo se o rascunho foi feito só à mão). */
  textoOrigem: string | null;
  geradoComIa: boolean;
  rodadasIa: number;
  /** As pendências da IA ainda abertas, que impedem publicar (`shared/treinamento-servico/ia.ts`). */
  pendencias: PendenciaAberta[];
}

/**
 * Acha o rascunho do serviço, ou cria um (e o treinamento, se for o primeiro). O código precisa existir no catálogo. Um
 * rascunho novo de um treinamento já publicado parte da versão publicada (editar não começa do zero), com o texto de
 * origem da IA, para os ajustes pelo chat continuarem valendo.
 */
export async function obterOuCriarRascunho(db: Db, atividadeCodigo: string, usuarioId: string): Promise<RascunhoDoEditor> {
  const [servico] = await db.select({ codigo: atividade.codigo }).from(atividade).where(eq(atividade.codigo, atividadeCodigo)).limit(1);
  if (!servico) throw naoEncontrado("Serviço não encontrado no catálogo");

  return db.transaction(async (tx) => {
    let treinamento = await treinamentoDoCodigo(tx, atividadeCodigo);
    if (!treinamento) {
      const [criado] = await tx.insert(treinamentoServico).values({ atividadeCodigo, criadoPor: usuarioId }).onConflictDoNothing().returning();
      treinamento = criado ?? (await treinamentoDoCodigo(tx, atividadeCodigo));
    }
    let rascunho = await rascunhoDoTreinamento(tx, treinamento!.id);
    const publicada = await versaoPublicadaDoTreinamento(tx, treinamento!.id);
    if (!rascunho) {
      const [maior] = await tx
        .select({ max: sql<number>`coalesce(max(${treinamentoServicoVersao.versao}), 0)::int` })
        .from(treinamentoServicoVersao)
        .where(eq(treinamentoServicoVersao.treinamentoId, treinamento!.id));
      const base = publicada
        ? { explicacao: publicada.explicacao, fases: publicada.fases, cenarioPath: publicada.cenarioPath, textoOrigem: publicada.textoOrigem, geradoComIa: publicada.geradoComIa }
        : { explicacao: [], fases: [] };
      const [criada] = await tx
        .insert(treinamentoServicoVersao)
        .values({ treinamentoId: treinamento!.id, versao: (maior?.max ?? 0) + 1, ...base })
        .returning();
      rascunho = criada!;
    }
    return rascunhoParaEditor(treinamento!.id, rascunho, Boolean(publicada));
  });
}

export function rascunhoParaEditor(treinamentoId: string, rascunho: VersaoLinha, temPublicada: boolean): RascunhoDoEditor {
  const explicacao = explicacaoDe(rascunho);
  const fases = fasesDe(rascunho);
  return {
    treinamentoId,
    versaoId: rascunho.id,
    versao: rascunho.versao,
    explicacao,
    fases,
    cenarioPath: rascunho.cenarioPath,
    temPublicada,
    textoOrigem: rascunho.textoOrigem,
    geradoComIa: rascunho.geradoComIa,
    rodadasIa: rascunho.rodadasIa,
    pendencias: pendenciasAbertas({ explicacao, fases }),
  };
}

/** Troca o conteúdo inteiro do rascunho (explicação, fases e o cenário). */
export async function salvarRascunho(db: Db, atividadeCodigo: string, conteudo: ConteudoDoTreinamento & { cenarioPath?: string | null }): Promise<RascunhoDoEditor> {
  validarConteudo(conteudo.explicacao, conteudo.fases);
  await validarFasesContraCatalogo(db, conteudo.fases);
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  if (!treinamento) throw naoEncontrado("Treinamento não encontrado; abra o editor para criá-lo");
  const rascunho = await rascunhoDoTreinamento(db, treinamento.id);
  if (!rascunho) throw naoEncontrado("Não há rascunho para este treinamento");
  const publicada = await versaoPublicadaDoTreinamento(db, treinamento.id);

  const [salvo] = await db
    .update(treinamentoServicoVersao)
    .set({ explicacao: conteudo.explicacao, fases: conteudo.fases, ...(conteudo.cenarioPath !== undefined && { cenarioPath: conteudo.cenarioPath }) })
    .where(eq(treinamentoServicoVersao.id, rascunho.id))
    .returning();
  return rascunhoParaEditor(treinamento.id, salvo!, Boolean(publicada));
}

export interface VersaoAnterior {
  versaoId: string;
  versao: number;
  estado: string;
  publicadaEm: Date | null;
  publicadaPorNome: string | null;
  totalFases: number;
  totalPassos: number;
}

export async function versoesAnteriores(db: Db, atividadeCodigo: string): Promise<VersaoAnterior[]> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  if (!treinamento) return [];
  const linhas = await db
    .select({
      id: treinamentoServicoVersao.id,
      versao: treinamentoServicoVersao.versao,
      estado: treinamentoServicoVersao.estado,
      publicadaEm: treinamentoServicoVersao.publicadaEm,
      publicadaPorNome: usuario.nome,
      explicacao: treinamentoServicoVersao.explicacao,
      fases: treinamentoServicoVersao.fases,
    })
    .from(treinamentoServicoVersao)
    .leftJoin(usuario, eq(usuario.id, treinamentoServicoVersao.publicadaPor))
    .where(eq(treinamentoServicoVersao.treinamentoId, treinamento.id))
    .orderBy(desc(treinamentoServicoVersao.versao));
  return linhas.map((l) => ({
    versaoId: l.id,
    versao: l.versao,
    estado: l.estado,
    publicadaEm: l.publicadaEm,
    publicadaPorNome: l.publicadaPorNome,
    totalFases: ((l.fases as unknown[]) ?? []).length,
    totalPassos: ((l.explicacao as unknown[]) ?? []).length,
  }));
}

export interface PublicarResultado {
  versaoId: string;
  versao: number;
  publicadaEm: Date;
  /** Para a auditoria (seção 3.7 do `vitoria.md`): se o rascunho veio da IA e o texto de origem. */
  geradoComIa: boolean;
  textoOrigem: string | null;
}

/** Publica o rascunho: termo + assinatura (já enviada por `PUT /arquivos/{id}`, tipo `assinatura`), no padrão de `PUT /me/assinatura`. */
export async function publicarVersao(db: Db, atividadeCodigo: string, usuarioId: string, assinaturaPath: string, agora: Date): Promise<PublicarResultado> {
  const [servico] = await db.select({ codigo: atividade.codigo, descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, atividadeCodigo)).limit(1);
  if (!servico) throw naoEncontrado("Serviço não encontrado no catálogo");
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  if (!treinamento) throw naoEncontrado("Treinamento não encontrado");
  const rascunho = await rascunhoDoTreinamento(db, treinamento.id);
  if (!rascunho) throw naoEncontrado("Não há rascunho para publicar");

  const explicacao = explicacaoDe(rascunho);
  const fases = fasesDe(rascunho);
  validarConteudo(explicacao, fases);
  validarPublicavel(explicacao, fases);
  validarSemPendencias(explicacao, fases);
  await validarFasesContraCatalogo(db, fases);

  return db.transaction(async (tx) => {
    await tx
      .update(treinamentoServicoVersao)
      .set({ estado: "substituida" })
      .where(and(eq(treinamentoServicoVersao.treinamentoId, treinamento.id), eq(treinamentoServicoVersao.estado, "publicada")));
    const [publicada] = await tx
      .update(treinamentoServicoVersao)
      .set({ estado: "publicada", publicadaEm: agora, publicadaPor: usuarioId, assinaturaPath, termo: TERMO_TREINAMENTO(servico.codigo, servico.descricao) })
      .where(eq(treinamentoServicoVersao.id, rascunho.id))
      .returning({ id: treinamentoServicoVersao.id, versao: treinamentoServicoVersao.versao, publicadaEm: treinamentoServicoVersao.publicadaEm });
    return { versaoId: publicada!.id, versao: publicada!.versao, publicadaEm: publicada!.publicadaEm!, geradoComIa: rascunho.geradoComIa, textoOrigem: rascunho.textoOrigem };
  });
}

// ---- Reportes (admin) -----------------------------------------------------------------------------------------------

export interface ReporteDaLista {
  id: string;
  atividadeCodigo: string;
  descricao: string;
  versao: number;
  fase: number | null;
  usuarioNome: string;
  texto: string;
  criadoEm: Date;
  tratadoEm: Date | null;
  tratadoPorNome: string | null;
}

export async function listarReportes(db: Db, filtros: { tratado?: boolean; limit: number; offset: number }) {
  const onde = filtros.tratado === undefined ? undefined : filtros.tratado ? sql`${treinamentoServicoReporte.tratadoEm} is not null` : sql`${treinamentoServicoReporte.tratadoEm} is null`;
  const base = db
    .select({
      id: treinamentoServicoReporte.id,
      atividadeCodigo: treinamentoServico.atividadeCodigo,
      descricao: atividade.descricao,
      versao: treinamentoServicoVersao.versao,
      fase: treinamentoServicoReporte.fase,
      usuarioNome: usuario.nome,
      texto: treinamentoServicoReporte.texto,
      criadoEm: treinamentoServicoReporte.criadoEm,
      tratadoEm: treinamentoServicoReporte.tratadoEm,
    })
    .from(treinamentoServicoReporte)
    .innerJoin(treinamentoServicoVersao, eq(treinamentoServicoVersao.id, treinamentoServicoReporte.versaoId))
    .innerJoin(treinamentoServico, eq(treinamentoServico.id, treinamentoServicoVersao.treinamentoId))
    .innerJoin(atividade, eq(atividade.codigo, treinamentoServico.atividadeCodigo))
    .innerJoin(usuario, eq(usuario.id, treinamentoServicoReporte.usuarioId));
  const [linhas, total] = await Promise.all([
    base
      .where(onde)
      .orderBy(desc(treinamentoServicoReporte.criadoEm))
      .limit(filtros.limit)
      .offset(filtros.offset),
    contar(db, treinamentoServicoReporte, onde),
  ]);
  return { reportes: linhas, total };
}

export async function marcarReporteTratado(db: Db, id: string, usuarioId: string, agora: Date) {
  const [atual] = await db.select({ id: treinamentoServicoReporte.id, tratadoEm: treinamentoServicoReporte.tratadoEm }).from(treinamentoServicoReporte).where(eq(treinamentoServicoReporte.id, id));
  if (!atual) throw naoEncontrado("Reporte não encontrado");
  const [salvo] = await db
    .update(treinamentoServicoReporte)
    .set({ tratadoEm: agora, tratadoPor: usuarioId })
    .where(eq(treinamentoServicoReporte.id, id))
    .returning();
  return salvo!;
}

// ---- Avisos -------------------------------------------------------------------------------------------------------

/** A descrição do serviço no catálogo, para as frases dos avisos ("8.7.1 · Inspeção de ERP"). */
async function nomeDoServico(db: Db, atividadeCodigo: string): Promise<string> {
  const [a] = await db.select({ descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, atividadeCodigo));
  return a ? `${atividadeCodigo} · ${a.descricao}` : atividadeCodigo;
}

/**
 * A primeira publicação do treinamento de um serviço avisa os técnicos (inclusive os que aguardam a liberação, que também jogam):
 * no sino e, para quem não desligou, por e-mail. As versões seguintes não avisam de novo.
 */
export async function avisarTreinamentoPublicado(db: Db, atividadeCodigo: string, agora: Date): Promise<void> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  if (!treinamento) return;
  const tecnicos = await db
    .select({ id: usuario.id })
    .from(usuario)
    .where(and(eq(usuario.perfil, "tecnico"), eq(usuario.ativo, true), inArray(usuario.liberacao, ["liberado", "pendente"])));
  const servico = await nomeDoServico(db, atividadeCodigo);
  await criarAviso(
    db,
    tecnicos.map((t) => t.id),
    { tipo: "treinamento_publicado", treinamentoId: treinamento.id, detalhe: `Novo treinamento de serviço: ${servico}. A Vitória explica o serviço e depois vem o jogo, que vale pontos.`, agora },
  );
}

/** O técnico reportou um problema num treinamento: os administradores ficam sabendo, com o texto e a fase. */
export async function avisarProblemaReportado(db: Db, atividadeCodigo: string, dados: { quem: string; fase: number | null; texto: string }, agora: Date): Promise<void> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  if (!treinamento) return;
  const servico = await nomeDoServico(db, atividadeCodigo);
  const onde = dados.fase === null ? "no treinamento" : `na fase ${dados.fase + 1} do treinamento`;
  await avisarAdmins(db, { tipo: "treinamento_problema", treinamentoId: treinamento.id, detalhe: `${dados.quem} reportou um problema ${onde} de ${servico}: "${dados.texto.trim()}"`, agora });
}
