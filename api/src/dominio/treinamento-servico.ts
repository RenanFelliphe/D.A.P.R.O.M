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
  treinamentoServicoValidador,
  treinamentoServicoVersao,
  equipe,
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
  esquemaRespostaGrade,
  esquemaRespostaLetras,
  esquemaRespostaMarcadas,
  esquemaRespostaMemoria,
  esquemaRespostaPalpites,
  esquemaRespostaPares,
  esquemaRespostaSequencia,
  esquemaRespostaVerdadeiroFalso,
  validarConteudo,
  validarFasesContraCatalogo,
  validarPublicavel,
  validarSemPendencias,
  type ConteudoDoTreinamento,
  type FaseEntrada,
  type PassoExplicacao,
} from "./treinamento-servico-esquema";
import {
  embaralhar,
  embaralharLetras,
  permutacaoDesordenada,
  sortearIndice,
  mesaDaMemoria,
  montarGrade,
  palavrasAchadas,
  permutacao,
  refazerMemoria,
  type CartaNaMesa,
  type PosicaoNaGrade,
} from "./treinamento-servico-jogos";
import { multiplicadorDoTempo, notaDoTreinamento, notaMaxima, pontosDaFase, type TipoDoJogo } from "../../../shared/treinamento-servico/nota";
import { chaveDaPalavra, codificarTermo, letrasDaGrade, letrasDaPalavra, tentativasDoTermo } from "../../../shared/treinamento-servico/jogos";

/**
 * Domínio dos treinamentos de serviço (seção 8 do `docs/gamificacao-e-treinamentos.md`). Segue o espírito de `modelo-apr-banco.ts`
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

interface ApItemComOrdem {
  tipo: "quiz" | "decisao" | "ordem";
  ordem: number[];
}
/** Selecione: com opções escritas, a ordem embaralhada; com os materiais do serviço, os itens sorteados já com nome. */
interface ApSelecione {
  tipo: "selecione";
  ordem?: number[];
  itens?: { materialId: string; descricao: string }[];
}
interface ApVerdadeiroFalso {
  tipo: "verdadeiro_falso";
}
/** Termo e Desembaralhe: qual palavra do banco foi sorteada nesta tentativa (e, no Desembaralhe, a ordem das letras). */
interface ApTermo {
  tipo: "termo";
  sorteada: number;
}
interface ApDesembaralhe {
  tipo: "desembaralhe";
  sorteada: number;
  ordem: number[];
}
interface ApCacaPalavras {
  tipo: "caca_palavras";
  linhas: string[];
  posicoes: PosicaoNaGrade[];
}
interface ApMemoria {
  tipo: "memoria";
  cartas: CartaNaMesa[];
}
interface ApLigar {
  tipo: "ligar";
  esquerdaOrdem: number[];
  direitaOrdem: number[];
}
type ApresentacaoFase = ApItemComOrdem | ApSelecione | ApLigar | ApVerdadeiroFalso | ApCacaPalavras | ApMemoria | ApTermo | ApDesembaralhe;
interface Apresentacao {
  fases: ApresentacaoFase[];
}

/** Materiais ativos de outros serviços, para misturar no Selecione com os materiais do serviço; nunca os já certos desta fase. */
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

/**
 * Gera a apresentação (embaralhamento) e o que o jogador vê de cada fase, nunca o gabarito. Roda a cada tentativa aberta
 * (cada "Começar o jogo", "Jogar de novo" ou recarga da página), então toda fase com opções vem numa ordem nova: as opções,
 * os itens, os pares, as etapas, as cartas, a grade e as letras, e a palavra sorteada do banco no Termo e no Desembaralhe.
 */
