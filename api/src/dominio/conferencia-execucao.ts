import { and, asc, desc, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import {
  AVISAR_FALTANTES_EM_HORAS,
  CONFERENCIA_EM_ABERTO,
  CONFERENCIA_ESPERANDO_DADOS,
  ESCOLHA_DESCARTAR,
  LIBERAR_FECHAMENTO_EM_MS,
  LIMITE_DA_CONFERENCIA_MS,
  type CampoDaConferencia,
  type ConferenciaDaApi,
  type ConferenciaDaOs,
  type ConferenciaResumo,
  type ResultadoDaExecucao,
  type VersaoDeAutor,
} from "../../../shared/api/conferencia-execucao";
import type { Db } from "../db/conexao";
import { aprParticipante, conferenciaAssinatura, conferenciaDecisao, conferenciaExecucao, eventoCampo, execucao, execucaoPausa, execucaoPedido, os, usuario } from "../db/schema";
import { conflito, invalido, naoEncontrado, proibido } from "../http/erros";
import { podeSupervisionarEquipe, type UsuarioAutenticado } from "../http/autenticacao";
import { criarAviso, destinatariosDaEquipe } from "./alertas";
import { participantesDaApr } from "./apr-assinaturas";
import { assinaturaDoAto } from "./assinatura";
import { compararVersoes, escolhaValida, responsavelDaConferencia, tipoDaComparacao, type CanonicoDaExecucao } from "./conferencia-comparacao";
import { recalcularStatusOs } from "./status-os";

/**
 * A conferência da execução (execução compartilhada, etapa 3; `docs/operacao-de-campo.md`, seção 6.6): o que a equipe
 * registrou sem sinal, em aparelhos diferentes, vira um registro só, decidido pelo responsável e assinado pela equipe.
 *
 * O caminho de uma conferência:
 * 1. **Nasce** quando a execução termina e algum registro dela veio sem sinal ou ficou como versão de outro aparelho
 *    (`evento_campo.offline` ou `so_versao`). Tudo online, nada a conferir.
 * 2. **Espera todos sincronizarem.** Só compara quando cada participante que usa o app sincronizou depois do fim, com a fila daquela OS vazia.
 * 3. **Monta**: uma versão por autor; valores dentro da tolerância valem como o mesmo; fotos somam. Sem diferença, é um `resumo` (ciência);
 *    com diferença, `com_divergencia`: o responsável escolhe horários e pausas, o supervisor o resultado.
 * 4. **Aplica** a escolha nas tabelas da execução (o que valia antes fica no `snapshot`) e pede **ciência ou assinatura** dos demais.
 * 5. **Fecha** quando todos assinaram, ou com o que existe (a partir de 72 h pelo responsável ou supervisor; aos 7 dias, sozinha).
 * O que chega depois de a conferência montar fica guardado como "chegou tarde" no `evento_campo` e não altera o que foi decidido.
 */

type Conferencia = typeof conferenciaExecucao.$inferSelect;
type Execucao = typeof execucao.$inferSelect;

interface Snapshot {
  versoes: VersaoDeAutor[];
  campos: CampoDaConferencia[];
  /** O que a execução tinha antes de a escolha ser aplicada (auditoria). */
  canonico_antes: { inicio: string; fim: string | null; resultado: string | null; executor_id: string; finalizada_por: string | null; pausas: { id: string; inicio: string; fim: string | null; motivo: string | null; complemento: string | null }[] } | null;
}

const TIPOS_DA_EXECUCAO = ["execucao_iniciada", "pausa_iniciada", "pausa_encerrada", "execucao_encerrada", "execucao_suspensa", "execucao_interrompida", "pedido_aberto", "encerramento_assinado"] as const;

const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const rotuloDaOs = (o: { numeroOrdem: string | null; titulo: string }) => `OS ${o.numeroOrdem ?? o.titulo}`;
const iso = (d: Date) => d.toISOString();

// ---------------------------------------------------------------------------------------------------------------
// As versões

/** O que cada autor registrou da execução, montado dos eventos dele (`evento_campo.execucao_id`), do mais antigo ao mais novo. */
export async function montarVersoes(db: Db, execucaoId: string): Promise<VersaoDeAutor[]> {
  const eventos = await db
    .select({
      id: eventoCampo.id,
      usuarioId: eventoCampo.usuarioId,
      nome: usuario.nome,
      tipo: eventoCampo.tipo,
      payload: eventoCampo.payload,
      offline: eventoCampo.offline,
      soVersao: eventoCampo.soVersao,
    })
    .from(eventoCampo)
    .innerJoin(usuario, eq(usuario.id, eventoCampo.usuarioId))
    .where(and(eq(eventoCampo.execucaoId, execucaoId), inArray(eventoCampo.tipo, [...TIPOS_DA_EXECUCAO])))
    .orderBy(asc(eventoCampo.ocorridoEm), asc(eventoCampo.recebidoEm));

  // O pedido que passou pela aprovação do responsável vale pelo que a tabela diz; o que foi aplicado direto (sem sinal, ou por saúde) não tem linha.
  const idsDePedido = eventos.filter((e) => e.tipo === "pedido_aberto").map((e) => texto((e.payload as Record<string, unknown>).id)).filter((x): x is string => !!x);
  const pedidos = idsDePedido.length ? await db.select({ id: execucaoPedido.id, estado: execucaoPedido.estado }).from(execucaoPedido).where(inArray(execucaoPedido.id, idsDePedido)) : [];
  const estadoDoPedido = new Map(pedidos.map((p) => [p.id, p.estado]));

  const porAutor = new Map<string, VersaoDeAutor>();
  const versaoDe = (e: (typeof eventos)[number]) => {
    let v = porAutor.get(e.usuarioId);
    if (!v) {
      v = { autor_id: e.usuarioId, autor_nome: e.nome, inicio: null, fim: null, resultado: null, motivo: null, complemento: null, pausas: [], evidencias: 0, sem_sinal: false };
      porAutor.set(e.usuarioId, v);
    }
    if (e.offline || e.soVersao) v.sem_sinal = true;
    return v;
  };
  const termina = (v: VersaoDeAutor, fim: string | null, resultado: ResultadoDaExecucao, motivo: string | null, complemento: string | null) => {
    if (!fim) return;
    v.fim = fim;
    v.resultado = resultado;
    v.motivo = motivo;
    v.complemento = complemento;
  };

  for (const e of eventos) {
    const p = e.payload as Record<string, unknown>;
    const v = versaoDe(e);
    switch (e.tipo) {
      case "execucao_iniciada":
        v.inicio = texto(p.inicio);
        break;
      case "pausa_iniciada": {
        const id = texto(p.id);
        const inicio = texto(p.inicio);
        if (id && inicio) v.pausas.push({ id, inicio, fim: null, motivo: texto(p.motivo), complemento: texto(p.complemento) });
        break;
      }
      case "pausa_encerrada": {
        const pausa = v.pausas.find((x) => x.id === p.pausa_id);
        if (pausa && !pausa.fim) pausa.fim = texto(p.fim);
        break;
      }
      case "execucao_encerrada":
        termina(v, texto(p.fim), "encerrada", null, null);
        break;
      case "execucao_suspensa":
        termina(v, texto(p.fim), "suspensa", texto(p.motivo), texto(p.complemento));
        break;
      case "execucao_interrompida":
        termina(v, texto(p.fim), "interrompida", texto(p.motivo), null);
        break;
      case "pedido_aberto": {
        const estado = estadoDoPedido.get(texto(p.id) ?? "");
        if (estado && estado !== "aprovado" && estado !== "aprovado_por_prazo") break;
        if (p.tipo === "encerrar") termina(v, texto(p.instante), "encerrada", null, null);
        else termina(v, texto(p.instante), "suspensa", texto(p.motivo), texto(p.complemento));
        break;
      }
      case "encerramento_assinado":
        v.evidencias += Array.isArray(p.evidencias) ? p.evidencias.length : 0;
        break;
    }
  }
  return [...porAutor.values()];
}

type PausaGravada = { id: string; inicio: string; fim: string | null; motivo: string | null; complemento: string | null };

async function canonicoDe(db: Db, e: Execucao): Promise<CanonicoDaExecucao & { pausasCompletas: PausaGravada[] }> {
  const pausas = await db.select().from(execucaoPausa).where(eq(execucaoPausa.execucaoId, e.id)).orderBy(asc(execucaoPausa.inicio));
  const completas = pausas.map((p) => ({ id: p.id, inicio: iso(p.inicio), fim: p.fim ? iso(p.fim) : null, motivo: p.motivo, complemento: p.complemento }));
  return {
    inicio: iso(e.inicio),
    fim: e.fim ? iso(e.fim) : null,
    resultado: e.resultado === "cancelada" ? null : e.resultado,
    finalizadaPor: e.finalizadaPor,
    pausas: completas.map(({ id, inicio, fim }) => ({ id, inicio, fim })),
    pausasCompletas: completas,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Quem participa, quem sincronizou

/** Quem ficou na APR da execução (não recusou) e continua ativo: são eles que a conferência espera, e quem a assina (a conta desativada não trava ninguém). */
async function participantesAtivos(db: Db, aprId: string) {
  const ficaram = (await participantesDaApr(db, aprId)).filter((p) => !p.recusouEm);
  if (ficaram.length === 0) return ficaram;
  const ativos = new Set((await db.select({ id: usuario.id }).from(usuario).where(and(inArray(usuario.id, ficaram.map((p) => p.usuarioId)), eq(usuario.ativo, true)))).map((u) => u.id));
  return ficaram.filter((p) => ativos.has(p.usuarioId));
}

/**
 * Quem ainda não sincronizou depois do fim da execução, com a fila daquela OS vazia. Quem nunca baixou a cópia do app (`ultima_sincronizacao_em`
 * nulo) não tem fila offline a esperar: já está em dia.
 */
async function faltamSincronizar(db: Db, e: Execucao, ids: string[]): Promise<string[]> {
  if (ids.length === 0 || !e.fim) return [];
  const linhas = await db.select({ id: usuario.id, ultima: usuario.ultimaSincronizacaoEm, fila: usuario.filaNaSincronizacao }).from(usuario).where(inArray(usuario.id, ids));
  return linhas.filter((u) => u.ultima && (u.ultima < e.fim! || (u.fila?.[e.osId] ?? 0) > 0)).map((u) => u.id);
}

const nomesDe = async (db: Db, ids: string[]) => new Map((ids.length ? await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids)) : []).map((u) => [u.id, u.nome]));

/** O supervisor da equipe (e o representante, se estiver no comando) ou, sem ninguém, os administradores. */
const supervisoresDa = async (db: Db, equipeId: string) => (await destinatariosDaEquipe(db, equipeId)).map((d) => d.id);

// ---------------------------------------------------------------------------------------------------------------
// O avanço

async function precisaDeConferencia(db: Db, execucaoId: string): Promise<boolean> {
  const [x] = await db
    .select({ id: eventoCampo.id })
    .from(eventoCampo)
    .where(and(eq(eventoCampo.execucaoId, execucaoId), or(eq(eventoCampo.offline, true), eq(eventoCampo.soVersao, true))))
    .limit(1);
  return !!x;
}

interface Saida {
  /** Os avisos criados (a resposta do envio de eventos os devolve). */
  alertas?: string[];
}

async function avisar(db: Db, destinatarios: Iterable<string>, tipo: Parameters<typeof criarAviso>[2]["tipo"], osId: string, detalhe: string, agora: Date, saida?: Saida) {
  const ids = await criarAviso(db, destinatarios, { tipo, osId, detalhe, agora });
  saida?.alertas?.push(...ids);
}

/**
 * Faz a conferência da execução andar tanto quanto der: cria a conferência (se a execução terminou com registros sem sinal) e passa de
 * um estado ao outro enquanto a condição do próximo estiver cumprida. Idempotente: pode ser chamada a cada evento, a cada sincronização
 * e a cada hora. `db` pode ser a transação do evento.
 */
export async function avancarConferencia(db: Db, execucaoId: string, agora: Date, saida?: Saida): Promise<void> {
  const [e] = await db.select().from(execucao).where(eq(execucao.id, execucaoId));
  if (!e || !e.fim || !e.resultado || e.resultado === "cancelada") return;

  let [conf] = await db.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.execucaoId, execucaoId));
  if (!conf) {
    if (!(await precisaDeConferencia(db, execucaoId))) return;
    const [nova] = await db
      .insert(conferenciaExecucao)
      .values({ execucaoId, criadaEm: agora, liberaFecharEm: new Date(agora.getTime() + LIBERAR_FECHAMENTO_EM_MS), limiteEm: new Date(agora.getTime() + LIMITE_DA_CONFERENCIA_MS) })
      .onConflictDoNothing()
      .returning();
    if (!nova) return;
    conf = nova;
    const [ordem] = await db.select().from(os).where(eq(os.id, e.osId));
    const participantes = await participantesAtivos(db, e.aprId);
    await avisar(
      db,
      participantes.map((p) => p.usuarioId),
      "conferencia_aberta",
      e.osId,
      `${rotuloDaOs(ordem!)}: parte da execução foi registrada sem sinal, em aparelhos diferentes. Sincronize o aparelho: quando todos sincronizarem, o sistema compara os registros e a equipe confere.`,
      agora,
      saida,
    );
  }

  // Trava a linha: o evento, a sincronização e a tarefa de hora em hora podem chegar juntos.
  [conf] = await db.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, conf!.id)).for("update");
  for (let passo = 0; passo < 4 && conf && CONFERENCIA_EM_ABERTO.includes(conf.estado); passo++) {
    const venceu = agora >= conf.limiteEm;
    if (conf.estado === "aguardando_sincronizacao") {
      const faltam = await faltamSincronizar(db, e, (await participantesAtivos(db, e.aprId)).map((p) => p.usuarioId));
      if (faltam.length > 0 && !venceu) break;
      await montar(db, conf, e, faltam, agora, saida);
    } else if (conf.estado === "aguardando_responsavel") {
      if (!venceu) break;
      await aplicarPeloPadrao(db, conf, e, null, agora, saida);
    } else {
      if (await todosAssinaram(db, conf, e)) await encerrarConferencia(db, conf, "concluida", null, agora);
      else if (venceu) await fecharSemTodos(db, conf, e, null, agora, saida);
      else break;
    }
    [conf] = await db.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, conf.id));
  }
}

