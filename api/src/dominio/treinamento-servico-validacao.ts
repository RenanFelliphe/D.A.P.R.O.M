import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { atividade, equipe, os, treinamentoServico, treinamentoServicoValidador, treinamentoServicoVersao, usuario } from "../db/schema";
import type { Deps } from "../deps";
import { conflito, ErroApi, invalido, naoEncontrado, proibido } from "../http/erros";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { destinatariosDaEquipe, criarAviso } from "./alertas";
import { assinaturaDoAto } from "./assinatura";
import { registrarAuditoria } from "./auditoria";
import { equipesDoServico } from "./sugestao-materiais";
import {
  avisarTreinamentoPublicado,
  publicarRascunho,
  rascunhoDoTreinamento,
  rascunhoParaEditor,
  treinamentoDoCodigo,
  versaoPublicadaDoTreinamento,
  type RascunhoDoEditor,
} from "./treinamento-servico";
import { validarConteudo, validarFasesContraCatalogo, validarPublicavel, validarSemPendencias, type FaseEntrada, type PassoExplicacao } from "./treinamento-servico-esquema";
import { esquemaFases } from "./treinamento-servico-esquema";

/*
 * A validação do treinamento pelos supervisores (`docs/gamificacao-e-treinamentos.md`, seção 8.10). O rascunho enviado fica travado e
 * as 3 equipes que mais fazem o serviço (sem a de quem criou) validam, uma pessoa por equipe. Assinam 2 dos 3 (todos, quando só há
 * 1 ou 2 validadores): ao fechar o quórum o treinamento é publicado sozinho. Qualquer recusa, com motivo, devolve o rascunho ao autor.
 * O admin pode publicar direto (a exceção, com justificativa). O grupo é fixado ao enviar, porque o ranking das equipes muda.
 */

export const MAX_VALIDADORES = 3;
export const ASSINATURAS_NECESSARIAS = 2;
export const necessariasPara = (validadores: number) => Math.min(ASSINATURAS_NECESSARIAS, validadores);

const STATUS_FORA_DO_SERVICO = ["cancelada", "devolvida"] as const;

type VersaoLinha = typeof treinamentoServicoVersao.$inferSelect;

// ---- Quem pode criar -----------------------------------------------------------------------------------------------

/** Os serviços que a pessoa pode montar como supervisora: os que as equipes que ela supervisiona (ou representa) fazem. */
export async function servicosDoSupervisor(db: Db, eu: UsuarioAutenticado): Promise<string[]> {
  if (eu.equipesSupervisionadas.length === 0) return [];
  const linhas = await db
    .selectDistinct({ codigo: os.codigoAtividade })
    .from(os)
    .where(and(inArray(os.equipeId, eu.equipesSupervisionadas), notInArray(os.status, [...STATUS_FORA_DO_SERVICO])))
    .orderBy(asc(os.codigoAtividade));
  return linhas.map((l) => l.codigo).filter((c): c is string => c !== null);
}

/** Cria e edita o treinamento do serviço: o admin, ou o supervisor (ou o representante no comando) de uma equipe que já faz o serviço. */
export async function podeCriarTreinamento(db: Db, eu: UsuarioAutenticado, codigo: string): Promise<boolean> {
  if (eu.perfil === "admin") return true;
  if (eu.equipesSupervisionadas.length === 0) return false;
  const [linha] = await db
    .select({ id: os.id })
    .from(os)
    .where(and(eq(os.codigoAtividade, codigo), inArray(os.equipeId, eu.equipesSupervisionadas), notInArray(os.status, [...STATUS_FORA_DO_SERVICO])))
    .limit(1);
  return Boolean(linha);
}

async function nomeDe(db: Db, usuarioId: string | null): Promise<string | null> {
  if (!usuarioId) return null;
  const [u] = await db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, usuarioId));
  return u?.nome ?? null;
}

/**
 * Quem pode editar o rascunho do serviço (abrir o editor, salvar, pedir à IA): o admin, e o supervisor elegível quando o rascunho é
 * dele ou ainda não existe. O rascunho de outra pessoa é recusado com o nome dela.
 */