async function montarApresentacao(db: Db, atividadeCodigo: string, fases: FaseEntrada[]) {
  const apFases: ApresentacaoFase[] = [];
  const paraJogar: Record<string, unknown>[] = [];

  for (let indice = 0; indice < fases.length; indice++) {
    const fase = fases[indice]!;
    if (fase.tipo === "quiz") {
      const ordem = permutacaoDesordenada(fase.opcoes.length);
      apFases.push({ tipo: "quiz", ordem });
      paraJogar.push({ indice, tipo: "quiz", enunciado: fase.enunciado, opcoes: ordem.map((i) => fase.opcoes[i]) });
    } else if (fase.tipo === "decisao") {
      const ordem = permutacaoDesordenada(fase.opcoes.length);
      apFases.push({ tipo: "decisao", ordem });
      paraJogar.push({ indice, tipo: "decisao", situacao: fase.situacao, opcoes: ordem.map((i) => fase.opcoes[i]!.texto) });
    } else if (fase.tipo === "ligar") {
      const n = fase.pares.length;
      const esquerdaOrdem = permutacaoDesordenada(n);
      const direitaOrdem = permutacaoDesordenada(n, esquerdaOrdem);
      apFases.push({ tipo: "ligar", esquerdaOrdem, direitaOrdem });
      paraJogar.push({ indice, tipo: "ligar", esquerda: esquerdaOrdem.map((i) => fase.pares[i]!.esquerda), direita: direitaOrdem.map((i) => fase.pares[i]!.direita) });
    } else if (fase.tipo === "ordem") {
      // Nunca começa já na ordem certa: seria a resposta pronta.
      const ordem = permutacaoDesordenada(fase.etapas.length);
      apFases.push({ tipo: "ordem", ordem });
      paraJogar.push({ indice, tipo: "ordem", enunciado: fase.enunciado, etapas: ordem.map((i) => fase.etapas[i]) });
    } else if (fase.tipo === "verdadeiro_falso") {
      apFases.push({ tipo: "verdadeiro_falso" });
      paraJogar.push({ indice, tipo: "verdadeiro_falso", afirmacao: fase.afirmacao });
    } else if (fase.tipo === "caca_palavras") {
      const { linhas, posicoes } = montarGrade(fase.palavras.map((p) => p.palavra));
      apFases.push({ tipo: "caca_palavras", linhas, posicoes });
      // No modo de pistas a palavra não vai: só a pista, o tamanho e a impressão (para o jogo reconhecer o trecho marcado).
      const palavras = fase.palavras.map((p) => ({
        palavra: fase.modo === "palavras" ? p.palavra : null,
        pista: p.pista?.trim() || null,
        letras: letrasDaGrade(p.palavra).length,
        chave: chaveDaPalavra(p.palavra),
      }));
      paraJogar.push({ indice, tipo: "caca_palavras", enunciado: fase.enunciado, modo: fase.modo, grade: linhas, palavras });
    } else if (fase.tipo === "memoria") {
      const cartas = mesaDaMemoria(fase.pares.length);
      // O grupo de cada carta é um número sorteado por par, não o índice do par no gabarito.
      const grupos = permutacao(fase.pares.length);
      apFases.push({ tipo: "memoria", cartas });
      paraJogar.push({
        indice,
        tipo: "memoria",
        cartas: cartas.map((c) => ({ texto: c.lado === 0 ? fase.pares[c.par]!.termo : fase.pares[c.par]!.correspondente, grupo: grupos[c.par], lado: c.lado })),
      });
    } else if (fase.tipo === "termo") {
      const sorteada = sortearIndice(fase.palavras.length);
      const { palavra, dica } = fase.palavras[sorteada]!;
      const letras = letrasDaGrade(palavra).length;
      apFases.push({ tipo: "termo", sorteada });
      paraJogar.push({ indice, tipo: "termo", dica: dica?.trim() || null, letras, tentativas: tentativasDoTermo(letras), codigo: codificarTermo(palavra) });
    } else if (fase.tipo === "selecione" && fase.materiais) {
      // Montado com os materiais do serviço: os certos e, misturados, itens de outros serviços sorteados agora.
      const { material_ids, quantidade_errados } = fase.materiais;
      const certos = await db.select({ id: material.id, descricao: material.descricao }).from(material).where(inArray(material.id, material_ids));
      const errados = await sortearItensErrados(db, atividadeCodigo, material_ids, quantidade_errados);
      const itens = embaralhar([...certos, ...errados]).map((m) => ({ materialId: m.id, descricao: m.descricao }));
      apFases.push({ tipo: "selecione", itens });
      paraJogar.push({ indice, tipo: "selecione", enunciado: fase.enunciado, opcoes: itens.map((i) => i.descricao) });
    } else if (fase.tipo === "selecione") {
      const ordem = permutacaoDesordenada(fase.opcoes.length);
      apFases.push({ tipo: "selecione", ordem });
      paraJogar.push({ indice, tipo: "selecione", enunciado: fase.enunciado, opcoes: ordem.map((i) => fase.opcoes[i]!.texto) });
    } else {
      const sorteada = sortearIndice(fase.palavras.length);
      const { palavra, dica } = fase.palavras[sorteada]!;
      const letras = letrasDaPalavra(palavra);
      const ordem = embaralharLetras(letras);
      apFases.push({ tipo: "desembaralhe", sorteada, ordem });
      paraJogar.push({ indice, tipo: "desembaralhe", enunciado: dica, letras: ordem.map((i) => letras[i]) });
    }
  }
  return { apresentacao: { fases: apFases } satisfies Apresentacao, paraJogar };
}

export interface TentativaAberta {
  tentativaId: string;
  totalFases: number;
  fases: Record<string, unknown>[];
}

async function criarTentativa(db: Db, args: { treinamentoId: string; versaoId: string; atividadeCodigo: string; fases: FaseEntrada[]; usuarioId: string; preVisualizacao: boolean; agora: Date }): Promise<TentativaAberta> {
  const { apresentacao, paraJogar } = await montarApresentacao(db, args.atividadeCodigo, args.fases);
  const [tentativa] = await db
    .insert(treinamentoServicoTentativa)
    .values({ treinamentoId: args.treinamentoId, versaoId: args.versaoId, usuarioId: args.usuarioId, apresentacao, preVisualizacao: args.preVisualizacao, tempos: cronometroNovo(args.agora) })
    .returning({ id: treinamentoServicoTentativa.id });
  return { tentativaId: tentativa!.id, totalFases: args.fases.length, fases: paraJogar };
}

