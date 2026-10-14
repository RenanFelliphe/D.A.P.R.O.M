import { and, desc, eq, gte, lt, type SQL } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { auditoria, os, type AuditoriaEntidade } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { algum, contem } from "./busca";

/** Quem agiu: uma pessoa, ou um sistema (`id` nulo), como o registro de funcionários. */
export type Ator = { id: UsuarioAutenticado["id"] | null; nome: string };

export interface EntradaDeAuditoria {
  entidade: AuditoriaEntidade;
  /** `verbo` da ação; o registro grava `entidade.verbo`. */
  verbo: string;
  entidadeId?: string | null;
  /** Como o alvo se chama agora (nome, código, número da OS…). */
  alvo?: string | null;
  /** A frase que a tela mostra: "Desativou o usuário Maria Souza". */
  resumo: string;
  detalhes?: Record<string, unknown>;
}

/**
 * Grava um registro na trilha. É chamada depois que a ação deu certo; se a gravação falhar, a ação já feita não é
 * desfeita (a falha vai ao log), para a trilha nunca derrubar o trabalho do admin.
 */
export async function registrarAuditoria(db: Db, ator: Ator, e: EntradaDeAuditoria): Promise<void> {
  try {
    await db.insert(auditoria).values({
      atorId: ator.id,
      atorNome: ator.nome,
      acao: `${e.entidade}.${e.verbo}`,
      entidade: e.entidade,
      entidadeId: e.entidadeId ?? null,
      alvo: e.alvo ?? null,
      resumo: e.resumo,
      detalhes: e.detalhes ?? null,
    });
  } catch (erro) {
    console.error(`Auditoria: não foi possível registrar ${e.entidade}.${e.verbo}`, erro);
  }
}

/** O que mudou entre dois estados: `{campo: {de, para}}`, só com os campos que realmente mudaram. */
export function diferencas<T extends Record<string, unknown>>(antes: T, depois: Partial<T>): Record<string, { de: unknown; para: unknown }> {
  const mudou: Record<string, { de: unknown; para: unknown }> = {};
  for (const [campo, novo] of Object.entries(depois)) {
    if (novo === undefined) continue;
    const velho = antes[campo] ?? null;
    if (JSON.stringify(velho) !== JSON.stringify(novo ?? null)) mudou[campo] = { de: velho, para: novo ?? null };
  }
  return mudou;
}

export interface FiltrosDaAuditoria {
  entidade?: AuditoriaEntidade;
  ator_id?: string;
  entidade_id?: string;
  busca?: string;
  /** AAAA-MM-DD, inclusive, no fuso de São Paulo. */
  de?: string;
  ate?: string;
}

const FUSO = "-03:00";
const inicioDoDia = (dia: string) => new Date(`${dia}T00:00:00${FUSO}`);
const diaSeguinte = (dia: string) => new Date(inicioDoDia(dia).getTime() + 24 * 3600 * 1000);

export function condicoesDaAuditoria(f: FiltrosDaAuditoria): SQL | undefined {
  return and(
    f.entidade ? eq(auditoria.entidade, f.entidade) : undefined,
    f.ator_id ? eq(auditoria.atorId, f.ator_id) : undefined,
    f.entidade_id ? eq(auditoria.entidadeId, f.entidade_id) : undefined,
    f.busca ? algum([auditoria.resumo, auditoria.alvo, auditoria.atorNome], f.busca, contem) : undefined,
    f.de ? gte(auditoria.em, inicioDoDia(f.de)) : undefined,
    f.ate ? lt(auditoria.em, diaSeguinte(f.ate)) : undefined,
  );
}

/** Registros do mais novo ao mais antigo. */
export const listarAuditoria = (db: Db, onde: SQL | undefined, limit: number, offset: number) =>
  db.select().from(auditoria).where(onde).orderBy(desc(auditoria.em), desc(auditoria.id)).limit(limit).offset(offset);

/** Como a OS aparece na trilha: o número da ordem do SAP, ou o título (a OS de apoio não tem número). */
export async function rotuloDaOs(db: Db, osId: string): Promise<string> {
  const [o] = await db.select({ numeroOrdem: os.numeroOrdem, titulo: os.titulo }).from(os).where(eq(os.id, osId));
  return o ? (o.numeroOrdem ? `OS ${o.numeroOrdem}` : `OS de apoio "${o.titulo}"`) : "OS";
}
