import { and, asc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/conexao";
import { ausencia, equipe, usuario, type MotivoDaRepresentacao } from "../db/schema";
import { avisarAdmins, criarAviso, resolverAvisos } from "./alertas";
import { registrarAuditoria } from "./auditoria";
import { dataBr, diaDe } from "./tempo";

/**
 * O representante da equipe: um membro dela que substitui o supervisor quando ele não está. Toda equipe com gente tem um
 * (a `api` escolhe quando falta) para não faltar quem responda se o supervisor sumir de repente.
 *
 * O representante assume **sozinho**, sem o supervisor designar ninguém na hora, por três motivos:
 * - `sem_supervisor`: a equipe não tem supervisor, ou o dela foi desativado (desligado no registro de funcionários, por exemplo);
 *   os administradores recebem o aviso `equipe_sem_supervisor` para escolher um;
 * - `ausencia`: o supervisor tem uma ausência registrada, em curso ou vencida (a mesma que o deixa só em consulta);
 * - `inatividade`: o supervisor passou `DIAS_SEM_ATIVIDADE` dias sem usar o sistema, sem ter registrado ausência.
 *
 * Enquanto está no comando, o representante tem as ações de supervisão da equipe (`UsuarioAutenticado.equipesSupervisionadas`),
 * menos as que só o titular faz (registrar a própria ausência e a ausência do supervisor). Ele volta a ser só técnico no instante
 * em que o supervisor confirma o retorno, encerra a ausência ou volta a usar o sistema, ou em que a equipe ganha um supervisor.
 */
export const DIAS_SEM_ATIVIDADE = 3;

/** A atividade do usuário é anotada no máximo a cada tanto, para não gravar a cada chamada. */
export const INTERVALO_DA_ATIVIDADE_MIN = 5;

const DIA_MS = 86_400_000;

export interface RepresentacaoEmVigor {
  equipeId: string;
  representanteId: string;
  /** Nulo na equipe sem supervisor. */
  supervisorId: string | null;
  motivo: MotivoDaRepresentacao;
}

/**
 * O motivo de o representante estar no comando agora, ou `null` quando o supervisor responde pela equipe. `supervisor` nulo é a
 * equipe sem supervisor que responda (nenhum, ou um desativado).
 */
export function motivoDaRepresentacao(supervisor: { ausente: boolean; ultimaAtividadeEm: Date } | null, agora: Date): MotivoDaRepresentacao | null {
  if (!supervisor) return "sem_supervisor";
  if (supervisor.ausente) return "ausencia";
  return agora.getTime() - supervisor.ultimaAtividadeEm.getTime() >= DIAS_SEM_ATIVIDADE * DIA_MS ? "inatividade" : null;
}

/** As equipes (de todas, ou só das pedidas) cujo representante deve estar no comando em `agora`. Quem calcula é a data, nada fica gravado aqui. */
export async function representacoesEmVigor(
  db: Db,
  agora: Date,
  filtro: { equipeIds?: string[]; representanteId?: string } = {},
): Promise<RepresentacaoEmVigor[]> {
  if (filtro.equipeIds && filtro.equipeIds.length === 0) return [];
  const supervisor = alias(usuario, "supervisor_da_equipe");
  const representante = alias(usuario, "representante_da_equipe");
  const hoje = diaDe(agora);
  const linhas = await db
    .select({
      equipeId: equipe.id,
      representanteId: representante.id,
      supervisorId: supervisor.id,
      supervisorValido: sql<boolean>`coalesce(${supervisor.ativo} and ${supervisor.liberacao} = 'liberado', false)`,
      ultimaAtividadeEm: supervisor.ultimaAtividadeEm,
      ausente: sql<boolean>`exists (select 1 from ${ausencia} where ${ausencia.usuarioId} = ${supervisor.id} and ${ausencia.estado} = 'confirmada' and ${ausencia.inicio} <= ${hoje})`,
    })
    .from(equipe)
    .leftJoin(supervisor, eq(supervisor.id, equipe.supervisorId))
    .innerJoin(representante, eq(representante.id, equipe.representanteId))
    .where(
      and(
        eq(representante.ativo, true),
        eq(representante.liberacao, "liberado"),
        filtro.equipeIds ? inArray(equipe.id, filtro.equipeIds) : undefined,
        filtro.representanteId ? eq(representante.id, filtro.representanteId) : undefined,
      ),
    );
  const vigor: RepresentacaoEmVigor[] = [];
  for (const l of linhas) {
    const motivo = motivoDaRepresentacao(l.supervisorValido && l.ultimaAtividadeEm ? { ausente: l.ausente, ultimaAtividadeEm: l.ultimaAtividadeEm } : null, agora);
    if (motivo) vigor.push({ equipeId: l.equipeId, representanteId: l.representanteId, supervisorId: l.supervisorValido ? l.supervisorId : null, motivo });
  }
  return vigor;
}

/** Quem pode ser representante: técnico ativo e liberado da equipe, que não é o supervisor dela. */
const elegivel = (equipeId: string, supervisorId: string | null): SQL =>
  and(
    eq(usuario.equipeId, equipeId),
    eq(usuario.ativo, true),
    eq(usuario.liberacao, "liberado"),
    eq(usuario.perfil, "tecnico"),
    supervisorId ? sql`${usuario.id} <> ${supervisorId}` : undefined,
  )!;

/** Erro de quem designa: o escolhido não pode representar a equipe. Devolve o motivo, ou `null` quando serve. */
export async function motivoDeNaoPoderRepresentar(db: Db, equipeId: string, usuarioId: string): Promise<string | null> {
  const [e] = await db.select({ supervisorId: equipe.supervisorId }).from(equipe).where(eq(equipe.id, equipeId));
  if (!e) return "Equipe não encontrada";
  if (e.supervisorId === usuarioId) return "O supervisor não pode ser o representante da própria equipe";
  const [u] = await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.id, usuarioId), elegivel(equipeId, e.supervisorId)));
  return u ? null : "O representante precisa ser um técnico ativo e liberado da própria equipe";
}

