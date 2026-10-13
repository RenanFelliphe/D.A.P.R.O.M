import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { os, reprogramacao, type EventoTipo } from "../db/schema";
import type { Deps } from "../deps";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { instanteIso, uuid, validar } from "../http/validacao";
import type { Bucket } from "../servicos/armazenamento";
import { criarAlertas } from "./alertas";

/** Um evento pode ser recusado para sempre (`rejeitado`) ou ficar na fila do cliente até a causa sumir (`pendente`). */
export class RejeicaoEvento extends Error {
  constructor(
    public readonly situacao: "rejeitado" | "pendente",
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}
/** Dado inválido ou regra violada: o cliente precisa corrigir; reenviar o mesmo evento não adianta. */
export const rejeitar = (codigo: string, mensagem: string) => new RejeicaoEvento("rejeitado", codigo, mensagem);
/** Falta algo que ainda deve chegar (um arquivo, o evento anterior): o evento continua pendente no cliente. */
export const adiar = (codigo: string, mensagem: string) => new RejeicaoEvento("pendente", codigo, mensagem);

/**
 * Evento que chega com mais atraso que isto veio da fila offline (ou de um relógio errado): o aparelho decidiu sem
 * conhecer o que mudou no servidor. Nesses casos o conflito não recusa o evento, vira alerta (Decisão-chave 2).
 */
export const ATRASO_OFFLINE_MS = 60_000;

export interface Contexto {
  /** Transação do evento: tudo ou nada. */
  tx: Db;
  deps: Deps;
  usuario: UsuarioAutenticado;
  evento: { id: string; tipo: EventoTipo; osId: string | null; ocorridoEm: Date };
  recebidoEm: Date;
  /** Chegou da fila offline (atraso maior que `ATRASO_OFFLINE_MS`). */
  offline: boolean;
  /**
   * A APR bloqueada é registrada na validação (`POST /aprs/avaliar`), antes de o técnico saber o que reprovou: a evidência
   * dos itens reprovados chega depois, no `apr_concluida` da mesma APR.
   */
  evidenciaDepois?: boolean;
  saida: { alertas: string[]; aprs: { id: string; resultado: string }[]; osAfetadas: Set<string> };
}

export const evidenciaPayload = z
  .object({
    id: uuid,
    /** Id do arquivo enviado com `PUT /arquivos/{id}`; padrão: o próprio id da evidência. */
    arquivo_id: uuid.optional(),
    item_id: uuid.optional(),
    capturada_em: instanteIso,
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((e) => (e.latitude == null) === (e.longitude == null), { message: "Informe latitude e longitude juntas" });
export type EvidenciaPayload = z.infer<typeof evidenciaPayload>;

export const lerPayload = <T extends z.ZodType>(esquema: T, bruto: unknown): z.infer<T> => {
  try {
    return validar(esquema, bruto);
  } catch (erro: any) {
    throw rejeitar("payload_invalido", erro?.message ?? "Payload inválido");
  }
};

/** Arquivo ainda não enviado → o evento fica pendente (Eventos, tabela de estados: "Evento cujo arquivo ainda não subiu"). */
export async function exigirArquivo(ctx: Contexto, bucket: Bucket, id: string) {
  if (!(await ctx.deps.armazenamento.existe(bucket, id))) throw adiar("arquivo_ausente", `O arquivo ${id} ainda não foi enviado`);
}

/**
 * Carrega a OS e confere que o usuário é da equipe dela. A equipe de hoje ou uma equipe anterior (a OS foi reatribuída
 * enquanto ele estava offline) servem: o evento de campo é aplicado de qualquer jeito. `mudou` diz se o planejamento
 * mudou depois do evento (outra equipe, ou reprogramação posterior a `ocorrido_em`).
 */
export async function carregarOsDoUsuario(ctx: Contexto, osId: string) {
  const [linha] = await ctx.tx.select().from(os).where(eq(os.id, osId));
  if (!linha) throw rejeitar("os_inexistente", "OS não encontrada");

  const historico = await ctx.tx.select().from(reprogramacao).where(eq(reprogramacao.osId, osId));
  const daEquipe =
    ctx.usuario.equipeId !== null &&
    (linha.equipeId === ctx.usuario.equipeId || historico.some((h) => h.equipeAnteriorId === ctx.usuario.equipeId));
  if (!daEquipe) throw rejeitar("fora_da_equipe", "A OS não é da sua equipe");

  const mudou = linha.equipeId !== ctx.usuario.equipeId || historico.some((h) => h.criadaEm > ctx.evento.ocorridoEm);
  return { os: linha, mudou };
}

/** `conflito_planejamento`: o evento foi aplicado, mas o planejamento já tinha mudado, ou a OS já estava cancelada. */
export async function avisarConflitoDePlanejamento(ctx: Contexto, o: typeof os.$inferSelect, motivo: string) {
  ctx.saida.alertas.push(
    ...(await criarAlertas(ctx.tx, { tipo: "conflito_planejamento", osId: o.id, equipeId: o.equipeId, detalhe: `OS ${o.numeroOrdem ?? o.titulo}: ${motivo}` })),
  );
}