/** Abre uma tentativa na versão publicada (quem treina, inclusive pendente). */
export async function abrirTentativa(db: Db, usuarioId: string, atividadeCodigo: string, agora: Date): Promise<TentativaAberta> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  const publicada = treinamento && (await versaoPublicadaDoTreinamento(db, treinamento.id));
  if (!treinamento || !publicada) throw naoEncontrado("Treinamento não publicado");
  return criarTentativa(db, { treinamentoId: treinamento.id, versaoId: publicada.id, atividadeCodigo, fases: fasesDe(publicada), usuarioId, preVisualizacao: false, agora });
}

/** Pré-visualização do rascunho pelo admin: o mesmo motor do jogo, mas a tentativa nunca pontua. */
export async function abrirPreVisualizacao(db: Db, usuarioId: string, atividadeCodigo: string, agora: Date): Promise<TentativaAberta> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  const rascunho = treinamento && (await rascunhoDoTreinamento(db, treinamento.id));
  if (!treinamento || !rascunho) throw naoEncontrado("Rascunho não encontrado");
  const fases = fasesDe(rascunho);
  if (fases.length === 0) throw invalido("sem_fases", "O rascunho ainda não tem fases para pré-visualizar");
  return criarTentativa(db, { treinamentoId: treinamento.id, versaoId: rascunho.id, atividadeCodigo, fases, usuarioId, preVisualizacao: true, agora });
}

// ---- Corrigir cada fase (o gabarito nunca sai daqui antes da resposta) -----------------------------------------------

export interface ResultadoDaResposta {
  certa: boolean;
  explicacao: string;
  gabarito: Record<string, unknown>;
  /** Os acertos e as respostas certas possíveis (a base da fase: 10 × acertos ÷ possíveis). */
  acertos: number;
  possiveis: number;
  /** A fração da base quando ela não é acertos ÷ possíveis: no Termo, 1 ÷ a tentativa em que acertou (a fase continua 1 de 1). */
  fracao?: number;
}

/** A correção de uma fase com o tempo e os pontos dela (o que a rota devolve e o resultado mostra). */
export interface ResultadoDaFase extends ResultadoDaResposta {
  tempoMs: number;
  multiplicador: number;
  pontos: number;
}

/**
 * Corrige uma fase. Aceita também a resposta pela metade (o progresso de uma fase não confirmada, corrigido ao finalizar):
 * os acertos contam o que já está certo, e a fase só é "certa" com todos eles (seção 8.7 do `docs/gamificacao-e-treinamentos.md`).
 */
