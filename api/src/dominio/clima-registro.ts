import { eq } from "drizzle-orm";
import { z } from "zod";
import { CAUSAS_DE_RISCO, NIVEIS_DE_RISCO, type ClimaRegistrado } from "../../../shared/api/clima";
import type { Db } from "../db/conexao";
import { climaRegistro, CLIMA_ORIGENS } from "../db/schema";
import { instanteIso } from "../http/validacao";

/**
 * O clima na hora da APR e do encerramento (`funcionalidades/previsao-do-tempo.md`): a cópia da previsão que a pessoa viu, que o
 * aparelho manda junto do evento (`apr_concluida` e `encerramento_assinado`). É só informativo: a `api` guarda o que veio, para o
 * relatório do supervisor mostrar o que valia na hora, e nunca recusa um evento por causa dele (sem previsão, o evento segue sem ela).
 */

const horaDoClima = z.object({
  hora: z.string().max(20),
  temperatura: z.number(),
  sensacao: z.number(),
  chance_chuva: z.number(),
  chuva_mm: z.number(),
  rajada_kmh: z.number(),
  indice_uv: z.number(),
  trovoada: z.boolean(),
  condicao: z.string().max(60),
  icone: z.enum(["sol", "nuvem-sol", "nuvem", "chuva", "trovoada", "nevoeiro"]),
  nivel: z.enum(NIVEIS_DE_RISCO),
});

export const esquemaClimaRegistrado = z.object({
  nivel: z.enum(NIVEIS_DE_RISCO),
  titulo: z.string().trim().min(1).max(300),
  orientacao: z.string().trim().min(1).max(600),
  causas: z.array(z.enum(CAUSAS_DE_RISCO)).max(6).default([]),
  horas: z.array(horaDoClima).max(24).default([]),
  local: z.object({
    nome: z.string().trim().min(1).max(80),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    origem: z.enum(CLIMA_ORIGENS),
  }),
  consultada_em: instanteIso,
  confirmou_apesar_do_aviso: z.boolean().optional(),
});

export type ClimaDoEvento = z.infer<typeof esquemaClimaRegistrado>;

/** Guarda o clima da APR (uma linha por APR; reenviar o evento não duplica). */
export async function gravarClimaDaApr(db: Db, aprId: string, usuarioId: string, c: ClimaDoEvento): Promise<void> {
  await db
    .insert(climaRegistro)
    .values({ ...linhaDe(c, usuarioId), momento: "apr", aprId, confirmouApesarDoAviso: c.confirmou_apesar_do_aviso ?? null })
    .onConflictDoNothing();
}

/** Guarda o clima do encerramento (uma linha por execução). */
export async function gravarClimaDaExecucao(db: Db, execucaoId: string, usuarioId: string, c: ClimaDoEvento): Promise<void> {
  await db
    .insert(climaRegistro)
    .values({ ...linhaDe(c, usuarioId), momento: "encerramento", execucaoId })
    .onConflictDoNothing();
}

const linhaDe = (c: ClimaDoEvento, usuarioId: string) => ({
  nivel: c.nivel,
  titulo: c.titulo,
  orientacao: c.orientacao,
  causas: c.causas,
  horas: c.horas,
  localNome: c.local.nome,
  localOrigem: c.local.origem,
  latitude: c.local.latitude,
  longitude: c.local.longitude,
  consultadaEm: c.consultada_em,
  criadoPor: usuarioId,
});

type LinhaDeClima = typeof climaRegistro.$inferSelect;

/** Como a `api` entrega o clima guardado: o formato de `ClimaRegistrado`, com `momento`. */
export function climaParaApi(l: LinhaDeClima): ClimaRegistrado & { momento: "apr" | "encerramento" } {
  return {
    momento: l.momento,
    nivel: l.nivel,
    titulo: l.titulo,
    orientacao: l.orientacao,
    causas: l.causas,
    horas: l.horas,
    local: { nome: l.localNome, latitude: l.latitude, longitude: l.longitude, origem: l.localOrigem },
    consultada_em: l.consultadaEm.toISOString(),
    ...(l.confirmouApesarDoAviso === null ? {} : { confirmou_apesar_do_aviso: l.confirmouApesarDoAviso }),
  };
}

/** O clima guardado de uma APR (ou nulo). */
export async function climaDaApr(db: Db, aprId: string) {
  const [l] = await db.select().from(climaRegistro).where(eq(climaRegistro.aprId, aprId));
  return l ? climaParaApi(l) : null;
}

/** O clima guardado do encerramento de uma execução (ou nulo). */
export async function climaDaExecucao(db: Db, execucaoId: string) {
  const [l] = await db.select().from(climaRegistro).where(eq(climaRegistro.execucaoId, execucaoId));
  return l ? climaParaApi(l) : null;
}