export async function exigirPodeEditar(db: Db, eu: UsuarioAutenticado, codigo: string): Promise<void> {
  if (eu.perfil === "admin") return;
  if (!(await podeCriarTreinamento(db, eu, codigo))) {
    throw proibido("Só o administrador e o supervisor de uma equipe que faz este serviço montam o treinamento dele");
  }
  const treinamento = await treinamentoDoCodigo(db, codigo);
  const rascunho = treinamento ? await rascunhoDoTreinamento(db, treinamento.id) : undefined;
  if (rascunho && rascunho.autorId !== eu.id) {
    const de = await nomeDe(db, rascunho.autorId);
    throw new ErroApi(403, "rascunho_de_outra_pessoa", `O rascunho deste treinamento é ${de ? `de ${de}` : "do administrador"}`);
  }
}

/** Ver as versões do treinamento do serviço: o admin e o supervisor elegível. */
export async function exigirPodeVer(db: Db, eu: UsuarioAutenticado, codigo: string): Promise<void> {
  if (!(await podeCriarTreinamento(db, eu, codigo))) throw proibido("Só o administrador e o supervisor de uma equipe que faz este serviço veem o treinamento em montagem");
}

// ---- Escolha dos validadores ------------------------------------------------------------------------------------------

export interface ValidadorPrevisto {
  equipeId: string;
  equipeNome: string;
  posicao: number;
  supervisorNome: string | null;
}

/** Quem responde pela equipe agora: o supervisor ativo e liberado, ou, sem ele, o representante; `null` quando ninguém pode. */
async function responsaveisDasEquipes(db: Db, equipeIds: string[]): Promise<Map<string, { id: string; nome: string }>> {
  if (equipeIds.length === 0) return new Map();
  const equipes = await db.select({ id: equipe.id, supervisorId: equipe.supervisorId, representanteId: equipe.representanteId }).from(equipe).where(inArray(equipe.id, equipeIds));
  const pessoas = [...new Set(equipes.flatMap((e) => [e.supervisorId, e.representanteId]).filter((id): id is string => id !== null))];
  const linhas = pessoas.length ? await db.select({ id: usuario.id, nome: usuario.nome, ativo: usuario.ativo, liberacao: usuario.liberacao }).from(usuario).where(inArray(usuario.id, pessoas)) : [];
  const valida = (id: string | null) => linhas.find((u) => u.id === id && u.ativo && u.liberacao === "liberado");
  const mapa = new Map<string, { id: string; nome: string }>();
  for (const e of equipes) {
    const quem = valida(e.supervisorId) ?? valida(e.representanteId);
    if (quem) mapa.set(e.id, { id: quem.id, nome: quem.nome });
  }
  return mapa;
}

/** As equipes do autor (a em que ele trabalha e as que ele supervisiona): nunca validam o que ele montou. */
async function equipesDoAutor(db: Db, autorId: string | null): Promise<Set<string>> {
  if (!autorId) return new Set();
  const [u] = await db.select({ equipeId: usuario.equipeId }).from(usuario).where(eq(usuario.id, autorId));
  const supervisionadas = await db.select({ id: equipe.id }).from(equipe).where(eq(equipe.supervisorId, autorId));
  return new Set([u?.equipeId, ...supervisionadas.map((e) => e.id)].filter((id): id is string => Boolean(id)));
}

/**
 * Quem validaria o treinamento do serviço agora: as até 3 equipes que mais fazem o serviço (`equipesDoServico`), sem as do autor,
 * com uma pessoa só por vez (quem supervisiona duas equipes ocupa uma vaga) e só as equipes que têm quem responda por elas.
 */