/**
 * Mantém o "toda equipe tem um representante": para cada equipe (todas, ou as pedidas), confere se o representante ainda serve
 * (ativo, liberado, da equipe, não é o supervisor) e, se faltar ou deixou de servir, escolhe o membro elegível mais antigo
 * (conta sem data de cadastro primeiro, depois pelo nome). Sem membro elegível, fica sem. Trocar o representante enquanto ele
 * está no comando zera o estado gravado, e a conferência seguinte avisa o novo. Devolve as equipes que mudaram.
 */
export async function garantirRepresentantes(db: Db, equipeIds?: string[]): Promise<string[]> {
  const equipes = await db
    .select({ id: equipe.id, supervisorId: equipe.supervisorId, representanteId: equipe.representanteId })
    .from(equipe)
    .where(equipeIds ? (equipeIds.length ? inArray(equipe.id, equipeIds) : sql`false`) : undefined);
  const mudadas: string[] = [];
  for (const e of equipes) {
    const [atual] = e.representanteId ? await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.id, e.representanteId), elegivel(e.id, e.supervisorId))) : [];
    if (atual) continue;
    const [escolhido] = await db
      .select({ id: usuario.id })
      .from(usuario)
      .where(elegivel(e.id, e.supervisorId))
      .orderBy(sql`${usuario.criadoEm} asc nulls first`, asc(usuario.nome), asc(usuario.id))
      .limit(1);
    if ((escolhido?.id ?? null) === e.representanteId) continue;
    await db.update(equipe).set({ representanteId: escolhido?.id ?? null, representacaoDesde: null, representacaoMotivo: null }).where(eq(equipe.id, e.id));
    mudadas.push(e.id);
  }
  return mudadas;
}

const SISTEMA = { id: null, nome: "Sistema" } as const;