function corrigirFase(fase: FaseEntrada, ap: ApresentacaoFase, respostaBruta: unknown): ResultadoDaResposta {
  const tudoOuNada = (certa: boolean, gabarito: Record<string, unknown>): ResultadoDaResposta => ({ certa, explicacao: fase.explicacao, gabarito, acertos: certa ? 1 : 0, possiveis: 1 });
  const proporcional = (acertos: number, possiveis: number, gabarito: Record<string, unknown>): ResultadoDaResposta => ({
    certa: possiveis > 0 && acertos === possiveis,
    explicacao: fase.explicacao,
    gabarito,
    acertos: Math.max(0, Math.min(acertos, possiveis)),
    possiveis,
  });

  if (fase.tipo === "quiz" || fase.tipo === "decisao") {
    if (ap.tipo !== fase.tipo) throw incompativel();
    const { escolha } = validar(esquemaRespostaEscolha, respostaBruta);
    if (escolha >= ap.ordem.length) throw invalido("resposta_invalida", "escolha fora do intervalo das opções mostradas");
    const original = ap.ordem[escolha]!;
    const opcaoCorretaMostrada = ap.ordem.indexOf(fase.correta);
    if (fase.tipo === "quiz") return tudoOuNada(original === fase.correta, { opcao_correta: opcaoCorretaMostrada });
    return tudoOuNada(original === fase.correta, {
      opcao_correta: opcaoCorretaMostrada,
      consequencia_escolhida: fase.opcoes[original]!.consequencia,
      consequencia_correta: fase.opcoes[fase.correta]!.consequencia,
    });
  }
  if (fase.tipo === "ligar") {
    if (ap.tipo !== "ligar") throw incompativel();
    const { pares } = validar(esquemaRespostaPares, respostaBruta);
    if (pares.some((p) => p.esquerda >= ap.esquerdaOrdem.length || p.direita >= ap.direitaOrdem.length)) throw invalido("resposta_invalida", "par fora do intervalo mostrado");
    // Cada item da esquerda e da direita conta uma vez só (vale o primeiro par em que aparece).
    const usadosE = new Set<number>();
    const usadosD = new Set<number>();
    let acertos = 0;
    for (const p of pares) {
      if (usadosE.has(p.esquerda) || usadosD.has(p.direita)) continue;
      usadosE.add(p.esquerda);
      usadosD.add(p.direita);
      if (ap.esquerdaOrdem[p.esquerda] === ap.direitaOrdem[p.direita]) acertos++;
    }
    return proporcional(acertos, fase.pares.length, { pares: fase.pares });
  }
  if (fase.tipo === "ordem") {
    if (ap.tipo !== "ordem") throw incompativel();
    const { sequencia } = validar(esquemaRespostaSequencia, respostaBruta);
    if (sequencia.some((p) => p >= ap.ordem.length) || new Set(sequencia).size !== sequencia.length) throw invalido("resposta_invalida", "posição fora do intervalo mostrado ou repetida");
    // Uma etapa conta quando está na posição certa.
    const acertos = sequencia.filter((pos, i) => ap.ordem[pos] === i).length;
    return proporcional(acertos, fase.etapas.length, { etapas: fase.etapas });
  }
  if (fase.tipo === "verdadeiro_falso") {
    if (ap.tipo !== "verdadeiro_falso") throw incompativel();
    const { verdadeira } = validar(esquemaRespostaVerdadeiroFalso, respostaBruta);
    return tudoOuNada(verdadeira === fase.verdadeira, { verdadeira: fase.verdadeira });
  }
  if (fase.tipo === "caca_palavras") {
    if (ap.tipo !== "caca_palavras") throw incompativel();
    const { selecoes } = validar(esquemaRespostaGrade, respostaBruta);
    const achadas = palavrasAchadas(ap.linhas, fase.palavras.map((p) => p.palavra), selecoes);
    const palavras = fase.palavras.map((p, i) => ({ palavra: p.palavra, inicio: ap.posicoes[i]!.inicio, fim: ap.posicoes[i]!.fim, achada: achadas.has(i) }));
    return proporcional(achadas.size, fase.palavras.length, { palavras });
  }
  if (fase.tipo === "memoria") {
    if (ap.tipo !== "memoria") throw incompativel();
    const { jogadas } = validar(esquemaRespostaMemoria, respostaBruta);
    const partida = refazerMemoria(ap.cartas, jogadas);
    if (!partida.valida) throw invalido("resposta_invalida", "jogada com carta inexistente ou já formada");
    // Sem limite de tentativas nem de erros: cada par formado conta, e a fase só é certa com todos os pares.
    return proporcional(partida.formados, fase.pares.length, { erros: partida.erros, completa: partida.completa, pares_memoria: fase.pares });
  }
  if (fase.tipo === "termo") {
    if (ap.tipo !== "termo") throw incompativel();
    const { palpites } = validar(esquemaRespostaPalpites, respostaBruta);
    const palavra = fase.palavras[ap.sorteada]?.palavra;
    if (!palavra) throw incompativel();
    const segredo = letrasDaGrade(palavra);
    const lidos = palpites.map(letrasDaGrade);
    if (lidos.length > tentativasDoTermo(segredo.length)) throw invalido("resposta_invalida", "palpites além do limite de tentativas");
    if (lidos.some((p) => p.length !== segredo.length)) throw invalido("resposta_invalida", `cada palpite precisa ter ${segredo.length} letras`);
    const acerto = lidos.indexOf(segredo);
    // Vale 10 ÷ a tentativa em que acertou: na 1ª, 10; na 5ª, 2. Quem não acerta, zero.
    return { ...tudoOuNada(acerto >= 0, { palavra, tentativa_do_acerto: acerto >= 0 ? acerto + 1 : null }), ...(acerto >= 0 && { fracao: 1 / (acerto + 1) }) };
  }
  if (fase.tipo === "selecione") {
    if (ap.tipo !== "selecione") throw incompativel();
    const { marcadas } = validar(esquemaRespostaMarcadas, respostaBruta);
    // A posição mostrada de cada opção certa: pelos materiais certos, ou pela marca de certa da opção escrita.
    const certosDoCatalogo = new Set(fase.materiais?.material_ids ?? []);
    const corretas = fase.materiais
      ? (ap.itens ?? []).flatMap((item, mostrada) => (certosDoCatalogo.has(item.materialId) ? [mostrada] : []))
      : (ap.ordem ?? []).flatMap((original, mostrada) => (fase.opcoes[original]!.correta ? [mostrada] : []));
    const mostradas = fase.materiais ? (ap.itens ?? []).length : (ap.ordem ?? []).length;
    if (marcadas.some((p) => p >= mostradas)) throw invalido("resposta_invalida", "opção fora do intervalo mostrado");
    // Cada certa marcada conta; cada errada marcada anula um acerto (senão marcar tudo daria a nota cheia).
    const escolhidas = new Set(marcadas);
    const certasMarcadas = corretas.filter((i) => escolhidas.has(i)).length;
    return proporcional(certasMarcadas - (escolhidas.size - certasMarcadas), corretas.length, { corretas });
  }
  // desembaralhe
  if (ap.tipo !== "desembaralhe") throw incompativel();
  const { letras } = validar(esquemaRespostaLetras, respostaBruta);
  const sorteada = fase.palavras[ap.sorteada]?.palavra;
  if (!sorteada) throw incompativel();
  const pecas = letrasDaPalavra(sorteada);
  if (letras.length > pecas.length || new Set(letras).size !== letras.length || letras.some((p) => p >= ap.ordem.length)) {
    throw invalido("resposta_invalida", "use cada letra uma vez");
  }
  // Não existe meia palavra: vale a palavra inteira, ou nada.
  const formou = letras.length === pecas.length && letras.every((pos, i) => pecas[ap.ordem[pos]!] === pecas[i]);
  return tudoOuNada(formou, { palavra: pecas.join("") });
}