export async function validadoresPrevistos(db: Db, codigo: string, autorId: string | null): Promise<ValidadorPrevisto[]> {
  const ranking = await equipesDoServico(db, codigo);
  const doAutor = await equipesDoAutor(db, autorId);
  const candidatas = ranking.filter((e) => !doAutor.has(e.equipeId));
  const responsaveis = await responsaveisDasEquipes(db, candidatas.map((e) => e.equipeId));
  const usadas = new Set<string>();
  const previstos: ValidadorPrevisto[] = [];
  for (const e of candidatas) {
    const quem = responsaveis.get(e.equipeId);
    if (!quem || usadas.has(quem.id) || quem.id === autorId) continue;
    usadas.add(quem.id);
    previstos.push({ equipeId: e.equipeId, equipeNome: e.nome, posicao: previstos.length + 1, supervisorNome: quem.nome });
    if (previstos.length === MAX_VALIDADORES) break;
  }
  return previstos;
}

// ---- A situação ---------------------------------------------------------------------------------------------------------

export interface ValidadorDaRodada {
  equipeId: string;
  equipeNome: string;
  posicao: number;
  supervisorNome: string | null;
  decisao: "aprovou" | "recusou" | null;
  decididaPorNome: string | null;
  decididaEm: Date | null;
  motivo: string | null;
}

export interface SituacaoDaValidacao {
  codigo: string;
  versao: number;
  versaoId: string;
  emValidacao: boolean;
  rodada: number;
  autor: { id: string; nome: string } | null;
  enviadaEm: Date | null;
  necessarias: number;
  aprovacoes: number;
  validadores: ValidadorDaRodada[];
  /** Quem validaria se o rascunho fosse enviado agora (vazio já em validação). */
  validadoresPrevistos: { equipeNome: string; supervisorNome: string | null }[];
  podeEnviar: boolean;
  podeRetirar: boolean;
  possoDecidir: boolean;
  jaDecidi: boolean;
  /** As rodadas anteriores que terminaram em recusa, da mais nova para a mais antiga. */
  historico: { rodada: number; resultado: "recusada"; motivo: string | null; porNome: string | null; em: Date | null }[];
  rascunho: RascunhoDoEditor;
}

async function validadoresDaRodada(db: Db, versaoId: string, rodada: number): Promise<ValidadorDaRodada[]> {
  const linhas = await db
    .select({
      equipeId: treinamentoServicoValidador.equipeId,
      equipeNome: equipe.nome,
      posicao: treinamentoServicoValidador.posicao,
      decisao: treinamentoServicoValidador.decisao,
      decididaPor: treinamentoServicoValidador.usuarioId,
      decididaEm: treinamentoServicoValidador.decididaEm,
      motivo: treinamentoServicoValidador.motivo,
      supervisorId: equipe.supervisorId,
    })
    .from(treinamentoServicoValidador)
    .innerJoin(equipe, eq(equipe.id, treinamentoServicoValidador.equipeId))
    .where(and(eq(treinamentoServicoValidador.versaoId, versaoId), eq(treinamentoServicoValidador.rodada, rodada)))
    .orderBy(asc(treinamentoServicoValidador.posicao));
  const ids = [...new Set(linhas.flatMap((l) => [l.decididaPor, l.supervisorId]).filter((id): id is string => id !== null))];
  const pessoas = ids.length ? await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids)) : [];
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? null;
  return linhas.map((l) => ({
    equipeId: l.equipeId,
    equipeNome: l.equipeNome,
    posicao: l.posicao,
    supervisorNome: nome(l.supervisorId),
    decisao: l.decisao,
    decididaPorNome: nome(l.decididaPor),
    decididaEm: l.decididaEm,
    motivo: l.motivo,
  }));
}

/** Quem supervisiona a equipe da vaga (o supervisor ou o representante no comando) e não é o autor. */
const podeDecidirPor = (eu: UsuarioAutenticado, equipeId: string, autorId: string | null) => eu.id !== autorId && eu.equipesSupervisionadas.includes(equipeId);

async function carregarRascunho(db: Db, codigo: string) {
  const treinamento = await treinamentoDoCodigo(db, codigo);
  if (!treinamento) throw naoEncontrado("Treinamento não encontrado; abra o editor para criá-lo");
  const rascunho = await rascunhoDoTreinamento(db, treinamento.id);
  if (!rascunho) throw naoEncontrado("Não há rascunho deste treinamento");
  return { treinamento, rascunho };
}

