import { and, desc, eq, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/conexao";
import { ausencia, ausenciaAto, equipe, usuario, type AusenciaFormaDeEncerramento } from "../db/schema";
import type { Deps } from "../deps";
import { ehSupervisorTitular, type UsuarioAutenticado } from "../http/autenticacao";
import { ErroApi, conflito, invalido, naoEncontrado, proibido } from "../http/erros";
import { limiteEDeslocamento, type Paginacao } from "../http/paginacao";
import { registrarAuditoria } from "./auditoria";
import {
  ESTADOS_ABERTOS,
  aplicarInicioDaAusencia,
  avisarAusencia,
  destinatariosDoSupervisor,
  gravarAto,
  situacaoDaAusencia,
  temExecucaoAberta,
  type LinhaAusencia,
  type SituacaoDaAusencia,
} from "./ausencia";
import { dataBr, diaDe, diasEntre, somarDias } from "./tempo";

/** Uma ausência dura até um ano; a prorrogação pode passar disso. */
export const LIMITE_DE_DIAS = 365;

const ROTULO_DA_SITUACAO: Record<SituacaoDaAusencia, string> = {
  pedida: "aguardando a resposta do supervisor",
  aguardando_confirmacao: "aguardando a confirmação do funcionário",
  agendada: "agendada",
  em_curso: "em curso",
  vencida: "vencida",
  encerrada: "encerrada",
  recusada: "recusada",
  cancelada: "cancelada",
};

// ---------------------------------------------------------------------------------------------------------------
// Regras comuns

/** Toda ação assinada usa a assinatura do perfil: sem ela cadastrada, o cadastro vem antes (como na APR). Devolve a imagem usada. */
function assinaturaDe(eu: UsuarioAutenticado): string {
  if (!eu.assinaturaPath) throw invalido("assinatura_ausente", "Cadastre a sua assinatura no perfil antes de assinar");
  return eu.assinaturaPath;
}

/** O período que a pessoa informou: o início e, no lugar de um dos dois, os dias corridos ou a data de retorno (o outro o sistema calcula). */
export interface PeriodoInformado {
  inicio: string;
  dias?: number;
  retorno?: string;
}

function calcularPeriodo(p: PeriodoInformado, hoje: string) {
  if ((p.dias === undefined) === (p.retorno === undefined)) {
    throw invalido("periodo_invalido", "Informe os dias de ausência ou a data de retorno (só um dos dois)");
  }
  if (p.inicio < hoje) throw invalido("inicio_no_passado", "O início da ausência não pode ser no passado");
  const retorno = p.retorno ?? somarDias(p.inicio, p.dias!);
  if (retorno <= p.inicio) throw invalido("periodo_invalido", "A data de retorno precisa ser depois do início");
  if (diasEntre(p.inicio, retorno) > LIMITE_DE_DIAS) throw invalido("periodo_longo", `Uma ausência pode ter até ${LIMITE_DE_DIAS} dias; para mais, o supervisor a prorroga`);
  return { inicio: p.inicio, retorno, diasInformados: p.dias ?? null };
}

/** "de 20/10/2026 a 02/11/2026, com retorno em 03/11/2026" (o retorno é o primeiro dia de volta). */
const descreverPeriodo = (inicio: string, retorno: string) => `de ${dataBr(inicio)} a ${dataBr(somarDias(retorno, -1))}, com retorno em ${dataBr(retorno)}`;

/** Uma ausência por vez: o período não pode se sobrepor a uma pedida, aprovada ou em curso da mesma pessoa. */
async function conferirSobreposicao(tx: Db, usuarioId: string, inicio: string, retorno: string, ignorarId?: string) {
  const [outra] = await tx
    .select({ id: ausencia.id })
    .from(ausencia)
    .where(
      and(
        eq(ausencia.usuarioId, usuarioId),
        inArray(ausencia.estado, ESTADOS_ABERTOS),
        sql`${ausencia.inicio} < ${retorno} and ${ausencia.retorno} > ${inicio}`,
        ignorarId ? ne(ausencia.id, ignorarId) : undefined,
      ),
    )
    .limit(1);
  if (outra) throw conflito("ausencia_sobreposta", "Esse período se sobrepõe a outra ausência da pessoa (pedida, aprovada ou em curso)");
}

/** Trava a linha da pessoa: dois pedidos ao mesmo tempo não passam juntos pela conferência de sobreposição. */
async function travarPessoa(tx: Db, usuarioId: string) {
  const [pessoa] = await tx.select().from(usuario).where(eq(usuario.id, usuarioId)).for("update");
  if (!pessoa) throw naoEncontrado("Usuário não encontrado");
  return pessoa;
}

const podeVer = (eu: UsuarioAutenticado, a: Pick<LinhaAusencia, "usuarioId" | "equipeId">) =>
  eu.perfil === "admin" || a.usuarioId === eu.id || eu.equipesSupervisionadas.includes(a.equipeId);

/** A ausência, travada para a alteração. Quem não a enxerga recebe `404`. */
async function carregar(tx: Db, eu: UsuarioAutenticado, id: string): Promise<LinhaAusencia> {
  const [a] = await tx.select().from(ausencia).where(eq(ausencia.id, id)).for("update");
  if (!a || !podeVer(eu, a)) throw naoEncontrado("Ausência não encontrada");
  return a;
}

/** Só o supervisor da equipe da ausência (o admin consulta, mas não age). */
function exigirSupervisorDaEquipe(eu: UsuarioAutenticado, a: LinhaAusencia) {
  // A própria ausência do supervisor, que ele registrou, é dele mesmo: não depende da equipe em que ela foi gravada.
  const propria = a.origem === "propria" && a.usuarioId === eu.id;
  if (!propria && !eu.equipesSupervisionadas.includes(a.equipeId)) throw proibido("Só o supervisor da equipe faz isto");
  // A ausência que o supervisor registrou para si é só dele: o representante, que assume a equipe, não age sobre ela.
  if (a.origem === "propria" && a.usuarioId !== eu.id) throw proibido("A ausência do supervisor só ele altera");
  // Ninguém responde ao próprio pedido: o representante que pede ausência espera o supervisor voltar.
  if (a.usuarioId === eu.id && !propria) throw proibido("Você não responde ao seu próprio pedido de ausência");
  // O supervisor ausente não age pela equipe: só cuida da própria ausência.
  if (eu.ausencia && a.usuarioId !== eu.id) throw new ErroApi(403, "usuario_ausente", "Você está ausente: só a sua própria ausência pode ser alterada por você");
}

function exigirDaPessoa(eu: UsuarioAutenticado, a: LinhaAusencia) {
  if (a.usuarioId !== eu.id) throw proibido("Só a pessoa da ausência faz isto");
}

function exigirEstado(a: LinhaAusencia, hoje: string, estados: readonly LinhaAusencia["estado"][]) {
  if (!estados.includes(a.estado)) {
    throw conflito("ausencia_estado_invalido", `A ausência está ${ROTULO_DA_SITUACAO[situacaoDaAusencia(a, hoje)]} e não aceita esta ação`);
  }
}

const nomeDe = async (tx: Db, id: string) => (await tx.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, id)))[0]?.nome ?? "";