const incompativel = () => invalido("resposta_invalida", "Fase incompatível com a apresentação gravada");

// ---- O cronômetro de cada fase ----------------------------------------------------------------------------------------

/**
 * O cronômetro guardado na tentativa (`tempos`): os milissegundos de cada fase, a fase em que a pessoa está e desde quando,
 * e o instante do último evento. Fase já respondida não acumula mais tempo.
 */
interface Cronometro {
  fases: Record<string, number>;
  atual: { fase: number; desde: string } | null;
  ultimo: string;
}

const cronometroNovo = (agora: Date): Cronometro => ({ fases: {}, atual: null, ultimo: agora.toISOString() });

function lerCronometro(tentativa: TentativaLinha): Cronometro {
  const t = tentativa.tempos as Partial<Cronometro>;
  return { fases: { ...(t.fases ?? {}) }, atual: t.atual ?? null, ultimo: t.ultimo ?? tentativa.iniciadaEm.toISOString() };
}

/**
 * Um evento numa fase (`entrar`, `progresso` ou `responder`) ou o fim da tentativa (`fase` nula). O tempo desde o evento
 * anterior vai para a fase em que a pessoa estava; se ela não avisou que entrou nesta (`entrar`), o tempo vai para esta:
 * assim pular o aviso não zera o cronômetro. Depois do evento, a pessoa fica nesta fase.
 */
function marcarEvento(c: Cronometro, fase: number | null, tipo: "entrar" | "progresso" | "responder" | "concluir", agora: Date, respondidas: Set<number>): Cronometro {
  const t = agora.getTime();
  const desde = Date.parse(c.atual?.desde ?? c.ultimo);
  const passou = Math.max(0, t - (Number.isNaN(desde) ? t : desde));
  const fases = { ...c.fases };
  const creditar = (f: number) => {
    if (!respondidas.has(f)) fases[f] = (fases[f] ?? 0) + passou;
  };
  if (c.atual && (c.atual.fase === fase || !respondidas.has(c.atual.fase))) creditar(c.atual.fase);
  else if (fase !== null && tipo !== "entrar") creditar(fase);
  return { fases, atual: fase === null ? null : { fase, desde: agora.toISOString() }, ultimo: agora.toISOString() };
}

const tempoDaFase = (c: Cronometro, fase: number) => Math.round(c.fases[fase] ?? 0);

interface ContextoDaTentativa {
  tentativa: TentativaLinha;
  fases: FaseEntrada[];
  apresentacao: Apresentacao;
  respostas: (typeof treinamentoServicoResposta.$inferSelect)[];
}

/** A tentativa travada para atualizar (`for update`), a versão e as respostas já gravadas; só a dona mexe. */
async function tentativaParaMexer(tx: Db, usuarioId: string, tentativaId: string): Promise<ContextoDaTentativa> {
  const [tentativa] = await tx.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.id, tentativaId)).for("update");
  if (!tentativa || tentativa.usuarioId !== usuarioId) throw naoEncontrado("Tentativa não encontrada");
  const [versao] = await tx.select().from(treinamentoServicoVersao).where(eq(treinamentoServicoVersao.id, tentativa.versaoId));
  const respostas = await tx.select().from(treinamentoServicoResposta).where(eq(treinamentoServicoResposta.tentativaId, tentativaId));
  return { tentativa, fases: fasesDe(versao!), apresentacao: tentativa.apresentacao as Apresentacao, respostas };
}

const respondidasDe = (ctx: ContextoDaTentativa) => new Set(ctx.respostas.map((r) => r.fase));

function faseDaTentativa(ctx: ContextoDaTentativa, indice: number) {
  const fase = ctx.fases[indice];
  const ap = ctx.apresentacao.fases[indice];
  if (!fase || !ap) throw naoEncontrado("Fase não encontrada");
  return { fase, ap };
}

/** Entrar numa fase (ao abrir, voltar ou avançar): o cronômetro da fase anterior pausa e o desta continua de onde parou. */
export async function entrarNaFase(db: Db, usuarioId: string, tentativaId: string, indice: number, agora: Date): Promise<{ tempoMs: number }> {
  return db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const ctx = await tentativaParaMexer(tx, usuarioId, tentativaId);
    if (ctx.tentativa.concluidaEm) throw conflito("tentativa_concluida", "Esta tentativa já foi concluída");
    faseDaTentativa(ctx, indice);
    const cronometro = marcarEvento(lerCronometro(ctx.tentativa), indice, "entrar", agora, respondidasDe(ctx));
    await tx.update(treinamentoServicoTentativa).set({ tempos: cronometro }).where(eq(treinamentoServicoTentativa.id, tentativaId));
    return { tempoMs: tempoDaFase(cronometro, indice) };
  });
}