/** Admin, autor ou validador da rodada atual veem a validação; os outros recebem 403. */
export async function situacaoDaValidacao(db: Db, eu: UsuarioAutenticado, codigo: string): Promise<SituacaoDaValidacao> {
  const { treinamento, rascunho } = await carregarRascunho(db, codigo);
  const emValidacao = rascunho.validacaoEnviadaEm !== null;
  const rodada = rascunho.rodadaDeValidacao;
  const validadores = rodada > 0 ? await validadoresDaRodada(db, rascunho.id, rodada) : [];
  const ehAdmin = eu.perfil === "admin";
  const ehAutor = rascunho.autorId === eu.id;
  const vagaDeQuem = emValidacao ? validadores.find((v) => podeDecidirPor(eu, v.equipeId, rascunho.autorId)) : undefined;
  if (!ehAdmin && !ehAutor && !vagaDeQuem) throw proibido("Só o administrador, o autor e os validadores veem a validação deste treinamento");

  const jaDecidi = emValidacao && (await jaDecidiNaRodada(db, rascunho.id, rodada, eu.id));
  const decididas = emValidacao ? validadores : [];
  const aprovacoes = decididas.filter((v) => v.decisao === "aprovou").length;
  const previstos = emValidacao ? [] : await validadoresPrevistos(db, codigo, rascunho.autorId ?? (ehAdmin ? eu.id : null));
  const publicada = await versaoPublicadaDoTreinamento(db, treinamento.id);

  // As rodadas que terminaram em recusa (a recusa devolve o rascunho: a vaga recusada guarda o motivo).
  const recusas = await db
    .select({ rodada: treinamentoServicoValidador.rodada, motivo: treinamentoServicoValidador.motivo, por: treinamentoServicoValidador.usuarioId, em: treinamentoServicoValidador.decididaEm })
    .from(treinamentoServicoValidador)
    .where(and(eq(treinamentoServicoValidador.versaoId, rascunho.id), eq(treinamentoServicoValidador.decisao, "recusou")))
    .orderBy(desc(treinamentoServicoValidador.rodada));
  const historico = await Promise.all(recusas.map(async (r) => ({ rodada: r.rodada, resultado: "recusada" as const, motivo: r.motivo, porNome: await nomeDe(db, r.por), em: r.em })));

  return {
    codigo,
    versao: rascunho.versao,
    versaoId: rascunho.id,
    emValidacao,
    rodada,
    autor: rascunho.autorId ? { id: rascunho.autorId, nome: (await nomeDe(db, rascunho.autorId)) ?? "Pessoa removida" } : null,
    enviadaEm: rascunho.validacaoEnviadaEm,
    necessarias: necessariasPara(decididas.length),
    aprovacoes,
    validadores,
    validadoresPrevistos: previstos.map((p) => ({ equipeNome: p.equipeNome, supervisorNome: p.supervisorNome })),
    podeEnviar: !emValidacao && (ehAdmin || ehAutor),
    podeRetirar: emValidacao && (ehAdmin || ehAutor),
    possoDecidir: Boolean(vagaDeQuem && vagaDeQuem.decisao === null && !jaDecidi),
    jaDecidi,
    historico,
    rascunho: rascunhoParaEditor(treinamento.id, rascunho, Boolean(publicada)),
  };
}

async function jaDecidiNaRodada(db: Db, versaoId: string, rodada: number, usuarioId: string): Promise<boolean> {
  const [linha] = await db
    .select({ id: treinamentoServicoValidador.id })
    .from(treinamentoServicoValidador)
    .where(and(eq(treinamentoServicoValidador.versaoId, versaoId), eq(treinamentoServicoValidador.rodada, rodada), eq(treinamentoServicoValidador.usuarioId, usuarioId)))
    .limit(1);
  return Boolean(linha);
}

// ---- Enviar e retirar ----------------------------------------------------------------------------------------------------