/** Passa pelas execuções da OS que terminaram e avança a conferência de cada uma (o que cada evento processado faz). */
export async function avancarConferenciasDaOs(db: Db, osId: string, agora: Date, saida?: Saida): Promise<void> {
  const finalizadas = await db
    .select({ id: execucao.id })
    .from(execucao)
    .where(and(eq(execucao.osId, osId), isNotNull(execucao.resultado), ne(execucao.resultado, "cancelada")));
  for (const { id } of finalizadas) await avancarConferencia(db, id, agora, saida);
}

/** O que `POST /sync/pull` faz: anota que a pessoa sincronizou (e quanto ficou na fila, por OS) e faz andar as conferências que a esperavam. */
export async function registrarSincronizacao(db: Db, usuarioId: string, fila: { os_id: string; quantos: number }[], agora: Date): Promise<void> {
  const porOs: Record<string, number> = {};
  for (const f of fila) porOs[f.os_id] = (porOs[f.os_id] ?? 0) + f.quantos;
  await db.update(usuario).set({ ultimaSincronizacaoEm: agora, filaNaSincronizacao: porOs }).where(eq(usuario.id, usuarioId));
  const esperando = await db
    .select({ execucaoId: conferenciaExecucao.execucaoId })
    .from(conferenciaExecucao)
    .innerJoin(execucao, eq(execucao.id, conferenciaExecucao.execucaoId))
    .innerJoin(aprParticipante, and(eq(aprParticipante.aprId, execucao.aprId), eq(aprParticipante.usuarioId, usuarioId)))
    .where(eq(conferenciaExecucao.estado, "aguardando_sincronizacao"));
  for (const { execucaoId } of esperando) await db.transaction((tx) => avancarConferencia(tx as unknown as Db, execucaoId, agora));
}