/** Guarda a resposta em andamento de uma fase não confirmada: se a pessoa finalizar sem confirmar, vale o que já fez nela. */
export async function guardarProgresso(db: Db, usuarioId: string, tentativaId: string, indice: number, resposta: unknown, agora: Date): Promise<void> {
  if (JSON.stringify(resposta ?? null).length > 20_000) throw invalido("resposta_invalida", "progresso grande demais");
  await db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const ctx = await tentativaParaMexer(tx, usuarioId, tentativaId);
    if (ctx.tentativa.concluidaEm) throw conflito("tentativa_concluida", "Esta tentativa já foi concluída");
    faseDaTentativa(ctx, indice);
    const respondidas = respondidasDe(ctx);
    const cronometro = marcarEvento(lerCronometro(ctx.tentativa), indice, "progresso", agora, respondidas);
    const progresso = { ...(ctx.tentativa.progresso as Record<string, unknown>) };
    if (!respondidas.has(indice)) progresso[indice] = resposta;
    await tx.update(treinamentoServicoTentativa).set({ tempos: cronometro, progresso }).where(eq(treinamentoServicoTentativa.id, tentativaId));
  });
}

function comPontos(tipo: TipoDoJogo, resultado: ResultadoDaResposta, tempoMs: number): ResultadoDaFase {
  return { ...resultado, tempoMs, multiplicador: multiplicadorDoTempo(tipo, tempoMs), pontos: pontosDaFase(tipo, resultado.acertos, resultado.possiveis, tempoMs, resultado.fracao) };
}

/**
 * Responde uma fase: confere contra o gabarito privado da versão e grava com o tempo e os pontos. A primeira resposta vence:
 * responder de novo (ao voltar à fase) devolve a correção gravada, sem trocar a resposta nem somar pontos.
 */
export async function responderFase(db: Db, usuarioId: string, tentativaId: string, indice: number, respostaBruta: unknown, agora: Date): Promise<ResultadoDaFase> {
  return db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const ctx = await tentativaParaMexer(tx, usuarioId, tentativaId);
    if (ctx.tentativa.concluidaEm) throw conflito("tentativa_concluida", "Esta tentativa já foi concluída");
    const { fase, ap } = faseDaTentativa(ctx, indice);

    const gravada = ctx.respostas.find((r) => r.fase === indice);
    if (gravada) {
      const correcao = corrigirFase(fase, ap, gravada.resposta);
      return { ...correcao, certa: gravada.certa, acertos: gravada.acertos, possiveis: gravada.possiveis, tempoMs: gravada.tempoMs, multiplicador: multiplicadorDoTempo(fase.tipo, gravada.tempoMs), pontos: gravada.pontos };
    }

    const correcao = corrigirFase(fase, ap, respostaBruta);
    const cronometro = marcarEvento(lerCronometro(ctx.tentativa), indice, "responder", agora, respondidasDe(ctx));
    const resultado = comPontos(fase.tipo, correcao, tempoDaFase(cronometro, indice));
    await tx.insert(treinamentoServicoResposta).values({
      tentativaId,
      fase: indice,
      resposta: respostaBruta as object,
      certa: resultado.certa,
      acertos: resultado.acertos,
      possiveis: resultado.possiveis,
      tempoMs: resultado.tempoMs,
      pontos: resultado.pontos,
      confirmada: true,
    });
    await tx.update(treinamentoServicoTentativa).set({ tempos: cronometro }).where(eq(treinamentoServicoTentativa.id, tentativaId));
    return resultado;
  });
}

/** O resultado de uma fase na conclusão (o detalhe do resultado do jogo). */
export interface FaseDaConclusao {
  fase: number;
  acertos: number;
  possiveis: number;
  tempoMs: number;
  multiplicador: number;
  pontos: number;
  /** Falsa quando a pessoa não confirmou: a fase foi corrigida pelo que tinha feito nela (ou vale zero). */
  confirmada: boolean;
}

export interface ResultadoDaConclusao {
  fasesCertas: number;
  totalFases: number;
  pontuada: boolean;
  ganhos: Ganho[];
  nota: number;
  notaMaxima: number;
  /** A melhor nota da pessoa neste treinamento antes desta tentativa (nula na primeira). */
  melhorAnterior: number | null;
  fases: FaseDaConclusao[];
}

const faseDaLinha = (r: typeof treinamentoServicoResposta.$inferSelect, tipo: TipoDoJogo): FaseDaConclusao => ({
  fase: r.fase,
  acertos: r.acertos,
  possiveis: r.possiveis,
  tempoMs: r.tempoMs,
  multiplicador: multiplicadorDoTempo(tipo, r.tempoMs),
  pontos: r.pontos,
  confirmada: r.confirmada,
});

/** A melhor nota já conseguida pela pessoa neste treinamento (tentativas concluídas, fora a pré-visualização e a `exceto`). */
async function melhorNota(tx: Db, usuarioId: string, treinamentoId: string, exceto: string): Promise<number | null> {
  const [linha] = await tx
    .select({ melhor: sql<number | null>`max(${treinamentoServicoTentativa.nota})` })
    .from(treinamentoServicoTentativa)
    .where(
      and(
        eq(treinamentoServicoTentativa.usuarioId, usuarioId),
        eq(treinamentoServicoTentativa.treinamentoId, treinamentoId),
        eq(treinamentoServicoTentativa.preVisualizacao, false),
        ne(treinamentoServicoTentativa.id, exceto),
      ),
    );
  return linha?.melhor ?? null;
}