async function encerrar(tx: Db, a: LinhaAusencia, forma: AusenciaFormaDeEncerramento, porId: string, agora: Date) {
  await tx
    .update(ausencia)
    .set({ estado: "encerrada", encerradaEm: agora, encerradaPor: porId, formaEncerramento: forma, fimPedidoData: null, fimPedidoEm: null })
    .where(eq(ausencia.id, a.id));
}

/** A trilha de auditoria da ação: `ausencia.<ato>`, com o resumo. */
async function auditar(deps: Deps, eu: UsuarioAutenticado, a: { id: string }, pessoa: string, ato: string, resumo: string, detalhes?: Record<string, unknown>) {
  await registrarAuditoria(deps.db, eu, { entidade: "ausencia", verbo: ato, entidadeId: a.id, alvo: pessoa, resumo, detalhes });
}

// ---------------------------------------------------------------------------------------------------------------
// Leitura

const supervisorAlias = alias(usuario, "supervisor_da_ausencia");

const colunas = {
  a: ausencia,
  usuarioNome: usuario.nome,
  usuarioMatricula: usuario.matricula,
  equipeNome: equipe.nome,
  supervisorNome: supervisorAlias.nome,
};

function paraApi(l: { a: LinhaAusencia; usuarioNome: string; usuarioMatricula: string; equipeNome: string; supervisorNome: string | null }, hoje: string) {
  const { a } = l;
  return {
    id: a.id,
    usuarioId: a.usuarioId,
    usuarioNome: l.usuarioNome,
    usuarioMatricula: l.usuarioMatricula,
    equipeId: a.equipeId,
    equipeNome: l.equipeNome,
    supervisorId: a.supervisorId,
    supervisorNome: l.supervisorNome,
    motivo: a.motivo,
    inicio: a.inicio,
    retorno: a.retorno,
    /** Os dias corridos da ausência (do início até a véspera do retorno). */
    dias: diasEntre(a.inicio, a.retorno),
    diasInformados: a.diasInformados,
    estado: a.estado,
    situacao: situacaoDaAusencia(a, hoje),
    origem: a.origem,
    fimPedidoData: a.fimPedidoData,
    fimPedidoEm: a.fimPedidoEm,
    encerradaEm: a.encerradaEm,
    formaEncerramento: a.formaEncerramento,
    criadaEm: a.criadaEm,
  };
}