// ---------------------------------------------------------------------------------------------------------------
// A montagem

/**
 * Monta a conferência: compara as versões, marca o tipo e o responsável, e segue (o resumo já vai para a ciência; o que diverge espera a
 * escolha). `faltaramSincronizar` é quem não sincronizou até aqui (o prazo liberou o fechamento).
 */
async function montar(db: Db, conf: Conferencia, e: Execucao, faltaramSincronizar: string[], agora: Date, saida?: Saida) {
  const versoes = await montarVersoes(db, e.id);
  const responsavelId = responsavelDaConferencia(versoes, e.executorId, iso(e.inicio));
  const canonico = await canonicoDe(db, e);
  const campos = compararVersoes(versoes, responsavelId, canonico);
  const tipo = tipoDaComparacao(campos);
  const snapshot: Snapshot = { versoes, campos, canonico_antes: null };
  await db
    .update(conferenciaExecucao)
    .set({ tipo, snapshot, responsavelId, montadaEm: agora, faltaram: { sincronizar: faltaramSincronizar, assinar: [] } })
    .where(eq(conferenciaExecucao.id, conf.id));
  const [ordem] = await db.select().from(os).where(eq(os.id, e.osId));

  if (tipo === "resumo") {
    await aplicarEscolhas(db, { ...conf, tipo, responsavelId }, e, snapshot, new Map(), null, agora);
    await entrarEmAssinaturas(db, conf.id, e, responsavelId, "resumo", agora, saida);
    return;
  }
  await db.update(conferenciaExecucao).set({ estado: "aguardando_responsavel" }).where(eq(conferenciaExecucao.id, conf.id));
  const doSupervisor = campos.some((c) => c.divergente && c.decide === "supervisor");
  await avisar(
    db,
    [responsavelId, ...(doSupervisor ? await supervisoresDa(db, ordem!.equipeId) : [])],
    "conferencia_para_decidir",
    e.osId,
    `${rotuloDaOs(ordem!)}: os aparelhos da equipe registraram a execução de jeitos diferentes. Escolha a versão certa de cada diferença${doSupervisor ? " (o resultado é do supervisor)" : ""}.`,
    agora,
    saida,
  );
}

/** A conferência foi decidida: pede a ciência (resumo) ou a assinatura (com divergência) de todos, menos do responsável. */
async function entrarEmAssinaturas(db: Db, conferenciaId: string, e: Execucao, responsavelId: string, tipo: "resumo" | "com_divergencia", agora: Date, saida?: Saida) {
  const devem = (await participantesAtivos(db, e.aprId)).filter((p) => p.usuarioId !== responsavelId);
  if (devem.length === 0) {
    const [conf] = await db.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, conferenciaId));
    await encerrarConferencia(db, conf!, "concluida", null, agora);
    return;
  }
  await db.update(conferenciaExecucao).set({ estado: "aguardando_assinaturas" }).where(eq(conferenciaExecucao.id, conferenciaId));
  const [ordem] = await db.select().from(os).where(eq(os.id, e.osId));
  await avisar(
    db,
    devem.map((p) => p.usuarioId),
    "conferencia_para_assinar",
    e.osId,
    tipo === "resumo"
      ? `${rotuloDaOs(ordem!)}: confira o resumo do que a equipe registrou da execução e dê a sua ciência.`
      : `${rotuloDaOs(ordem!)}: o responsável escolheu as versões da execução. Confira e assine (ou assine com ressalva).`,
    agora,
    saida,
  );
}

const aprovadores = async (db: Db, e: Execucao) => {
  const [ordem] = await db.select().from(os).where(eq(os.id, e.osId));
  return { ordem: ordem!, supervisores: await supervisoresDa(db, ordem!.equipeId) };
};