async function servicoDoCodigo(db: Db, codigo: string) {
  const [servico] = await db.select({ codigo: atividade.codigo, descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, codigo)).limit(1);
  if (!servico) throw naoEncontrado("Serviço não encontrado no catálogo");
  return servico;
}

/** O que o rascunho precisa ter para ir à validação: o mesmo que para publicar. */
export async function conferirPublicavel(db: Db, rascunho: VersaoLinha): Promise<void> {
  const explicacao = (rascunho.explicacao as PassoExplicacao[]) ?? [];
  const fases: FaseEntrada[] = esquemaFases.parse(rascunho.fases ?? []);
  validarConteudo(explicacao, fases);
  validarPublicavel(explicacao, fases);
  validarSemPendencias(explicacao, fases);
  await validarFasesContraCatalogo(db, fases);
}

async function descricaoDoServico(db: Db, codigo: string): Promise<string> {
  const [a] = await db.select({ descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, codigo));
  return a ? `${codigo} · ${a.descricao}` : codigo;
}

/**
 * Envia o rascunho para validar: confere que dá para publicar, fixa os validadores (as equipes que mais fazem o serviço, sem a do
 * autor), trava o rascunho com a assinatura de quem enviou e avisa os validadores. Sem ninguém para validar: `409 sem_validadores`
 * (o admin publica direto).
 */
export async function enviarParaValidacao(deps: Pick<Deps, "db" | "agora">, eu: UsuarioAutenticado, codigo: string): Promise<void> {
  const { db } = deps;
  await servicoDoCodigo(db, codigo);
  const { treinamento, rascunho } = await carregarRascunho(db, codigo);
  if (eu.perfil !== "admin" && rascunho.autorId !== eu.id) throw proibido("Só quem montou o rascunho (ou o administrador) o envia para validar");
  if (rascunho.validacaoEnviadaEm) throw conflito("ja_em_validacao", "Este treinamento já está em validação");
  await conferirPublicavel(db, rascunho);
  const assinatura = assinaturaDoAto(eu);
  const autorId = rascunho.autorId ?? eu.id;
  const previstos = await validadoresPrevistos(db, codigo, autorId);
  if (previstos.length === 0) {
    throw conflito("sem_validadores", "Nenhuma equipe pode validar este treinamento agora (nenhuma outra equipe faz o serviço, ou não há quem responda por elas). O administrador pode publicá-lo.");
  }
  const agora = deps.agora();
  const rodada = rascunho.rodadaDeValidacao + 1;
  await db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const [travada] = await tx.select({ envio: treinamentoServicoVersao.validacaoEnviadaEm }).from(treinamentoServicoVersao).where(eq(treinamentoServicoVersao.id, rascunho.id)).for("update");
    if (travada?.envio) throw conflito("ja_em_validacao", "Este treinamento já está em validação");
    await tx
      .update(treinamentoServicoVersao)
      .set({ autorId, validacaoEnviadaEm: agora, validacaoEnviadaPor: eu.id, validacaoAssinaturaPath: assinatura, rodadaDeValidacao: rodada })
      .where(eq(treinamentoServicoVersao.id, rascunho.id));
    await tx.insert(treinamentoServicoValidador).values(previstos.map((p) => ({ versaoId: rascunho.id, rodada, posicao: p.posicao, equipeId: p.equipeId })));
  });

  const servico = await descricaoDoServico(db, codigo);
  const destinatarios = new Set<string>();
  for (const p of previstos) for (const d of await destinatariosDaEquipe(db, p.equipeId)) destinatarios.add(d.id);
  destinatarios.delete(autorId);
  await criarAviso(db, destinatarios, {
    tipo: "treinamento_para_validar",
    treinamentoId: treinamento.id,
    detalhe: `${eu.nome} enviou o treinamento de ${servico} para a sua validação. Assinam ${necessariasPara(previstos.length)} de ${previstos.length} supervisores.`,
    agora,
  });
  await registrarAuditoria(db, eu, {
    entidade: "treinamento",
    verbo: "enviar_validacao",
    entidadeId: codigo,
    alvo: codigo,
    resumo: `Enviou o treinamento de serviço ${codigo} (versão ${rascunho.versao}) para validação`,
    detalhes: { versao: rascunho.versao, rodada, validadores: previstos.map((p) => ({ equipe: p.equipeNome, supervisor: p.supervisorNome })) },
  });
}