/** O motivo, na frase de quem fala do supervisor: "Fulano está ausente" / "Fulano ficou 3 dias sem usar o sistema" / "a equipe está sem supervisor". */
const frase = (motivo: MotivoDaRepresentacao, supervisor: string) =>
  motivo === "sem_supervisor"
    ? "a equipe está sem supervisor"
    : motivo === "ausencia"
      ? `${supervisor} está ausente`
      : `${supervisor} ficou ${DIAS_SEM_ATIVIDADE} dias sem usar o sistema`;

async function avisar(db: Db, dados: { tipo: "representacao_iniciada" | "representacao_encerrada"; equipeId: string; destinatario: string | null; detalhe: string; agora: Date }) {
  if (!dados.destinatario) return;
  await criarAviso(db, [dados.destinatario], { tipo: dados.tipo, equipeId: dados.equipeId, detalhe: dados.detalhe, agora: dados.agora });
}

const nomeDe = async (db: Db, usuarioId: string | null) =>
  usuarioId ? ((await db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, usuarioId)))[0]?.nome ?? "") : "";

/**
 * Confere as equipes (todas com representante ou com a representação gravada, ou só as pedidas) e grava as mudanças de "quem
 * responde": quando o representante assume ou devolve a equipe, anota o instante e o motivo e avisa o representante e o
 * supervisor pelo sino, uma vez só. Idempotente. Chamada pela tarefa de hora em hora e, para valer na hora, quando a ausência
 * do supervisor muda ou quando ele volta a usar o sistema.
 */