/** Quem deve dar ciência ou assinar: os participantes que ficaram na APR, menos o responsável. */
async function quemDeveAssinar(db: Db, conf: Conferencia, e: Execucao): Promise<string[]> {
  return (await participantesAtivos(db, e.aprId)).filter((p) => p.usuarioId !== conf.responsavelId).map((p) => p.usuarioId);
}

async function todosAssinaram(db: Db, conf: Conferencia, e: Execucao): Promise<boolean> {
  const devem = await quemDeveAssinar(db, conf, e);
  if (devem.length === 0) return true;
  const feitas = await db.select({ usuarioId: conferenciaAssinatura.usuarioId }).from(conferenciaAssinatura).where(eq(conferenciaAssinatura.conferenciaId, conf.id));
  const assinaram = new Set(feitas.map((a) => a.usuarioId));
  return devem.every((id) => assinaram.has(id));
}

async function encerrarConferencia(db: Db, conf: Conferencia, estado: "concluida" | "fechada_sem_todos", fechadaPor: string | null, agora: Date, faltaram?: { sincronizar: string[]; assinar: string[] }) {
  await db
    .update(conferenciaExecucao)
    .set({ estado, fechadaEm: agora, fechadaPor, ...(faltaram ? { faltaram } : {}) })
    .where(eq(conferenciaExecucao.id, conf.id));
}

/** Fecha com o que existe: quem não deu a ciência ou não assinou fica registrado, e a conferência acaba. */
async function fecharSemTodos(db: Db, conf: Conferencia, e: Execucao, fechadaPor: string | null, agora: Date, saida?: Saida) {
  const devem = await quemDeveAssinar(db, conf, e);
  const feitas = await db.select({ usuarioId: conferenciaAssinatura.usuarioId }).from(conferenciaAssinatura).where(eq(conferenciaAssinatura.conferenciaId, conf.id));
  const assinaram = new Set(feitas.map((a) => a.usuarioId));
  const faltaramAssinar = devem.filter((id) => !assinaram.has(id));
  const antes = (conf.faltaram as { sincronizar: string[] } | null)?.sincronizar ?? [];
  await encerrarConferencia(db, conf, faltaramAssinar.length === 0 ? "concluida" : "fechada_sem_todos", fechadaPor, agora, { sincronizar: antes, assinar: faltaramAssinar });
  if (fechadaPor === null && (faltaramAssinar.length > 0 || antes.length > 0)) await avisarTempoEsgotado(db, conf, e, agora, saida);
}