/**
 * Conclui a tentativa (o "Finalizar"): as fases sem resposta confirmada são corrigidas pelo que a pessoa fez nelas (ou valem
 * zero), a nota é calculada (seção 8.7 do `docs/gamificacao-e-treinamentos.md`) e a gamificação pontua só na primeira conclusão do
 * treinamento (nunca na pré-visualização do admin), como antes. Concluir de novo devolve o mesmo resultado.
 */
export async function concluirTentativa(c: ContextoDePontos, usuarioId: string, tentativaId: string): Promise<ResultadoDaConclusao> {
  const ctx = await tentativaParaMexer(c.tx, usuarioId, tentativaId);
  const { tentativa } = ctx;
  const totalFases = ctx.fases.length;
  const melhorAnterior = tentativa.preVisualizacao ? null : await melhorNota(c.tx, usuarioId, tentativa.treinamentoId, tentativaId);

  if (tentativa.concluidaEm) {
    return {
      fasesCertas: tentativa.fasesCertas,
      totalFases,
      pontuada: tentativa.pontuada,
      ganhos: [],
      nota: tentativa.nota ?? 0,
      notaMaxima: notaMaxima(totalFases),
      melhorAnterior,
      fases: ctx.respostas.map((r) => faseDaLinha(r, ctx.fases[r.fase]!.tipo)).sort((a, b) => a.fase - b.fase),
    };
  }

  const respondidas = respondidasDe(ctx);
  const cronometro = marcarEvento(lerCronometro(tentativa), null, "concluir", c.agora, respondidas);
  const progresso = tentativa.progresso as Record<string, unknown>;
  const novas: (typeof treinamentoServicoResposta.$inferInsert)[] = [];
  for (let indice = 0; indice < totalFases; indice++) {
    if (respondidas.has(indice)) continue;
    const { fase, ap } = faseDaTentativa(ctx, indice);
    const andamento = progresso[indice];
    let correcao: ResultadoDaResposta | null = null;
    if (andamento !== undefined && andamento !== null) {
      try {
        correcao = corrigirFase(fase, ap, andamento);
      } catch {
        correcao = null; // progresso fora do formato: a fase vale zero
      }
    }
    const tempoMs = tempoDaFase(cronometro, indice);
    const acertos = correcao?.acertos ?? 0;
    const possiveis = correcao?.possiveis ?? 1;
    novas.push({
      tentativaId,
      fase: indice,
      resposta: (andamento ?? {}) as object,
      certa: correcao?.certa ?? false,
      acertos,
      possiveis,
      tempoMs,
      pontos: pontosDaFase(fase.tipo, acertos, possiveis, tempoMs, correcao?.fracao),
      confirmada: false,
    });
  }
  if (novas.length > 0) await c.tx.insert(treinamentoServicoResposta).values(novas).onConflictDoNothing();

  const todas = [...ctx.respostas, ...(novas as (typeof treinamentoServicoResposta.$inferSelect)[])].sort((a, b) => a.fase - b.fase);
  const fasesCertas = todas.filter((r) => r.certa).length;
  const nota = notaDoTreinamento(
    todas.map((r) => r.pontos),
    totalFases,
  );

  let pontuada = false;
  if (!tentativa.preVisualizacao) {
    const [jaPontuada] = await c.tx
      .select({ id: treinamentoServicoTentativa.id })
      .from(treinamentoServicoTentativa)
      .where(and(eq(treinamentoServicoTentativa.usuarioId, usuarioId), eq(treinamentoServicoTentativa.treinamentoId, tentativa.treinamentoId), eq(treinamentoServicoTentativa.pontuada, true)))
      .limit(1);
    pontuada = !jaPontuada;
  }
  await c.tx.update(treinamentoServicoTentativa).set({ concluidaEm: c.agora, fasesCertas, pontuada, nota, tempos: cronometro }).where(eq(treinamentoServicoTentativa.id, tentativaId));
  const ganhos = pontuada ? await pontuarTreinamentoServico(c, usuarioId, tentativa.treinamentoId, fasesCertas, c.agora) : [];
  return {
    fasesCertas,
    totalFases,
    pontuada,
    ganhos,
    nota,
    notaMaxima: notaMaxima(totalFases),
    melhorAnterior,
    fases: todas.map((r) => faseDaLinha(r, ctx.fases[r.fase]!.tipo)),
  };
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
  /** Quem montou o rascunho (o admin ou o supervisor do serviço); nulo nas versões de antes da validação pelos supervisores. */
  autorId: string | null;
  /** Enviado para validação: o rascunho está travado até a validação terminar ou o autor retirá-lo. */
  emValidacao: boolean;
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
        .values({ treinamentoId: treinamento!.id, versao: (maior?.max ?? 0) + 1, autorId: usuarioId, ...base })
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
    autorId: rascunho.autorId,
    emValidacao: rascunho.validacaoEnviadaEm !== null,
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
  if (rascunho.validacaoEnviadaEm) throw conflito("em_validacao", "Este treinamento está em validação: retire-o da validação para editar");
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
  /** `validacao`: os supervisores assinaram; `direta`: o admin publicou sem esperar (a exceção, e tudo o que veio antes da validação). `null` no rascunho. */
  via: "validacao" | "direta" | null;
  /** Quem aprovou na validação (a última rodada), com a equipe e quando. */
  assinaturas: { nome: string; equipeNome: string; em: Date }[];
  /** A justificativa do admin na publicação direta. */
  justificativa: string | null;
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
      rodada: treinamentoServicoVersao.rodadaDeValidacao,
      justificativa: treinamentoServicoVersao.publicacaoDiretaJustificativa,
    })
    .from(treinamentoServicoVersao)
    .leftJoin(usuario, eq(usuario.id, treinamentoServicoVersao.publicadaPor))
    .where(eq(treinamentoServicoVersao.treinamentoId, treinamento.id))
    .orderBy(desc(treinamentoServicoVersao.versao));
  const aprovacoes = await db
    .select({ versaoId: treinamentoServicoValidador.versaoId, rodada: treinamentoServicoValidador.rodada, nome: usuario.nome, equipeNome: equipe.nome, em: treinamentoServicoValidador.decididaEm })
    .from(treinamentoServicoValidador)
    .innerJoin(usuario, eq(usuario.id, treinamentoServicoValidador.usuarioId))
    .innerJoin(equipe, eq(equipe.id, treinamentoServicoValidador.equipeId))
    .where(and(inArray(treinamentoServicoValidador.versaoId, linhas.map((l) => l.id)), eq(treinamentoServicoValidador.decisao, "aprovou")))
    .orderBy(asc(treinamentoServicoValidador.decididaEm));
  return linhas.map((l) => {
    const assinaturas = aprovacoes.filter((a) => a.versaoId === l.id && a.rodada === l.rodada).map((a) => ({ nome: a.nome, equipeNome: a.equipeNome, em: a.em! }));
    return {
      versaoId: l.id,
      versao: l.versao,
      estado: l.estado,
      publicadaEm: l.publicadaEm,
      publicadaPorNome: l.publicadaPorNome,
      totalFases: ((l.fases as unknown[]) ?? []).length,
      totalPassos: ((l.explicacao as unknown[]) ?? []).length,
      via: l.publicadaEm === null ? null : l.justificativa === null && assinaturas.length > 0 ? ("validacao" as const) : ("direta" as const),
      assinaturas,
      justificativa: l.justificativa,
    };
  });
}