function baseDaConsulta(db: Db) {
  return db
    .select(colunas)
    .from(ausencia)
    .innerJoin(usuario, eq(usuario.id, ausencia.usuarioId))
    .innerJoin(equipe, eq(equipe.id, ausencia.equipeId))
    .leftJoin(supervisorAlias, eq(supervisorAlias.id, ausencia.supervisorId));
}

/** A ausência com os nomes, e a linha do tempo dos atos quando `comAtos`. */
export async function detalharAusencia(db: Db, eu: UsuarioAutenticado, id: string, agora: Date, opcoes: { comAtos?: boolean } = {}) {
  const [l] = await baseDaConsulta(db).where(eq(ausencia.id, id));
  if (!l || !podeVer(eu, l.a)) throw naoEncontrado("Ausência não encontrada");
  const hoje = diaDe(agora);
  if (!opcoes.comAtos) return paraApi(l, hoje);
  const atos = await db
    .select({ id: ausenciaAto.id, tipo: ausenciaAto.tipo, autorId: ausenciaAto.autorId, autorNome: usuario.nome, em: ausenciaAto.em, assinaturaPath: ausenciaAto.assinaturaPath, dados: ausenciaAto.dados })
    .from(ausenciaAto)
    .leftJoin(usuario, eq(usuario.id, ausenciaAto.autorId))
    .where(eq(ausenciaAto.ausenciaId, id))
    .orderBy(ausenciaAto.em, ausenciaAto.id);
  return { ...paraApi(l, hoje), atos: atos.map(({ assinaturaPath, ...ato }) => ({ ...ato, assinado: assinaturaPath !== null })) };
}

export interface FiltrosDeAusencias extends Paginacao {
  usuario_id?: string;
  equipe_id?: string;
  situacao?: SituacaoDaAusencia;
  /** Só as de pé: pedida, aguardando confirmação e confirmada (agendada, em curso ou vencida). */
  abertas?: boolean;
}

function condicaoDaSituacao(s: SituacaoDaAusencia, hoje: string): SQL {
  switch (s) {
    case "agendada":
      return and(eq(ausencia.estado, "confirmada"), sql`${ausencia.inicio} > ${hoje}`)!;
    case "em_curso":
      return and(eq(ausencia.estado, "confirmada"), sql`${ausencia.inicio} <= ${hoje} and ${ausencia.retorno} > ${hoje}`)!;
    case "vencida":
      return and(eq(ausencia.estado, "confirmada"), lte(ausencia.retorno, hoje))!;
    default:
      return eq(ausencia.estado, s);
  }
}