async function avisarTempoEsgotado(db: Db, conf: Conferencia, e: Execucao, agora: Date, saida?: Saida) {
  const { ordem, supervisores } = await aprovadores(db, e);
  await avisar(
    db,
    [...supervisores, ...(conf.responsavelId ? [conf.responsavelId] : [])],
    "conferencia_tempo_esgotado",
    e.osId,
    `${rotuloDaOs(ordem)}: a conferência da execução passou de 7 dias e foi fechada sozinha, com o que existia (o padrão sugerido onde faltou escolha). Quem não sincronizou ou não assinou consta no relatório da execução.`,
    agora,
    saida,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// A escolha e a aplicação

/**
 * O padrão sugerido para o que ninguém escolheu (a conclusão mais antiga, a pausa do responsável), aplicado quando o prazo acaba ou
 * quando o responsável ou o supervisor fecha com o que existe. `decididaPor` nulo = o prazo de 7 dias.
 */
async function aplicarPeloPadrao(db: Db, conf: Conferencia, e: Execucao, decididaPor: string | null, agora: Date, saida?: Saida) {
  const snapshot = conf.snapshot as Snapshot;
  const jaDecididos = await db.select().from(conferenciaDecisao).where(eq(conferenciaDecisao.conferenciaId, conf.id));
  const escolhas = new Map(jaDecididos.map((d) => [d.campo, d.escolha]));
  for (const c of snapshot.campos) if (c.divergente && !escolhas.has(c.campo)) escolhas.set(c.campo, c.sugerido);
  await aplicarEscolhas(db, conf, e, snapshot, escolhas, decididaPor, agora);
  await entrarEmAssinaturas(db, conf.id, e, conf.responsavelId!, "com_divergencia", agora, saida);
}

/**
 * Grava a escolha nas tabelas da execução. O que não diverge fica como está (só se desfaz a pausa duplicada que dois aparelhos registraram
 * ao mesmo tempo); o que diverge vale pelo autor escolhido. Troca o responsável quando quem começou primeiro não é quem a execução
 * tem. O que valia antes fica no `snapshot`, e o status da OS é recalculado.
 */
async function aplicarEscolhas(db: Db, conf: Conferencia, e: Execucao, snapshot: Snapshot, escolhas: Map<string, string>, decididaPor: string | null, agora: Date) {
  const antes = await canonicoDe(db, e);
  const versao = (autor: string) => snapshot.versoes.find((v) => v.autor_id === autor);
  const mudancas: Partial<typeof execucao.$inferInsert> = {};

  const escolhaDe = (campo: CampoDaConferencia) => (campo.divergente ? (escolhas.get(campo.campo) ?? campo.sugerido) : null);
  const inicio = snapshot.campos.find((c) => c.campo === "inicio");
  const fim = snapshot.campos.find((c) => c.campo === "fim");
  const resultado = snapshot.campos.find((c) => c.campo === "resultado");

  const autorDoInicio = inicio && escolhaDe(inicio);
  if (autorDoInicio && versao(autorDoInicio)?.inicio) mudancas.inicio = new Date(versao(autorDoInicio)!.inicio!);
  const autorDoFim = fim && escolhaDe(fim);
  if (autorDoFim && versao(autorDoFim)?.fim) mudancas.fim = new Date(versao(autorDoFim)!.fim!);
  const autorDoResultado = resultado && escolhaDe(resultado);
  const v = autorDoResultado ? versao(autorDoResultado) : undefined;
  if (v?.resultado && v.resultado !== e.resultado) {
    mudancas.resultado = v.resultado;
    mudancas.finalizadaPor = v.autor_id;
    mudancas.motivo = v.resultado === "interrompida" ? (v.motivo ?? "Interrompida (conferência)") : null;
    mudancas.suspensaoMotivo = v.resultado === "suspensa" ? ((v.motivo as Execucao["suspensaoMotivo"]) ?? null) : null;
    mudancas.suspensaoComplemento = v.resultado === "suspensa" ? v.complemento : null;
    if (!mudancas.fim && v.fim) mudancas.fim = new Date(v.fim);
  }
  if (conf.responsavelId && conf.responsavelId !== e.executorId) mudancas.executorId = conf.responsavelId;
  // A execução não termina antes de começar (a escolha pode juntar o início de um aparelho com o fim de outro).
  const novoInicio = mudancas.inicio ?? e.inicio;
  const novoFim = mudancas.fim ?? e.fim;
  if (novoFim && novoFim < novoInicio) mudancas.fim = novoInicio;
  if (Object.keys(mudancas).length > 0) await db.update(execucao).set(mudancas).where(eq(execucao.id, e.id));

  // As pausas: cada grupo (a mesma parada vista por aparelhos diferentes) fica com uma linha só, a do autor escolhido.
  const fimDaExecucao = (mudancas.fim ?? e.fim) as Date | null;
  const gravadas = await db.select().from(execucaoPausa).where(eq(execucaoPausa.execucaoId, e.id));
  for (const campo of snapshot.campos.filter((c) => c.campo.startsWith("pausa:"))) {
    const ids = new Set(campo.opcoes.map((o) => o.pausa_id).filter((x): x is string => !!x));
    const doGrupo = gravadas.filter((p) => ids.has(p.id));
    const escolha = campo.divergente ? (escolhas.get(campo.campo) ?? campo.sugerido) : null;
    if (escolha === ESCOLHA_DESCARTAR) {
      if (doGrupo.length > 0) await db.delete(execucaoPausa).where(inArray(execucaoPausa.id, doGrupo.map((p) => p.id)));
      continue;
    }
    // Sem divergência: fica a linha que já existe (a do autor sugerido, se for dele; senão a primeira); só se desfaz a duplicada.
    const autor = escolha ?? campo.sugerido;
    const opcao = campo.opcoes.find((o) => o.autor_id === autor) ?? campo.opcoes[0]!;
    const manter = campo.divergente ? opcao.pausa_id : (doGrupo.find((p) => p.id === opcao.pausa_id)?.id ?? doGrupo[0]?.id ?? null);
    const sobra = doGrupo.filter((p) => p.id !== manter);
    if (sobra.length > 0) await db.delete(execucaoPausa).where(inArray(execucaoPausa.id, sobra.map((p) => p.id)));
    if (!campo.divergente || !opcao.pausa_id || !opcao.instante) continue;
    const inicioDaPausa = new Date(opcao.instante);
    const fimDaPausa = opcao.fim ? new Date(opcao.fim) : (fimDaExecucao ?? inicioDaPausa);
    const valores = { inicio: inicioDaPausa, fim: fimDaPausa < inicioDaPausa ? inicioDaPausa : fimDaPausa, motivo: versao(autor)?.pausas.find((x) => x.id === opcao.pausa_id)?.motivo as (typeof execucaoPausa.$inferInsert)["motivo"], complemento: versao(autor)?.pausas.find((x) => x.id === opcao.pausa_id)?.complemento ?? null };
    if (doGrupo.some((p) => p.id === opcao.pausa_id)) await db.update(execucaoPausa).set(valores).where(eq(execucaoPausa.id, opcao.pausa_id));
    else await db.insert(execucaoPausa).values({ id: opcao.pausa_id, execucaoId: e.id, ...valores, iniciadaPor: autor, encerradaPor: autor });
  }

  await db
    .update(conferenciaExecucao)
    .set({
      snapshot: { ...snapshot, canonico_antes: { inicio: antes.inicio, fim: antes.fim, resultado: antes.resultado, executor_id: e.executorId, finalizada_por: e.finalizadaPor, pausas: antes.pausasCompletas } },
      aplicadaEm: agora,
      decididaPor,
      decididaEm: agora,
    })
    .where(eq(conferenciaExecucao.id, conf.id));
  await recalcularStatusOs(db, e.osId);
}

/** Os campos que pedem escolha e ainda não têm. */
const camposSemEscolha = (snapshot: Snapshot, decididos: Set<string>) => snapshot.campos.filter((c) => c.divergente && !decididos.has(c.campo));

export interface EscolhaRecebida {
  campo: string;
  escolha: string;
}

/**
 * O responsável (horários e pausas) e o supervisor (o resultado) escolhem a versão certa de cada diferença. O supervisor também escolhe o
 * que é do responsável depois de `LIBERAR_FECHAMENTO_EM_MS` (o responsável pode ser quem não sincronizou). Quando todas as diferenças têm escolha,
 * ela é gravada na execução e a equipe é chamada a assinar.
 */
export async function decidirConferencia(db: Db, eu: UsuarioAutenticado, conferenciaId: string, escolhas: EscolhaRecebida[], agora: Date, saida?: Saida) {
  await db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [conf] = await tx.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, conferenciaId)).for("update");
    if (!conf) throw naoEncontrado("Conferência não encontrada");
    const [e] = await tx.select().from(execucao).where(eq(execucao.id, conf.execucaoId));
    const [ordem] = await tx.select().from(os).where(eq(os.id, e!.osId));
    const supervisiona = podeSupervisionarEquipe(eu, ordem!.equipeId);
    if (conf.estado !== "aguardando_responsavel") throw conflito("conferencia_fora_da_escolha", "Esta conferência não está esperando escolhas");
    const snapshot = conf.snapshot as Snapshot;
    if (escolhas.length === 0) throw invalido("escolhas_vazias", "Escolha ao menos uma diferença");
    const decididos = new Set((await tx.select({ campo: conferenciaDecisao.campo }).from(conferenciaDecisao).where(eq(conferenciaDecisao.conferenciaId, conf.id))).map((d) => d.campo));

    for (const { campo: chave, escolha } of escolhas) {
      const campo = snapshot.campos.find((c) => c.campo === chave);
      if (!campo || !campo.divergente) throw invalido("campo_sem_divergencia", `"${chave}" não pede escolha`);
      if (!escolhaValida(campo, escolha)) throw invalido("escolha_invalida", `Escolha inválida para "${campo.rotulo}"`);
      const pode = campo.decide === "supervisor" ? supervisiona : eu.id === conf.responsavelId || (supervisiona && agora >= conf.liberaFecharEm);
      if (!pode) throw proibido(campo.decide === "supervisor" ? "O resultado da execução é escolhido pelo supervisor" : "Os horários e as pausas são escolhidos pelo responsável da execução");
    }
    for (const { campo, escolha } of escolhas) {
      await tx
        .insert(conferenciaDecisao)
        .values({ conferenciaId: conf.id, campo, escolha, decididaPor: eu.id, decididaEm: agora })
        .onConflictDoUpdate({ target: [conferenciaDecisao.conferenciaId, conferenciaDecisao.campo], set: { escolha, decididaPor: eu.id, decididaEm: agora } });
      decididos.add(campo);
    }
    if (camposSemEscolha(snapshot, decididos).length > 0) return;

    const todas = new Map((await tx.select().from(conferenciaDecisao).where(eq(conferenciaDecisao.conferenciaId, conf.id))).map((d) => [d.campo, d.escolha]));
    await aplicarEscolhas(tx, conf, e!, snapshot, todas, eu.id, agora);
    await entrarEmAssinaturas(tx, conf.id, e!, conf.responsavelId!, "com_divergencia", agora, saida);
  });
}

