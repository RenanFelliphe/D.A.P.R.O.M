import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { alerta, apr, aprParticipante, execucao, localInstalacao, os, usuario } from "../db/schema";
import { diaDe, inicioDoDia } from "./tempo";

/** A APR exige ao menos 2 participantes: ninguém trabalha sozinho (Reunião 1 e 3). Não há máximo. */
export const MIN_PARTICIPANTES = 2;

export interface ParticipanteDaApr {
  usuarioId: string;
  nome: string;
  funcao: "responsavel" | "executor";
  assinou: boolean;
  /** A assinatura foi dada no aparelho do responsável (contingência offline), não na conta da pessoa. */
  presencial: boolean;
  assinadaEm: Date | null;
  recusouEm: Date | null;
  recusaMotivo: string | null;
}

/** Os participantes de uma APR, na ordem: o responsável primeiro, depois por nome. */
export async function participantesDaApr(db: Db, aprId: string): Promise<ParticipanteDaApr[]> {
  const linhas = await db
    .select({
      usuarioId: aprParticipante.usuarioId,
      nome: usuario.nome,
      funcao: aprParticipante.funcao,
      assinaturaPath: aprParticipante.assinaturaPath,
      presencial: aprParticipante.assinaturaPresencial,
      assinadaEm: aprParticipante.assinadaEm,
      recusouEm: aprParticipante.recusouEm,
      recusaMotivo: aprParticipante.recusaMotivo,
    })
    .from(aprParticipante)
    .innerJoin(usuario, eq(usuario.id, aprParticipante.usuarioId))
    .where(eq(aprParticipante.aprId, aprId));
  return linhas
    .map(({ assinaturaPath, ...l }) => ({ ...l, assinou: assinaturaPath !== null }))
    .sort((a, b) => Number(b.funcao === "responsavel") - Number(a.funcao === "responsavel") || a.nome.localeCompare(b.nome));
}

export interface SituacaoDasAssinaturas {
  /** Quem continua na APR: os que não recusaram. */
  ativos: ParticipanteDaApr[];
  recusaram: ParticipanteDaApr[];
  /** Os ativos que ainda não assinaram. */
  faltam: ParticipanteDaApr[];
  /** O responsável recusou: a APR não tem como seguir, é preciso uma nova. */
  responsavelRecusou: boolean;
  /** Restam participantes demais para o mínimo (`MIN_PARTICIPANTES`). */
  semParticipantes: boolean;
  /** Dá para iniciar a execução: o mínimo de participantes, o responsável na APR e todos os que ficaram assinaram. */
  pronta: boolean;
}

export function situacaoDasAssinaturas(participantes: ParticipanteDaApr[]): SituacaoDasAssinaturas {
  const ativos = participantes.filter((p) => !p.recusouEm);
  const recusaram = participantes.filter((p) => p.recusouEm);
  const faltam = ativos.filter((p) => !p.assinou);
  const responsavelRecusou = recusaram.some((p) => p.funcao === "responsavel");
  const semParticipantes = ativos.length < MIN_PARTICIPANTES;
  return { ativos, recusaram, faltam, responsavelRecusou, semParticipantes, pronta: !responsavelRecusou && !semParticipantes && faltam.length === 0 };
}

/** O aviso "APR aguardando a sua assinatura" some do não lido quando a pessoa assina ou recusa. */
export async function resolverAvisoDeAssinatura(db: Db, usuarioId: string, osId: string, agora: Date) {
  await db
    .update(alerta)
    .set({ lidoEm: agora })
    .where(and(eq(alerta.tipo, "apr_para_assinar"), eq(alerta.destinatarioId, usuarioId), eq(alerta.osId, osId), isNull(alerta.lidoEm)));
}

/**
 * As APRs aprovadas de hoje que esperam a assinatura desta pessoa (`GET /me/aprs-para-assinar`): ela é participante, não assinou nem
 * recusou, e a execução ainda não começou. A APR de outro dia não vale mais (é preciso uma nova), então não entra.
 */
export async function aprsParaAssinar(db: Db, usuarioId: string, agora: Date) {
  const linhas = await db
    .select({
      aprId: apr.id,
      osId: os.id,
      numeroOrdem: os.numeroOrdem,
      titulo: os.titulo,
      localCodigo: localInstalacao.codigo,
      concluidaEm: apr.concluidaEm,
      preenchidaPor: apr.preenchidaPor,
      funcao: aprParticipante.funcao,
    })
    .from(aprParticipante)
    .innerJoin(apr, eq(apr.id, aprParticipante.aprId))
    .innerJoin(os, eq(os.id, apr.osId))
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(
      and(
        eq(aprParticipante.usuarioId, usuarioId),
        isNull(aprParticipante.assinadaEm),
        isNull(aprParticipante.recusouEm),
        eq(apr.resultado, "aprovada"),
        gte(apr.concluidaEm, inicioDoDia(diaDe(agora))),
        sql`not exists (select 1 from ${execucao} where ${execucao.aprId} = ${apr.id} and ${execucao.resultado} is distinct from 'cancelada')`,
      ),
    )
    .orderBy(desc(apr.concluidaEm));
  if (linhas.length === 0) return [];
  const nomes = new Map((await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, [...new Set(linhas.map((l) => l.preenchidaPor))]))).map((u) => [u.id, u.nome]));
  return linhas.map((l) => ({ ...l, preenchidaPorNome: nomes.get(l.preenchidaPor) ?? "—" }));
}