/** As minhas ausências e as das equipes que supervisiono; o admin (que só consulta) vê todas. */
export async function listarAusencias(db: Db, eu: UsuarioAutenticado, f: FiltrosDeAusencias, agora: Date) {
  const hoje = diaDe(agora);
  const doEscopo =
    eu.perfil === "admin"
      ? undefined
      : eu.equipesSupervisionadas.length > 0
        ? sql`(${ausencia.usuarioId} = ${eu.id} or ${inArray(ausencia.equipeId, eu.equipesSupervisionadas)})`
        : eq(ausencia.usuarioId, eu.id);
  const onde = and(
    doEscopo,
    f.usuario_id ? eq(ausencia.usuarioId, f.usuario_id) : undefined,
    f.equipe_id ? eq(ausencia.equipeId, f.equipe_id) : undefined,
    f.situacao ? condicaoDaSituacao(f.situacao, hoje) : undefined,
    f.abertas ? inArray(ausencia.estado, ESTADOS_ABERTOS) : undefined,
  );
  const { limit, offset } = limiteEDeslocamento(f);
  const linhas = await baseDaConsulta(db).where(onde).orderBy(desc(ausencia.inicio), desc(ausencia.criadaEm), desc(ausencia.id)).limit(limit).offset(offset);
  const [contagem] = await db.select({ n: sql<number>`count(*)::int` }).from(ausencia).where(onde);
  return { ausencias: linhas.map((l) => paraApi(l, hoje)), total: contagem?.n ?? 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Pedir e registrar

export interface DadosDoPedido extends PeriodoInformado {
  motivo: string;
  /** A pessoa da ausência, quando o supervisor a registra sem pedido; sem isto é a de quem chama. */
  usuarioId?: string;
  assinar?: boolean;
}

/**
 * O técnico pede a ausência (`pedida`, sem assinatura: ele assina ao confirmar o que o supervisor aprovar). O supervisor da
 * equipe registra a de alguém sem pedido, e o supervisor registra a própria: as duas nascem `confirmada`, assinadas por ele.
 * O admin não pede nem registra, porque não executa OS.
 */
export async function pedirOuRegistrarAusencia(deps: Deps, eu: UsuarioAutenticado, dados: DadosDoPedido) {
  if (eu.perfil !== "tecnico") throw proibido("O administrador não pede nem registra ausência: ele só consulta");
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const alvoId = dados.usuarioId ?? eu.id;
  const periodo = calcularPeriodo(dados, hoje);
  const motivo = dados.motivo.trim();

  const { id, nome, pessoaId, origem, execucaoAberta } = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const pessoa = await travarPessoa(tx, alvoId);
    const deOutra = alvoId !== eu.id;

    let origem: "pedido" | "supervisor" | "propria";
    let equipeId: string;
    if (deOutra) {
      if (!pessoa.equipeId || !eu.equipesSupervisionadas.includes(pessoa.equipeId)) throw proibido("Só o supervisor da equipe registra a ausência de outra pessoa");
      // A ausência do supervisor é registrada por ele mesmo; é ela que faz o representante assumir.
      const [daEquipe] = await tx.select({ supervisorId: equipe.supervisorId }).from(equipe).where(eq(equipe.id, pessoa.equipeId));
      if (daEquipe?.supervisorId === pessoa.id) throw proibido("A ausência do supervisor é registrada por ele mesmo");
      if (pessoa.perfil !== "tecnico" || !pessoa.ativo || pessoa.liberacao !== "liberado") throw invalido("usuario_invalido", "A ausência é de um técnico ativo da equipe");
      origem = "supervisor";
      equipeId = pessoa.equipeId;
    } else if (ehSupervisorTitular(eu)) {
      origem = "propria";
      equipeId = pessoa.equipeId ?? eu.equipesSupervisionadas.find((e) => !eu.equipesRepresentadas.includes(e))!;
    } else {
      origem = "pedido";
      if (!pessoa.equipeId) throw conflito("sem_equipe", "Você não está em uma equipe: não há supervisor para responder ao pedido");
      const [e] = await tx.select({ supervisorId: equipe.supervisorId }).from(equipe).where(eq(equipe.id, pessoa.equipeId));
      if (!e?.supervisorId) throw conflito("equipe_sem_supervisor", "A sua equipe está sem supervisor: não há quem responda ao pedido de ausência");
      equipeId = pessoa.equipeId;
    }
    const assinatura = origem === "pedido" ? null : assinaturaDe(eu);
    if (origem !== "pedido" && dados.assinar !== true) throw invalido("assinatura_obrigatoria", "Confirme a assinatura para registrar a ausência");
    await conferirSobreposicao(tx, alvoId, periodo.inicio, periodo.retorno);

    const registrada = origem !== "pedido";
    const [criada] = await tx
      .insert(ausencia)
      .values({
        usuarioId: alvoId,
        equipeId,
        supervisorId: registrada ? eu.id : null,
        motivo,
        inicio: periodo.inicio,
        retorno: periodo.retorno,
        diasInformados: periodo.diasInformados,
        estado: registrada ? "confirmada" : "pedida",
        origem,
        criadaEm: agora,
      })
      .returning();
    await gravarAto(tx, {
      ausenciaId: criada!.id,
      tipo: registrada ? "registro" : "pedido",
      autorId: eu.id,
      agora,
      assinaturaPath: assinatura,
      dados: { motivo, inicio: periodo.inicio, retorno: periodo.retorno, dias_informados: periodo.diasInformados, origem },
    });

    if (origem === "pedido") {
      await avisarAusencia(tx, {
        tipo: "ausencia_pedida",
        ausenciaId: criada!.id,
        usuarioAlvoId: alvoId,
        destinatarios: await destinatariosDoSupervisor(tx, equipeId),
        detalhe: `${pessoa.nome} pediu ausência ${descreverPeriodo(periodo.inicio, periodo.retorno)}. Motivo: ${motivo}`,
        agora,
      });
    } else if (origem === "supervisor") {
      await avisarAusencia(tx, {
        tipo: "ausencia_registrada",
        ausenciaId: criada!.id,
        usuarioAlvoId: alvoId,
        destinatarios: [alvoId],
        detalhe: `${eu.nome} registrou uma ausência para você ${descreverPeriodo(periodo.inicio, periodo.retorno)}. Motivo: ${motivo}`,
        agora,
      });
    }

    // O supervisor é avisado, na resposta, de que a pessoa está com uma execução aberta: o início da ausência a suspende.
    const execucaoAberta = registrada ? await temExecucaoAberta(tx, alvoId) : false;
    if (registrada && periodo.inicio <= hoje) await aplicarInicioDaAusencia(tx, criada!, agora);
    return { id: criada!.id, nome: pessoa.nome, pessoaId: alvoId, origem, execucaoAberta };
  });

  const resumo =
    origem === "pedido"
      ? `${nome} pediu ausência ${descreverPeriodo(periodo.inicio, periodo.retorno)}`
      : origem === "propria"
        ? `${nome} registrou a própria ausência ${descreverPeriodo(periodo.inicio, periodo.retorno)}`
        : `Registrou a ausência de ${nome} ${descreverPeriodo(periodo.inicio, periodo.retorno)}`;
  await auditar(deps, eu, { id }, nome, origem === "pedido" ? "pedido" : "registro", resumo, { pessoa_id: pessoaId, motivo, inicio: periodo.inicio, retorno: periodo.retorno, origem });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora), execucaoAberta };
}