export async function sincronizarRepresentacao(db: Db, agora: Date, equipeIds?: string[]): Promise<{ iniciadas: number; encerradas: number }> {
  const resultado = { iniciadas: 0, encerradas: 0 };
  if (equipeIds && equipeIds.length === 0) return resultado;
  const vigor = new Map((await representacoesEmVigor(db, agora, { equipeIds })).map((r) => [r.equipeId, r]));
  const candidatas = await db
    .select({ id: equipe.id })
    .from(equipe)
    .where(and(or(isNotNull(equipe.representanteId), isNotNull(equipe.representacaoDesde)), equipeIds ? inArray(equipe.id, equipeIds) : undefined));

  for (const { id } of candidatas) {
    const v = vigor.get(id);
    const feito = await db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      const [e] = await tx.select().from(equipe).where(eq(equipe.id, id)).for("update");
      if (!e) return null;

      if (v && !e.representacaoDesde) {
        await tx.update(equipe).set({ representacaoDesde: agora, representacaoMotivo: v.motivo }).where(eq(equipe.id, id));
        const supervisor = await nomeDe(tx, v.supervisorId);
        const representante = await nomeDe(tx, v.representanteId);
        const semSupervisor = v.motivo === "sem_supervisor";
        await avisar(tx, {
          tipo: "representacao_iniciada",
          equipeId: id,
          destinatario: v.representanteId,
          detalhe: semSupervisor
            ? `Você assumiu a supervisão da equipe ${e.nome}: a equipe está sem supervisor. Até o administrador escolher um, você faz o que o supervisor faz pela equipe.`
            : `Você assumiu a supervisão da equipe ${e.nome}: ${frase(v.motivo, supervisor)}. Até ele voltar, você faz o que o supervisor faz pela equipe.`,
          agora,
        });
        // Na equipe sem supervisor não há a quem avisar: os administradores recebem `equipe_sem_supervisor` (`avisarEquipesSemSupervisor`).
        if (!semSupervisor) {
          await avisar(tx, {
            tipo: "representacao_iniciada",
            equipeId: id,
            destinatario: v.supervisorId,
            detalhe: `${representante} assumiu a supervisão da equipe ${e.nome} (${frase(v.motivo, "você")}) e devolve a equipe quando você voltar.`,
            agora,
          });
        }
        return { tipo: "iniciada" as const, equipe: e.nome, supervisor, representante, motivo: v.motivo };
      }
      if (v && e.representacaoMotivo !== v.motivo) {
        // Mesmo representante no comando, por outro motivo (o supervisor registrou ausência depois de dias parado): não avisa de novo.
        await tx.update(equipe).set({ representacaoMotivo: v.motivo }).where(eq(equipe.id, id));
        return null;
      }
      if (!v && e.representacaoDesde) {
        await tx.update(equipe).set({ representacaoDesde: null, representacaoMotivo: null }).where(eq(equipe.id, id));
        const supervisor = await nomeDe(tx, e.supervisorId);
        const representante = await nomeDe(tx, e.representanteId);
        // A equipe que estava sem supervisor ganhou um: ele não "volta", assume.
        const novoSupervisor = e.representacaoMotivo === "sem_supervisor";
        await avisar(tx, {
          tipo: "representacao_encerrada",
          equipeId: id,
          destinatario: e.representanteId,
          detalhe: novoSupervisor
            ? `A equipe ${e.nome} ganhou um supervisor, ${supervisor}: você deixa de responder por ela.`
            : `A supervisão da equipe ${e.nome} voltou para ${supervisor}: você deixa de responder por ela.`,
          agora,
        });
        await avisar(tx, {
          tipo: "representacao_encerrada",
          equipeId: id,
          destinatario: e.supervisorId,
          detalhe: novoSupervisor
            ? `Você é o supervisor da equipe ${e.nome}. ${representante || "O representante"}, que respondia por ela enquanto a equipe estava sem supervisor, deixou de responder.`
            : `${representante || "O representante"} deixou de responder pela equipe ${e.nome}: a supervisão voltou para você.`,
          agora,
        });
        return { tipo: "encerrada" as const, equipe: e.nome, supervisor, representante, motivo: e.representacaoMotivo! };
      }
      return null;
    });
    if (!feito) continue;
    if (feito.tipo === "iniciada") resultado.iniciadas++;
    else resultado.encerradas++;
    await registrarAuditoria(db, SISTEMA, {
      entidade: "equipe",
      verbo: feito.tipo === "iniciada" ? "representacao_iniciada" : "representacao_encerrada",
      entidadeId: id,
      alvo: feito.equipe,
      resumo:
        feito.tipo === "iniciada"
          ? `${feito.representante} assumiu a supervisão da equipe ${feito.equipe} (${frase(feito.motivo, feito.supervisor)})`
          : feito.motivo === "sem_supervisor"
            ? `${feito.supervisor} assumiu a supervisão da equipe ${feito.equipe}, que estava sem supervisor`
            : `${feito.supervisor} retomou a supervisão da equipe ${feito.equipe}`,
      detalhes: { motivo: feito.motivo },
    });
  }
  return resultado;
}

/** As equipes que o supervisor chefia e que estão, agora, nas mãos do representante (é o que o supervisor encerra ao voltar a usar o sistema). */
export async function equipesComRepresentacaoGravada(db: Db, supervisorId: string): Promise<string[]> {
  const linhas = await db.select({ id: equipe.id }).from(equipe).where(and(eq(equipe.supervisorId, supervisorId), isNotNull(equipe.representacaoDesde)));
  return linhas.map((l) => l.id);
}

/** Texto curto para a faixa e as telas: "o supervisor está ausente até 03/11" / "ficou 3 dias sem usar o sistema" / "a equipe está sem supervisor". */
export const rotuloDoMotivo = (motivo: MotivoDaRepresentacao, retorno?: string | null) =>
  motivo === "sem_supervisor"
    ? "a equipe está sem supervisor"
    : motivo === "ausencia"
      ? `o supervisor está ausente${retorno ? ` até ${dataBr(retorno)}` : ""}`
      : `o supervisor ficou ${DIAS_SEM_ATIVIDADE} dias sem usar o sistema`;