/**
 * A ciência (resumo) ou a assinatura (com divergência) de um participante. A ressalva é opcional: não trava nada, vai ao supervisor com
 * aviso e ao relatório. O responsável não assina a própria conferência. Quando o último assina, a conferência está concluída.
 */
export async function assinarConferencia(db: Db, eu: UsuarioAutenticado, conferenciaId: string, ressalva: string | null, agora: Date, saida?: Saida) {
  await db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [conf] = await tx.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, conferenciaId)).for("update");
    if (!conf) throw naoEncontrado("Conferência não encontrada");
    const [e] = await tx.select().from(execucao).where(eq(execucao.id, conf.execucaoId));
    if (conf.estado !== "aguardando_assinaturas") throw conflito("conferencia_fora_das_assinaturas", "Esta conferência não está esperando ciências ou assinaturas");
    const devem = await quemDeveAssinar(tx, conf, e!);
    if (!devem.includes(eu.id)) throw proibido(eu.id === conf.responsavelId ? "O responsável escolheu as versões: quem assina são os demais participantes" : "Só os participantes da execução dão a ciência ou assinam");
    const tipo = conf.tipo === "resumo" ? "ciencia" : "assinatura";
    const assinaturaPath = tipo === "assinatura" ? assinaturaDoAto(eu) : null;
    const texto = ressalva?.trim() || null;
    const inserida = await tx
      .insert(conferenciaAssinatura)
      .values({ conferenciaId: conf.id, usuarioId: eu.id, tipo, assinaturaPath, ressalva: texto, assinadaEm: agora })
      .onConflictDoNothing()
      .returning({ usuarioId: conferenciaAssinatura.usuarioId });
    if (inserida.length === 0) return;
    if (texto) {
      const { ordem, supervisores } = await aprovadores(tx, e!);
      await avisar(
        tx,
        [...supervisores, ...(conf.responsavelId ? [conf.responsavelId] : [])].filter((id) => id !== eu.id),
        "conferencia_ressalva",
        e!.osId,
        `${rotuloDaOs(ordem)}: ${eu.nome} ${tipo === "ciencia" ? "deu ciência" : "assinou"} a conferência da execução com ressalva: "${texto}".`,
        agora,
        saida,
      );
    }
    if (await todosAssinaram(tx, conf, e!)) await encerrarConferencia(tx, conf, "concluida", null, agora);
  });
}

/** Quem pode "fechar com o que existe" agora: o responsável (antes da montagem, quem a execução tem gravado) ou o supervisor, depois de `LIBERAR_FECHAMENTO_EM_MS`. */
const podeFechar = (eu: UsuarioAutenticado, conf: Conferencia, e: Pick<Execucao, "executorId">, equipeId: string, agora: Date) =>
  CONFERENCIA_EM_ABERTO.includes(conf.estado) && agora >= conf.liberaFecharEm && (eu.id === (conf.responsavelId ?? e.executorId) || podeSupervisionarEquipe(eu, equipeId));

/**
 * "Fechar com o que existe", a partir de 72 h: no passo em que a conferência está, segue sem quem falta (sem os que não sincronizaram, com
 * o padrão sugerido onde não houve escolha, sem as assinaturas que faltam), e registra quem faltou.
 */
export async function fecharConferencia(db: Db, eu: UsuarioAutenticado, conferenciaId: string, agora: Date, saida?: Saida) {
  await db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [conf] = await tx.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, conferenciaId)).for("update");
    if (!conf) throw naoEncontrado("Conferência não encontrada");
    const [e] = await tx.select().from(execucao).where(eq(execucao.id, conf.execucaoId));
    const [ordem] = await tx.select().from(os).where(eq(os.id, e!.osId));
    if (!CONFERENCIA_EM_ABERTO.includes(conf.estado)) throw conflito("conferencia_ja_fechada", "Esta conferência já terminou");
    if (!podeFechar(eu, conf, e!, ordem!.equipeId, agora)) {
      if (agora < conf.liberaFecharEm) throw conflito("fechamento_ainda_nao_liberado", "A conferência só pode ser fechada com o que existe depois de 72 horas");
      throw proibido("Só o responsável pela execução ou o supervisor fecha a conferência");
    }
    if (conf.estado === "aguardando_sincronizacao") {
      const faltam = await faltamSincronizar(tx, e!, (await participantesAtivos(tx, e!.aprId)).map((p) => p.usuarioId));
      await montar(tx, conf, e!, faltam, agora, saida);
    } else if (conf.estado === "aguardando_responsavel") {
      await aplicarPeloPadrao(tx, conf, e!, eu.id, agora, saida);
    } else {
      await fecharSemTodos(tx, conf, e!, eu.id, agora, saida);
    }
  });
}

// ---------------------------------------------------------------------------------------------------------------
// A tarefa de hora em hora

/**
 * Confere os prazos de todas as conferências em aberto: faz cada uma andar (aos 7 dias, sozinha) e avisa, às 24 h e às 48 h, quem ainda
 * falta (sincronizar, escolher ou assinar) e o responsável. Idempotente (`avisada_24h_em` e `avisada_48h_em` evitam repetir).
 */