/** O autor (ou o admin) desfaz o envio: o rascunho volta a ser editável e a rodada deixa de valer. */
export async function retirarDaValidacao(deps: Pick<Deps, "db">, eu: UsuarioAutenticado, codigo: string): Promise<void> {
  const { db } = deps;
  const { rascunho } = await carregarRascunho(db, codigo);
  if (eu.perfil !== "admin" && rascunho.autorId !== eu.id) throw proibido("Só o autor (ou o administrador) retira o treinamento da validação");
  if (!rascunho.validacaoEnviadaEm) throw conflito("fora_de_validacao", "Este treinamento não está em validação");
  await db
    .update(treinamentoServicoVersao)
    .set({ validacaoEnviadaEm: null, validacaoEnviadaPor: null, validacaoAssinaturaPath: null })
    .where(eq(treinamentoServicoVersao.id, rascunho.id));
  await registrarAuditoria(db, eu, {
    entidade: "treinamento",
    verbo: "retirar_validacao",
    entidadeId: codigo,
    alvo: codigo,
    resumo: `Retirou o treinamento de serviço ${codigo} (versão ${rascunho.versao}) da validação`,
    detalhes: { versao: rascunho.versao, rodada: rascunho.rodadaDeValidacao },
  });
}

// ---- Decidir -------------------------------------------------------------------------------------------------------------

export type DecisaoDoValidador = { aprovar: true } | { aprovar: false; motivo: string };

export interface ResultadoDaDecisao {
  /** A aprovação fechou o quórum e o treinamento foi publicado. */
  publicada: boolean;
  versao: number;
}

/**
 * O validador aprova (assinando com a assinatura do perfil) ou recusa (com motivo). Quem pode: quem supervisiona uma das equipes da
 * rodada, que não é o autor e ainda não decidiu. Ao fechar o quórum o treinamento é publicado na mesma transação; a recusa
 * devolve o rascunho ao autor, que o edita e envia de novo (uma nova rodada, com os validadores de agora).
 */