// ---------------------------------------------------------------------------------------------------------------
// O pedido: o supervisor responde, o técnico confirma

export interface DadosDaAprovacao {
  /** O ajuste das datas, opcional: um novo início, e/ou os dias ou a data de retorno. */
  inicio?: string;
  dias?: number;
  retorno?: string;
}

/** O supervisor aprova o pedido, com ou sem ajuste das datas, assinando; o técnico ainda precisa confirmar. */
export async function aprovarAusencia(deps: Deps, eu: UsuarioAutenticado, id: string, dados: DadosDaAprovacao) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const { nome, ajustou, execucaoAberta, antes, depois } = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirSupervisorDaEquipe(eu, a);
    exigirEstado(a, hoje, ["pedida"]);
    const assinatura = assinaturaDe(eu);

    const inicio = dados.inicio ?? a.inicio;
    // Só o início novo: a duração do pedido se mantém.
    const informouFim = dados.dias !== undefined || dados.retorno !== undefined;
    const periodo = calcularPeriodo(
      informouFim ? { inicio, dias: dados.dias, retorno: dados.retorno } : { inicio, retorno: somarDias(inicio, diasEntre(a.inicio, a.retorno)) },
      hoje,
    );
    const ajustou = periodo.inicio !== a.inicio || periodo.retorno !== a.retorno;
    await conferirSobreposicao(tx, a.usuarioId, periodo.inicio, periodo.retorno, a.id);

    await tx
      .update(ausencia)
      .set({
        estado: "aguardando_confirmacao",
        supervisorId: eu.id,
        inicio: periodo.inicio,
        retorno: periodo.retorno,
        diasInformados: ajustou ? periodo.diasInformados : a.diasInformados,
      })
      .where(eq(ausencia.id, id));
    const antes = { inicio: a.inicio, retorno: a.retorno };
    const depois = { inicio: periodo.inicio, retorno: periodo.retorno };
    await gravarAto(tx, { ausenciaId: id, tipo: "aprovacao", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { ajustou, de: antes, para: depois } });
    const nome = await nomeDe(tx, a.usuarioId);
    await avisarAusencia(tx, {
      tipo: "ausencia_aprovada",
      ausenciaId: id,
      usuarioAlvoId: a.usuarioId,
      destinatarios: [a.usuarioId],
      detalhe: `${eu.nome} aprovou o seu pedido de ausência${ajustou ? " com as datas ajustadas" : ""}: ${descreverPeriodo(periodo.inicio, periodo.retorno)}. Confirme, assinando, para a ausência valer.`,
      agora,
    });
    return { nome, ajustou, execucaoAberta: await temExecucaoAberta(tx, a.usuarioId), antes, depois };
  });
  await auditar(deps, eu, { id }, nome, "aprovacao", `Aprovou o pedido de ausência de ${nome}${ajustou ? " com as datas ajustadas" : ""}`, { de: antes, para: depois });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora), execucaoAberta };
}