export async function conferirConferencias(db: Db, agora: Date): Promise<number> {
  const abertas = await db.select().from(conferenciaExecucao).where(inArray(conferenciaExecucao.estado, [...CONFERENCIA_EM_ABERTO]));
  let avisadas = 0;
  for (const c of abertas) {
    await db.transaction(async (t) => {
      const tx = t as unknown as Db;
      await avancarConferencia(tx, c.execucaoId, agora);
      const [conf] = await tx.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, c.id));
      if (!conf || !CONFERENCIA_EM_ABERTO.includes(conf.estado)) return;
      const horas = (agora.getTime() - conf.criadaEm.getTime()) / 3_600_000;
      const [limite24, limite48] = AVISAR_FALTANTES_EM_HORAS;
      const passouDe48 = horas >= limite48 && !conf.avisada48hEm;
      const passouDe24 = horas >= limite24 && !conf.avisada24hEm;
      if (!passouDe24 && !passouDe48) return;

      const [e] = await tx.select().from(execucao).where(eq(execucao.id, conf.execucaoId));
      const { ordem } = await aprovadores(tx, e!);
      const ativos = await participantesAtivos(tx, e!.aprId);
      let faltam: string[];
      let oQue: string;
      if (conf.estado === "aguardando_sincronizacao") {
        faltam = await faltamSincronizar(tx, e!, ativos.map((p) => p.usuarioId));
        oQue = "sincronizar o aparelho";
      } else if (conf.estado === "aguardando_responsavel") {
        faltam = conf.responsavelId ? [conf.responsavelId] : [];
        oQue = "escolher as versões da execução";
      } else {
        const feitas = new Set((await tx.select({ usuarioId: conferenciaAssinatura.usuarioId }).from(conferenciaAssinatura).where(eq(conferenciaAssinatura.conferenciaId, conf.id))).map((a) => a.usuarioId));
        faltam = (await quemDeveAssinar(tx, conf, e!)).filter((id) => !feitas.has(id));
        oQue = conf.tipo === "resumo" ? "dar ciência" : "assinar";
      }
      if (faltam.length > 0) {
        const nomes = await nomesDe(tx, faltam);
        const faltaDe = faltam.map((id) => nomes.get(id) ?? "—").join(", ");
        const prazo = Math.max(0, Math.ceil((conf.limiteEm.getTime() - agora.getTime()) / 86_400_000));
        await avisar(tx, faltam, "conferencia_cobranca", e!.osId, `${rotuloDaOs(ordem)}: a conferência da execução espera você para ${oQue}. Ela fecha sozinha em ${prazo} ${prazo === 1 ? "dia" : "dias"}.`, agora);
        if (conf.responsavelId && !faltam.includes(conf.responsavelId)) {
          await avisar(tx, [conf.responsavelId], "conferencia_cobranca", e!.osId, `${rotuloDaOs(ordem)}: a conferência da execução ainda espera ${faltaDe} (${oQue}).`, agora);
        }
        avisadas++;
      }
      await tx
        .update(conferenciaExecucao)
        .set({ ...(passouDe24 || passouDe48 ? { avisada24hEm: conf.avisada24hEm ?? agora } : {}), ...(passouDe48 ? { avisada48hEm: agora } : {}) })
        .where(eq(conferenciaExecucao.id, conf.id));
    });
  }
  return avisadas;
}

// ---------------------------------------------------------------------------------------------------------------
// As leituras

/** As conferências da OS (a mais recente por execução): o detalhe da OS as mostra. */
export async function conferenciasDaOs(db: Db, osId: string): Promise<ConferenciaDaOs[]> {
  const linhas = await db
    .select({ id: conferenciaExecucao.id, execucaoId: conferenciaExecucao.execucaoId, estado: conferenciaExecucao.estado, tipo: conferenciaExecucao.tipo })
    .from(conferenciaExecucao)
    .innerJoin(execucao, eq(execucao.id, conferenciaExecucao.execucaoId))
    .where(eq(execucao.osId, osId))
    .orderBy(asc(conferenciaExecucao.criadaEm));
  return linhas.map((l) => ({ id: l.id, execucao_id: l.execucaoId, estado: l.estado, tipo: l.tipo }));
}

/** A OS tem conferência que ainda não comparou as versões: o supervisor espera para assinar por último (os dados ainda podem mudar). */
export async function conferenciaEsperandoDados(db: Db, osId: string): Promise<boolean> {
  const [x] = await db
    .select({ id: conferenciaExecucao.id })
    .from(conferenciaExecucao)
    .innerJoin(execucao, eq(execucao.id, conferenciaExecucao.execucaoId))
    .where(and(eq(execucao.osId, osId), inArray(conferenciaExecucao.estado, [...CONFERENCIA_ESPERANDO_DADOS])))
    .limit(1);
  return !!x;
}

/** A conferência inteira, como a tela a mostra, e o que quem olha pode fazer. Só os participantes e a supervisão da equipe a leem. */
export async function lerConferencia(db: Db, eu: UsuarioAutenticado, conferenciaId: string, agora: Date): Promise<ConferenciaDaApi> {
  const [conf] = await db.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.id, conferenciaId));
  if (!conf) throw naoEncontrado("Conferência não encontrada");
  const [e] = await db.select().from(execucao).where(eq(execucao.id, conf.execucaoId));
  const [ordem] = await db.select().from(os).where(eq(os.id, e!.osId));
  const participantes = await participantesAtivos(db, e!.aprId);
  const souParticipante = participantes.some((p) => p.usuarioId === eu.id);
  const supervisiona = podeSupervisionarEquipe(eu, ordem!.equipeId);
  if (!souParticipante && !supervisiona) throw naoEncontrado("Conferência não encontrada");

  const decisoes = await db.select().from(conferenciaDecisao).where(eq(conferenciaDecisao.conferenciaId, conf.id)).orderBy(asc(conferenciaDecisao.decididaEm));
  const assinaturas = await db.select().from(conferenciaAssinatura).where(eq(conferenciaAssinatura.conferenciaId, conf.id));
  const ids = [...new Set([...(conf.responsavelId ? [conf.responsavelId] : []), ...(conf.fechadaPor ? [conf.fechadaPor] : []), ...decisoes.map((d) => d.decididaPor).filter((x): x is string => !!x), ...participantes.map((p) => p.usuarioId)])];
  const nomes = await nomesDe(db, ids);
  const nome = (id: string) => ({ id, nome: nomes.get(id) ?? "—" });
  const faltamSync = new Set(CONFERENCIA_ESPERANDO_DADOS.includes(conf.estado) || conf.estado === "aguardando_assinaturas" ? await faltamSincronizar(db, e!, participantes.map((p) => p.usuarioId)) : []);
  const devem = new Set(conf.estado === "aguardando_sincronizacao" || !conf.responsavelId ? [] : await quemDeveAssinar(db, conf, e!));
  const snapshot = (conf.snapshot as Snapshot | null) ?? null;
  const decididos = new Set(decisoes.map((d) => d.campo));
  const faltaEscolher = conf.estado === "aguardando_responsavel" && snapshot ? camposSemEscolha(snapshot, decididos) : [];
  const podeDoResponsavel = eu.id === conf.responsavelId || (supervisiona && agora >= conf.liberaFecharEm);
  const jaAssinei = assinaturas.some((a) => a.usuarioId === eu.id);
  const faltaram = conf.faltaram as { sincronizar: string[]; assinar: string[] } | null;

  return {
    id: conf.id,
    execucao_id: conf.execucaoId,
    os: { id: ordem!.id, numero_ordem: ordem!.numeroOrdem, titulo: ordem!.titulo },
    estado: conf.estado,
    tipo: conf.tipo,
    criada_em: iso(conf.criadaEm),
    libera_fechar_em: iso(conf.liberaFecharEm),
    limite_em: iso(conf.limiteEm),
    montada_em: conf.montadaEm ? iso(conf.montadaEm) : null,
    responsavel: conf.responsavelId ? nome(conf.responsavelId) : null,
    versoes: snapshot?.versoes ?? [],
    campos: snapshot?.campos ?? [],
    decisoes: decisoes.map((d) => ({ campo: d.campo, escolha: d.escolha, decidida_por: d.decididaPor ? nome(d.decididaPor) : null, decidida_em: iso(d.decididaEm) })),
    participantes: participantes.map((p) => {
      const a = assinaturas.find((x) => x.usuarioId === p.usuarioId);
      return {
        usuario: nome(p.usuarioId),
        sincronizou: !faltamSync.has(p.usuarioId),
        deve_assinar: devem.has(p.usuarioId),
        assinatura: a ? { tipo: a.tipo, ressalva: a.ressalva, assinada_em: iso(a.assinadaEm) } : null,
      };
    }),
    faltaram: faltaram ? { sincronizar: faltaram.sincronizar.map((id) => nomes.get(id) ?? "—"), assinar: faltaram.assinar.map((id) => nomes.get(id) ?? "—") } : null,
    fechada_em: conf.fechadaEm ? iso(conf.fechadaEm) : null,
    fechada_por: conf.fechadaPor ? nome(conf.fechadaPor) : null,
    eu: {
      participante: souParticipante,
      pode_decidir: faltaEscolher.filter((c) => (c.decide === "supervisor" ? supervisiona : podeDoResponsavel)).map((c) => c.campo),
      deve_assinar: conf.estado === "aguardando_assinaturas" && devem.has(eu.id) && !jaAssinei,
      pode_fechar: podeFechar(eu, conf, e!, ordem!.equipeId, agora),
    },
  };
}