export async function decidirValidacao(deps: Pick<Deps, "db" | "agora">, eu: UsuarioAutenticado, codigo: string, decisao: DecisaoDoValidador): Promise<ResultadoDaDecisao> {
  const { db } = deps;
  const servico = await servicoDoCodigo(db, codigo);
  const { treinamento } = await carregarRascunho(db, codigo);
  const assinatura = assinaturaDoAto(eu);
  const agora = deps.agora();
  const motivo = decisao.aprovar ? null : decisao.motivo.trim();
  if (!decisao.aprovar && !motivo) throw invalido("motivo_obrigatorio", "Escreva o motivo da recusa");

  const resultado = await db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const [versao] = await tx.select().from(treinamentoServicoVersao).where(and(eq(treinamentoServicoVersao.treinamentoId, treinamento.id), eq(treinamentoServicoVersao.estado, "rascunho"))).for("update");
    if (!versao?.validacaoEnviadaEm) throw conflito("fora_de_validacao", "Este treinamento não está em validação");
    const rodada = versao.rodadaDeValidacao;
    const vagas = await tx
      .select()
      .from(treinamentoServicoValidador)
      .where(and(eq(treinamentoServicoValidador.versaoId, versao.id), eq(treinamentoServicoValidador.rodada, rodada)));
    const vaga = vagas.find((v) => v.decisao === null && podeDecidirPor(eu, v.equipeId, versao.autorId));
    if (!vaga) {
      if (vagas.some((v) => v.usuarioId === eu.id)) throw conflito("ja_decidiu", "Você já decidiu nesta validação");
      throw proibido("Você não é validador deste treinamento");
    }
    if (vagas.some((v) => v.usuarioId === eu.id)) throw conflito("ja_decidiu", "Você já decidiu nesta validação");

    await tx
      .update(treinamentoServicoValidador)
      .set({ decisao: decisao.aprovar ? "aprovou" : "recusou", usuarioId: eu.id, decididaEm: agora, motivo, assinaturaPath: assinatura })
      .where(eq(treinamentoServicoValidador.id, vaga.id));

    if (!decisao.aprovar) {
      await tx
        .update(treinamentoServicoVersao)
        .set({ validacaoEnviadaEm: null, validacaoEnviadaPor: null, validacaoAssinaturaPath: null })
        .where(eq(treinamentoServicoVersao.id, versao.id));
      return { publicada: false, versao: versao.versao, autorId: versao.autorId, primeira: false };
    }

    const aprovacoes = vagas.filter((v) => v.decisao === "aprovou").length + 1;
    if (aprovacoes < necessariasPara(vagas.length)) return { publicada: false, versao: versao.versao, autorId: versao.autorId, primeira: false };

    // Quórum fechado: publica na mesma transação (o conteúdo está travado desde o envio, mas o catálogo pode ter mudado).
    await validarFasesContraCatalogo(tx, esquemaFases.parse(versao.fases ?? []));
    const publicado = await publicarRascunho(tx, treinamento.id, versao, { codigo: servico.codigo, descricao: servico.descricao }, { usuarioId: eu.id, assinaturaPath: assinatura, agora });
    return { publicada: true, versao: publicado.versao, autorId: versao.autorId, primeira: publicado.versao === 1 };
  });

  const nomeDoServico = await descricaoDoServico(db, codigo);
  if (!decisao.aprovar) {
    if (resultado.autorId) {
      await criarAviso(db, [resultado.autorId], {
        tipo: "treinamento_devolvido",
        treinamentoId: treinamento.id,
        detalhe: `${eu.nome} devolveu o treinamento de ${nomeDoServico}: "${motivo}". Ajuste e envie de novo para validar.`,
        agora,
      });
    }
    await registrarAuditoria(db, eu, {
      entidade: "treinamento",
      verbo: "recusar",
      entidadeId: codigo,
      alvo: codigo,
      resumo: `Recusou o treinamento de serviço ${codigo} (versão ${resultado.versao}) na validação`,
      detalhes: { versao: resultado.versao, motivo },
    });
  } else {
    await registrarAuditoria(db, eu, {
      entidade: "treinamento",
      verbo: "aprovar",
      entidadeId: codigo,
      alvo: codigo,
      resumo: `Aprovou o treinamento de serviço ${codigo} (versão ${resultado.versao}) na validação${resultado.publicada ? " e fechou o quórum: o treinamento foi publicado" : ""}`,
      detalhes: { versao: resultado.versao, publicada: resultado.publicada },
    });
    if (resultado.publicada) {
      if (resultado.autorId) {
        await criarAviso(db, [resultado.autorId], {
          tipo: "treinamento_validado",
          treinamentoId: treinamento.id,
          detalhe: `O treinamento de ${nomeDoServico} foi validado pelos supervisores e publicado (versão ${resultado.versao}).`,
          agora,
        });
      }
      // Só a primeira publicação avisa os técnicos: as seguintes corrigem o que já está lá.
      if (resultado.primeira) await avisarTreinamentoPublicado(db, codigo, agora);
    }
  }
  return { publicada: resultado.publicada, versao: resultado.versao };
}

// ---- As listas de quem valida ---------------------------------------------------------------------------------------------

export interface TreinamentoParaValidar {
  codigo: string;
  descricao: string;
  versao: number;
  rodada: number;
  autorNome: string | null;
  enviadaEm: Date;
  aprovacoes: number;
  necessarias: number;
  validadores: { equipeNome: string; decisao: "aprovou" | "recusou" | null }[];
}