export interface PublicarResultado {
  versaoId: string;
  versao: number;
  publicadaEm: Date;
  /** Para a auditoria (seção 8.10 do `docs/gamificacao-e-treinamentos.md`): se o rascunho veio da IA e o texto de origem. */
  geradoComIa: boolean;
  textoOrigem: string | null;
}

/**
 * Põe o rascunho no ar na transação de quem chama: a versão publicada até então vira `substituida`, e o rascunho, `publicada`, com o
 * termo e a assinatura de quem publicou (a de quem fechou o quórum, na validação; a do admin, na publicação direta).
 */
export async function publicarRascunho(
  tx: Db,
  treinamentoId: string,
  rascunho: VersaoLinha,
  servico: { codigo: string; descricao: string },
  quem: { usuarioId: string; assinaturaPath: string; agora: Date; justificativaDireta?: string },
): Promise<PublicarResultado> {
  await tx
    .update(treinamentoServicoVersao)
    .set({ estado: "substituida" })
    .where(and(eq(treinamentoServicoVersao.treinamentoId, treinamentoId), eq(treinamentoServicoVersao.estado, "publicada")));
  const [publicada] = await tx
    .update(treinamentoServicoVersao)
    .set({
      estado: "publicada",
      publicadaEm: quem.agora,
      publicadaPor: quem.usuarioId,
      assinaturaPath: quem.assinaturaPath,
      termo: TERMO_TREINAMENTO(servico.codigo, servico.descricao),
      ...(quem.justificativaDireta ? { publicacaoDiretaJustificativa: quem.justificativaDireta } : {}),
    })
    .where(eq(treinamentoServicoVersao.id, rascunho.id))
    .returning({ id: treinamentoServicoVersao.id, versao: treinamentoServicoVersao.versao, publicadaEm: treinamentoServicoVersao.publicadaEm });
  return { versaoId: publicada!.id, versao: publicada!.versao, publicadaEm: publicada!.publicadaEm!, geradoComIa: rascunho.geradoComIa, textoOrigem: rascunho.textoOrigem };
}

/**
 * Publica o rascunho direto, sem esperar a validação dos supervisores: termo + assinatura (já enviada por `PUT /arquivos/{id}`, tipo
 * `assinatura`), no padrão de `PUT /me/assinatura`. É a exceção do admin; `justificativaDireta` fica gravada com a versão.
 */
export async function publicarVersao(db: Db, atividadeCodigo: string, usuarioId: string, assinaturaPath: string, agora: Date, justificativaDireta?: string): Promise<PublicarResultado> {
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

  return db.transaction(async (transacao) => publicarRascunho(transacao as unknown as Db, treinamento.id, rascunho, servico, { usuarioId, assinaturaPath, agora, justificativaDireta }));
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