/** O supervisor recusa o pedido, com o motivo, assinando. */
export async function recusarAusencia(deps: Deps, eu: UsuarioAutenticado, id: string, motivo: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const nome = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirSupervisorDaEquipe(eu, a);
    exigirEstado(a, hoje, ["pedida"]);
    const assinatura = assinaturaDe(eu);
    await tx.update(ausencia).set({ estado: "recusada", supervisorId: eu.id, encerradaEm: agora, encerradaPor: eu.id }).where(eq(ausencia.id, id));
    await gravarAto(tx, { ausenciaId: id, tipo: "recusa", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { motivo } });
    await avisarAusencia(tx, {
      tipo: "ausencia_recusada",
      ausenciaId: id,
      usuarioAlvoId: a.usuarioId,
      destinatarios: [a.usuarioId],
      detalhe: `${eu.nome} recusou o seu pedido de ausência ${descreverPeriodo(a.inicio, a.retorno)}. Motivo: ${motivo}`,
      agora,
    });
    return nomeDe(tx, a.usuarioId);
  });
  await auditar(deps, eu, { id }, nome, "recusa", `Recusou o pedido de ausência de ${nome}`, { motivo });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

/** O técnico confirma, assinando, a ausência que o supervisor aprovou: ela passa a valer. */
export async function confirmarAusencia(deps: Deps, eu: UsuarioAutenticado, id: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const nome = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirDaPessoa(eu, a);
    exigirEstado(a, hoje, ["aguardando_confirmacao"]);
    if (a.retorno <= hoje) throw conflito("periodo_vencido", "A data de retorno já passou: peça a ausência de novo");
    const assinatura = assinaturaDe(eu);
    await conferirSobreposicao(tx, a.usuarioId, a.inicio, a.retorno, a.id);
    const [confirmada] = await tx.update(ausencia).set({ estado: "confirmada" }).where(eq(ausencia.id, id)).returning();
    await gravarAto(tx, { ausenciaId: id, tipo: "confirmacao", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { inicio: a.inicio, retorno: a.retorno } });
    if (a.inicio <= hoje) await aplicarInicioDaAusencia(tx, confirmada!, agora);
    return nomeDe(tx, a.usuarioId);
  });
  await auditar(deps, eu, { id }, nome, "confirmacao", `${nome} confirmou a ausência aprovada`);
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

/** O técnico recusa o ajuste das datas que o supervisor fez, assinando: o pedido termina `recusada`. */
export async function recusarAjusteDaAusencia(deps: Deps, eu: UsuarioAutenticado, id: string, motivo?: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const nome = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirDaPessoa(eu, a);
    exigirEstado(a, hoje, ["aguardando_confirmacao"]);
    const assinatura = assinaturaDe(eu);
    await tx.update(ausencia).set({ estado: "recusada", encerradaEm: agora, encerradaPor: eu.id }).where(eq(ausencia.id, id));
    await gravarAto(tx, { ausenciaId: id, tipo: "recusa_ajuste", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { motivo: motivo ?? null } });
    const nome = await nomeDe(tx, a.usuarioId);
    await avisarAusencia(tx, {
      tipo: "ausencia_recusada",
      ausenciaId: id,
      usuarioAlvoId: a.usuarioId,
      destinatarios: a.supervisorId ? [a.supervisorId] : await destinatariosDoSupervisor(tx, a.equipeId),
      detalhe: `${nome} recusou as datas aprovadas para a ausência ${descreverPeriodo(a.inicio, a.retorno)}${motivo ? `. Motivo: ${motivo}` : ""}`,
      agora,
    });
    return nome;
  });
  await auditar(deps, eu, { id }, nome, "recusa_ajuste", `${nome} recusou o ajuste das datas da ausência`, { motivo: motivo ?? null });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

/** O técnico cancela, assinando, o pedido que ainda não foi aprovado (ou o aprovado que ainda não confirmou). */
export async function cancelarAusencia(deps: Deps, eu: UsuarioAutenticado, id: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const nome = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirDaPessoa(eu, a);
    exigirEstado(a, hoje, ["pedida", "aguardando_confirmacao"]);
    const assinatura = assinaturaDe(eu);
    await tx.update(ausencia).set({ estado: "cancelada", encerradaEm: agora, encerradaPor: eu.id }).where(eq(ausencia.id, id));
    await gravarAto(tx, { ausenciaId: id, tipo: "cancelamento", autorId: eu.id, agora, assinaturaPath: assinatura });
    return nomeDe(tx, a.usuarioId);
  });
  await auditar(deps, eu, { id }, nome, "cancelamento", `${nome} cancelou o pedido de ausência`);
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

// ---------------------------------------------------------------------------------------------------------------
// Durante a ausência: o fim antecipado, a prorrogação, o encerramento e o retorno

/** A ausência de uma pessoa que está de pé e já começou (em curso). */
const emCurso = (a: LinhaAusencia, hoje: string) => a.estado === "confirmada" && a.inicio <= hoje && a.retorno > hoje;