/** Os treinamentos em validação que esperam a decisão de quem pede: vaga de equipe que ela supervisiona, que não é o autor, ainda sem decisão dela. */
export async function treinamentosParaValidar(db: Db, eu: UsuarioAutenticado): Promise<TreinamentoParaValidar[]> {
  if (eu.equipesSupervisionadas.length === 0) return [];
  const minhas = await db
    .select({ versaoId: treinamentoServicoVersao.id, versao: treinamentoServicoVersao.versao, rodada: treinamentoServicoVersao.rodadaDeValidacao, enviadaEm: treinamentoServicoVersao.validacaoEnviadaEm, autorId: treinamentoServicoVersao.autorId, codigo: treinamentoServico.atividadeCodigo, descricao: atividade.descricao })
    .from(treinamentoServicoValidador)
    .innerJoin(treinamentoServicoVersao, and(eq(treinamentoServicoVersao.id, treinamentoServicoValidador.versaoId), eq(treinamentoServicoVersao.rodadaDeValidacao, treinamentoServicoValidador.rodada)))
    .innerJoin(treinamentoServico, eq(treinamentoServico.id, treinamentoServicoVersao.treinamentoId))
    .innerJoin(atividade, eq(atividade.codigo, treinamentoServico.atividadeCodigo))
    .where(
      and(
        eq(treinamentoServicoVersao.estado, "rascunho"),
        sql`${treinamentoServicoVersao.validacaoEnviadaEm} is not null`,
        inArray(treinamentoServicoValidador.equipeId, eu.equipesSupervisionadas),
        sql`${treinamentoServicoValidador.decisao} is null`,
        sql`${treinamentoServicoVersao.autorId} is distinct from ${eu.id}`,
      ),
    )
    .orderBy(asc(treinamentoServicoVersao.validacaoEnviadaEm));
  const vistos = new Set<string>();
  const lista: TreinamentoParaValidar[] = [];
  for (const m of minhas) {
    if (vistos.has(m.versaoId)) continue;
    vistos.add(m.versaoId);
    if (await jaDecidiNaRodada(db, m.versaoId, m.rodada, eu.id)) continue;
    const validadores = await validadoresDaRodada(db, m.versaoId, m.rodada);
    lista.push({
      codigo: m.codigo,
      descricao: m.descricao,
      versao: m.versao,
      rodada: m.rodada,
      autorNome: await nomeDe(db, m.autorId),
      enviadaEm: m.enviadaEm!,
      aprovacoes: validadores.filter((v) => v.decisao === "aprovou").length,
      necessarias: necessariasPara(validadores.length),
      validadores: validadores.map((v) => ({ equipeNome: v.equipeNome, decisao: v.decisao })),
    });
  }
  return lista;
}

/** A pré-visualização do rascunho: o admin, o autor e os validadores da rodada atual. */
export async function exigirPodePreVisualizar(db: Db, eu: UsuarioAutenticado, codigo: string): Promise<void> {
  if (eu.perfil === "admin") return;
  const { rascunho } = await carregarRascunho(db, codigo);
  if (rascunho.autorId === eu.id) return;
  if (rascunho.validacaoEnviadaEm) {
    const validadores = await validadoresDaRodada(db, rascunho.id, rascunho.rodadaDeValidacao);
    if (validadores.some((v) => podeDecidirPor(eu, v.equipeId, rascunho.autorId))) return;
  }
  throw proibido("Só o administrador, o autor e os validadores testam este treinamento antes da publicação");
}

/**
 * A publicação direta do admin pede justificativa quando a validação era possível: o rascunho já está em validação, ou existiriam
 * validadores se ele fosse enviado agora. Sem ninguém que possa validar, publica sem justificar.
 */
export async function justificativaExigida(db: Db, codigo: string): Promise<boolean> {
  const treinamento = await treinamentoDoCodigo(db, codigo);
  const rascunho = treinamento ? await rascunhoDoTreinamento(db, treinamento.id) : undefined;
  if (!rascunho) return false;
  if (rascunho.validacaoEnviadaEm) return true;
  return (await validadoresPrevistos(db, codigo, rascunho.autorId)).length > 0;
}