/**
 * Avisa os administradores, uma vez só, da equipe que ficou sem supervisor (nenhum, ou um desativado) e que tem gente: o
 * representante responde por ela, mas é o admin quem escolhe o supervisor. Quando a equipe ganha um supervisor ativo, a marca
 * volta a nulo e os avisos ainda não lidos saem do "não lido". Idempotente. Devolve quantas equipes foram avisadas.
 */
export async function avisarEquipesSemSupervisor(db: Db, agora: Date, equipeIds?: string[]): Promise<number> {
  if (equipeIds && equipeIds.length === 0) return 0;
  const supervisor = alias(usuario, "supervisor_da_equipe");
  const representante = alias(usuario, "representante_da_equipe");
  const equipes = await db
    .select({
      id: equipe.id,
      nome: equipe.nome,
      supervisorId: equipe.supervisorId,
      supervisorNome: supervisor.nome,
      supervisorValido: sql<boolean>`coalesce(${supervisor.ativo} and ${supervisor.liberacao} = 'liberado', false)`,
      representanteNome: representante.nome,
      representanteValido: sql<boolean>`coalesce(${representante.ativo} and ${representante.liberacao} = 'liberado', false)`,
      avisadoEm: equipe.semSupervisorAvisadoEm,
      membros: sql<number>`(select count(*)::int from ${usuario} where ${usuario.equipeId} = ${equipe.id} and ${usuario.ativo} and ${usuario.liberacao} = 'liberado')`,
    })
    .from(equipe)
    .leftJoin(supervisor, eq(supervisor.id, equipe.supervisorId))
    .leftJoin(representante, eq(representante.id, equipe.representanteId))
    .where(equipeIds ? inArray(equipe.id, equipeIds) : undefined);

  let avisadas = 0;
  for (const e of equipes) {
    if (e.supervisorValido) {
      if (e.avisadoEm) {
        await db.update(equipe).set({ semSupervisorAvisadoEm: null }).where(eq(equipe.id, e.id));
        await resolverAvisos(db, { tipos: ["equipe_sem_supervisor"], equipeId: e.id }, agora);
      }
      continue;
    }
    // A equipe vazia não tem ninguém esperando por um supervisor (a OS dela vai para os administradores).
    if (e.avisadoEm || e.membros === 0) continue;
    const feito = await db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      const [marcada] = await tx
        .update(equipe)
        .set({ semSupervisorAvisadoEm: agora })
        .where(and(eq(equipe.id, e.id), isNull(equipe.semSupervisorAvisadoEm)))
        .returning({ id: equipe.id });
      if (!marcada) return false;
      const porque = e.supervisorId ? `o supervisor dela, ${e.supervisorNome ?? "a pessoa"}, foi desativado` : "ela não tem supervisor";
      const quem =
        e.representanteValido && e.representanteNome
          ? `${e.representanteNome}, o representante, responde por ela até você escolher um supervisor na tela da equipe.`
          : "Ninguém responde por ela até você escolher um supervisor na tela da equipe.";
      await avisarAdmins(tx, { tipo: "equipe_sem_supervisor", equipeId: e.id, detalhe: `A equipe ${e.nome} está sem supervisor: ${porque}. ${quem}`, agora });
      return true;
    });
    if (feito) avisadas++;
  }
  return avisadas;
}

/**
 * Tudo o que mantém "quem responde por cada equipe" em dia, na ordem: o representante de cada equipe, quem está no comando
 * agora (e os avisos de quem assumiu ou devolveu) e o aviso aos administradores das equipes sem supervisor. Chamada depois de
 * qualquer mudança em pessoas ou equipes (cadastro, liberação, desativação, troca de supervisor) e pela tarefa de hora em hora.
 */
export async function atualizarSupervisaoDasEquipes(db: Db, agora: Date, equipeIds?: string[]): Promise<void> {
  await garantirRepresentantes(db, equipeIds);
  await sincronizarRepresentacao(db, agora, equipeIds);
  await avisarEquipesSemSupervisor(db, agora, equipeIds);
}