/** O ausente pede, assinando, o fim antecipado: a data de retorno que ele quer, de hoje até a véspera do retorno atual. */
export async function pedirFimDaAusencia(deps: Deps, eu: UsuarioAutenticado, id: string, data: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const nome = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirDaPessoa(eu, a);
    if (!emCurso(a, hoje)) {
      throw conflito("ausencia_estado_invalido", `A ausência está ${ROTULO_DA_SITUACAO[situacaoDaAusencia(a, hoje)]}: o fim antecipado vale só para a ausência em curso`);
    }
    if (a.origem === "propria") throw conflito("ausencia_propria", "Quem registrou a própria ausência a encerra, sem pedir");
    if (a.fimPedidoEm) throw conflito("fim_ja_pedido", "O fim antecipado já foi pedido: aguarde a resposta do supervisor");
    if (data < hoje || data >= a.retorno) throw invalido("data_invalida", "A data de retorno pedida precisa ser de hoje até a véspera do retorno previsto");
    const assinatura = assinaturaDe(eu);
    await tx.update(ausencia).set({ fimPedidoData: data, fimPedidoEm: agora }).where(eq(ausencia.id, id));
    await gravarAto(tx, { ausenciaId: id, tipo: "fim_pedido", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { data, retorno_previsto: a.retorno } });
    const nome = await nomeDe(tx, a.usuarioId);
    await avisarAusencia(tx, {
      tipo: "ausencia_fim_pedido",
      ausenciaId: id,
      usuarioAlvoId: a.usuarioId,
      destinatarios: await destinatariosDoSupervisor(tx, a.equipeId),
      detalhe: `${nome} pediu o fim antecipado da ausência: voltar em ${dataBr(data)} (o retorno previsto era ${dataBr(a.retorno)}).`,
      agora,
    });
    return nome;
  });
  await auditar(deps, eu, { id }, nome, "fim_pedido", `${nome} pediu o fim antecipado da ausência`, { data });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

/**
 * O supervisor aprova ou recusa, assinando, o fim antecipado. Aprovado para hoje (ou antes), a ausência termina na hora;
 * aprovado para um dia à frente, a data de retorno passa a ser essa e a ausência segue o caminho de sempre.
 */
export async function responderFimDaAusencia(deps: Deps, eu: UsuarioAutenticado, id: string, dados: { aprovar: boolean; motivo?: string }) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const { nome, terminou } = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirSupervisorDaEquipe(eu, a);
    exigirEstado(a, hoje, ["confirmada"]);
    if (!a.fimPedidoEm || !a.fimPedidoData) throw conflito("sem_pedido_de_fim", "Não há pedido de fim antecipado para responder");
    const assinatura = assinaturaDe(eu);
    const data = a.fimPedidoData;
    const nome = await nomeDe(tx, a.usuarioId);
    let terminou = false;
    if (!dados.aprovar) {
      await tx.update(ausencia).set({ fimPedidoData: null, fimPedidoEm: null }).where(eq(ausencia.id, id));
    } else if (data <= hoje) {
      await encerrar(tx, a, "antecipada", eu.id, agora);
      terminou = true;
    } else {
      await tx.update(ausencia).set({ retorno: data, vencidaAvisadaEm: null, fimPedidoData: null, fimPedidoEm: null }).where(eq(ausencia.id, id));
    }
    await gravarAto(tx, {
      ausenciaId: id,
      tipo: dados.aprovar ? "fim_aprovado" : "fim_recusado",
      autorId: eu.id,
      agora,
      assinaturaPath: assinatura,
      dados: { data, motivo: dados.motivo ?? null, encerrada: terminou },
    });
    await avisarAusencia(tx, {
      tipo: "ausencia_fim_respondido",
      ausenciaId: id,
      usuarioAlvoId: a.usuarioId,
      destinatarios: [a.usuarioId],
      detalhe: dados.aprovar
        ? terminou
          ? `${eu.nome} aprovou o fim antecipado: a sua ausência terminou.`
          : `${eu.nome} aprovou o fim antecipado: o seu retorno passa a ser em ${dataBr(data)}.`
        : `${eu.nome} recusou o fim antecipado da ausência${dados.motivo ? `. Motivo: ${dados.motivo}` : ""}.`,
      agora,
    });
    return { nome, terminou };
  });
  await auditar(deps, eu, { id }, nome, dados.aprovar ? "fim_aprovado" : "fim_recusado", `${dados.aprovar ? "Aprovou" : "Recusou"} o fim antecipado da ausência de ${nome}`, { motivo: dados.motivo ?? null });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora), terminou };
}