/**
 * "Para conferir": as conferências em aberto de quem pergunta (participante, responsável ou supervisor), com o que falta dele. Quem só
 * espera os outros também vê, para acompanhar.
 */
export async function minhasConferencias(db: Db, eu: UsuarioAutenticado, agora: Date): Promise<ConferenciaResumo[]> {
  const linhas = await db
    .select({ conf: conferenciaExecucao, e: execucao, o: os })
    .from(conferenciaExecucao)
    .innerJoin(execucao, eq(execucao.id, conferenciaExecucao.execucaoId))
    .innerJoin(os, eq(os.id, execucao.osId))
    .where(inArray(conferenciaExecucao.estado, [...CONFERENCIA_EM_ABERTO]))
    .orderBy(desc(conferenciaExecucao.criadaEm));
  const saida: ConferenciaResumo[] = [];
  for (const { conf, e, o } of linhas) {
    const participantes = await participantesAtivos(db, e.aprId);
    const souParticipante = participantes.some((p) => p.usuarioId === eu.id);
    const supervisiona = podeSupervisionarEquipe(eu, o.equipeId);
    if (!souParticipante && !supervisiona) continue;

    let acao: ConferenciaResumo["minha_acao"] = "aguardar";
    if (conf.estado === "aguardando_responsavel") {
      const snapshot = conf.snapshot as Snapshot;
      const decididos = new Set((await db.select({ campo: conferenciaDecisao.campo }).from(conferenciaDecisao).where(eq(conferenciaDecisao.conferenciaId, conf.id))).map((d) => d.campo));
      const pendentes = camposSemEscolha(snapshot, decididos);
      if (pendentes.some((c) => (c.decide === "supervisor" ? supervisiona : eu.id === conf.responsavelId || (supervisiona && agora >= conf.liberaFecharEm)))) acao = "decidir";
    } else if (conf.estado === "aguardando_assinaturas" && (await quemDeveAssinar(db, conf, e)).includes(eu.id)) {
      const [feita] = await db.select({ u: conferenciaAssinatura.usuarioId }).from(conferenciaAssinatura).where(and(eq(conferenciaAssinatura.conferenciaId, conf.id), eq(conferenciaAssinatura.usuarioId, eu.id)));
      if (!feita) acao = conf.tipo === "resumo" ? "ciencia" : "assinar";
    }
    if (acao === "aguardar" && podeFechar(eu, conf, e, o.equipeId, agora)) acao = "fechar";
    saida.push({ id: conf.id, execucao_id: e.id, os: { id: o.id, numero_ordem: o.numeroOrdem, titulo: o.titulo }, estado: conf.estado, tipo: conf.tipo, criada_em: iso(conf.criadaEm), limite_em: iso(conf.limiteEm), minha_acao: acao });
  }
  return saida;
}

/** O que a conferência traz para o relatório da execução: o tipo, o que foi escolhido, as ciências, as ressalvas e quem faltou. */
export async function dadosDaConferenciaParaRelatorio(db: Db, execucaoId: string) {
  const [conf] = await db.select().from(conferenciaExecucao).where(eq(conferenciaExecucao.execucaoId, execucaoId));
  if (!conf) return null;
  const decisoes = await db.select().from(conferenciaDecisao).where(eq(conferenciaDecisao.conferenciaId, conf.id));
  const assinaturas = await db.select().from(conferenciaAssinatura).where(eq(conferenciaAssinatura.conferenciaId, conf.id)).orderBy(asc(conferenciaAssinatura.assinadaEm));
  const faltaram = conf.faltaram as { sincronizar: string[]; assinar: string[] } | null;
  const ids = [...new Set([...(conf.responsavelId ? [conf.responsavelId] : []), ...(conf.decididaPor ? [conf.decididaPor] : []), ...(conf.fechadaPor ? [conf.fechadaPor] : []), ...decisoes.map((d) => d.decididaPor).filter((x): x is string => !!x), ...assinaturas.map((a) => a.usuarioId), ...(faltaram?.sincronizar ?? []), ...(faltaram?.assinar ?? [])])];
  const nomes = await nomesDe(db, ids);
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? "—") : null);
  const snapshot = (conf.snapshot as Snapshot | null) ?? null;
  return {
    conf,
    snapshot,
    responsavel: nome(conf.responsavelId),
    decididaPor: nome(conf.decididaPor),
    fechadaPor: nome(conf.fechadaPor),
    decisoes: decisoes.map((d) => ({ campo: d.campo, escolha: d.escolha, por: nome(d.decididaPor), em: d.decididaEm })),
    assinaturas: assinaturas.map((a) => ({ nome: nome(a.usuarioId)!, tipo: a.tipo, ressalva: a.ressalva, em: a.assinadaEm })),
    faltaramSincronizar: (faltaram?.sincronizar ?? []).map((id) => nome(id)!),
    faltaramAssinar: (faltaram?.assinar ?? []).map((id) => nome(id)!),
    nomeDoAutor: (id: string) => nome(id) ?? "—",
  };
}

export type DadosDaConferencia = NonNullable<Awaited<ReturnType<typeof dadosDaConferenciaParaRelatorio>>>;