/** O supervisor muda a data de retorno (em curso, agendada ou vencida), assinando. O ausente recebe o aviso. */
export async function prorrogarAusencia(deps: Deps, eu: UsuarioAutenticado, id: string, retorno: string, motivo?: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const nome = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirSupervisorDaEquipe(eu, a);
    exigirEstado(a, hoje, ["confirmada"]);
    if (retorno === a.retorno) throw invalido("periodo_invalido", "A data de retorno é a mesma que já está registrada");
    if (retorno <= hoje || retorno <= a.inicio) throw invalido("periodo_invalido", "A nova data de retorno precisa ser depois de hoje e do início; para terminar já, encerre a ausência");
    const assinatura = assinaturaDe(eu);
    await conferirSobreposicao(tx, a.usuarioId, a.inicio, retorno, a.id);
    await tx.update(ausencia).set({ retorno, vencidaAvisadaEm: null, fimPedidoData: null, fimPedidoEm: null }).where(eq(ausencia.id, id));
    await gravarAto(tx, { ausenciaId: id, tipo: "prorrogacao", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { retorno_anterior: a.retorno, retorno_novo: retorno, motivo: motivo ?? null } });
    const nome = await nomeDe(tx, a.usuarioId);
    if (a.usuarioId !== eu.id) {
      await avisarAusencia(tx, {
        tipo: "ausencia_alterada",
        ausenciaId: id,
        usuarioAlvoId: a.usuarioId,
        destinatarios: [a.usuarioId],
        detalhe: `${eu.nome} alterou a data de retorno da sua ausência: de ${dataBr(a.retorno)} para ${dataBr(retorno)}${motivo ? `. Motivo: ${motivo}` : ""}.`,
        agora,
      });
    }
    return nome;
  });
  await auditar(deps, eu, { id }, nome, "prorrogacao", `Alterou a data de retorno da ausência de ${nome} para ${dataBr(retorno)}`, { retorno, motivo: motivo ?? null });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

/**
 * O supervisor encerra a ausência a qualquer momento, assinando. O supervisor ausente encerra a própria em emergência
 * (`emergencia`), sem esperar a data nem ninguém.
 */
export async function encerrarAusencia(deps: Deps, eu: UsuarioAutenticado, id: string, motivo?: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const { nome, forma } = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirSupervisorDaEquipe(eu, a);
    exigirEstado(a, hoje, ["confirmada"]);
    const assinatura = assinaturaDe(eu);
    const forma: AusenciaFormaDeEncerramento = a.usuarioId === eu.id && a.inicio <= hoje ? "emergencia" : "supervisor";
    await encerrar(tx, a, forma, eu.id, agora);
    await gravarAto(tx, { ausenciaId: id, tipo: "encerramento", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { forma, motivo: motivo ?? null } });
    const nome = await nomeDe(tx, a.usuarioId);
    if (a.usuarioId !== eu.id) {
      await avisarAusencia(tx, {
        tipo: "ausencia_alterada",
        ausenciaId: id,
        usuarioAlvoId: a.usuarioId,
        destinatarios: [a.usuarioId],
        detalhe: `${eu.nome} encerrou a sua ausência${motivo ? `. Motivo: ${motivo}` : ""}.`,
        agora,
      });
    }
    return { nome, forma };
  });
  await auditar(deps, eu, { id }, nome, "encerramento", `${forma === "emergencia" ? "Encerrou a própria ausência em emergência" : `Encerrou a ausência de ${nome}`}`, { forma, motivo: motivo ?? null });
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

/** O ausente confirma, assinando, o retorno depois da data: a conta volta ao normal na hora. */
export async function confirmarRetornoDaAusencia(deps: Deps, eu: UsuarioAutenticado, id: string) {
  const agora = deps.agora();
  const hoje = diaDe(agora);
  const nome = await deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const a = await carregar(tx, eu, id);
    exigirDaPessoa(eu, a);
    exigirEstado(a, hoje, ["confirmada"]);
    if (a.retorno > hoje) throw conflito("ausencia_nao_vencida", `O retorno é em ${dataBr(a.retorno)}: antes disso só o supervisor encerra a ausência, ou o fim antecipado é pedido`);
    const assinatura = assinaturaDe(eu);
    await encerrar(tx, a, "retorno", eu.id, agora);
    await gravarAto(tx, { ausenciaId: id, tipo: "retorno", autorId: eu.id, agora, assinaturaPath: assinatura, dados: { retorno: a.retorno } });
    return nomeDe(tx, a.usuarioId);
  });
  await auditar(deps, eu, { id }, nome, "retorno", `${nome} confirmou o retorno da ausência`);
  return { ausencia: await detalharAusencia(deps.db, eu, id, agora) };
}

