import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { EVIDENCIA_TIPOS, os, reprogramacao, usuario, type EventoTipo } from "../db/schema";
import type { Deps } from "../deps";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { instanteIso, uuid, validar } from "../http/validacao";
import type { Bucket } from "../servicos/armazenamento";
import { criarAlertas } from "./alertas";
import { bucketDaEvidencia } from "./evidencias";
import type { ContextoDePontos, Ganho } from "./lancamentos";

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
  /** `ganhos`: os lançamentos de pontos que o evento gerou (de todos os participantes; a resposta devolve só os de quem enviou). */
  saida: { alertas: string[]; aprs: { id: string; resultado: string }[]; osAfetadas: Set<string>; ganhos: Ganho[] };
}

/** O contexto da pontuação do evento: a mesma transação, com o relógio da `api` (o evento do aparelho pode estar com a hora errada). */
export const contextoDePontos = (ctx: Contexto): ContextoDePontos => ({ tx: ctx.tx, agora: ctx.recebidoEm });

export const evidenciaPayload = z
  .object({
    id: uuid,
    /** Id do arquivo enviado com `PUT /arquivos/{id}`; padrão: o próprio id da evidência. */
    arquivo_id: uuid.optional(),
    /** `foto` (padrão, `PUT /arquivos` com `tipo=foto`) ou `pdf` (documento, `tipo=pdf`). */
    tipo: z.enum(EVIDENCIA_TIPOS).default("foto"),
    /** Nome do PDF como foi anexado, para exibir; ignorado na foto. */
    nome: z.string().trim().min(1).max(200).nullable().optional(),
    item_id: uuid.optional(),
    capturada_em: instanteIso,
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((e) => (e.latitude == null) === (e.longitude == null), { message: "Informe latitude e longitude juntas" });
export type EvidenciaPayload = z.infer<typeof evidenciaPayload>;

/** A linha de `evidencia` de uma evidência do payload, ligada à execução ou ao item da APR. */
export const linhaDeEvidencia = (e: EvidenciaPayload, dono: { execucaoId: string } | { aprId: string; itemId: string }) => ({
  id: e.id,
  ...dono,
  tipo: e.tipo,
  fotoPath: e.arquivo_id ?? e.id,
  nomeArquivo: e.tipo === "pdf" ? (e.nome ?? null) : null,
  capturadaEm: e.capturada_em,
  latitude: e.latitude ?? null,
  longitude: e.longitude ?? null,
});

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

/** Os arquivos das evidências (fotos e PDFs), cada um no bucket do seu tipo, já precisam ter subido. */
export async function exigirArquivosDasEvidencias(ctx: Contexto, evidencias: EvidenciaPayload[]) {
  for (const e of evidencias) await exigirArquivo(ctx, bucketDaEvidencia(e.tipo), e.arquivo_id ?? e.id);
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

/**
 * A OS reservada a uma pessoa (atribuição individual) só tem APR e execução do responsável, e a OS devolvida ao SAP não
 * recebe mais nada. Online o evento é recusado; vindo da fila offline (o aparelho decidiu sem saber da reserva ou da
 * devolução) ele é aplicado e a função devolve o motivo para virar alerta ao supervisor (Decisão-chave 2).
 */
export async function conferirReserva(ctx: Contexto, o: typeof os.$inferSelect): Promise<string | null> {
  if (o.status === "devolvida") {
    if (!ctx.offline) throw rejeitar("os_devolvida", "Esta OS foi devolvida ao SAP pelo supervisor");
    return "o evento chegou depois de a OS ser devolvida ao SAP";
  }
  if (o.responsavelId && o.responsavelId !== ctx.usuario.id) {
    if (!ctx.offline) {
      const [responsavel] = await ctx.tx.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, o.responsavelId));
      throw rejeitar("os_reservada", `Esta OS está reservada para ${responsavel?.nome ?? "outra pessoa da equipe"}`);
    }
    return "o evento foi feito por quem não era o responsável reservado da OS";
  }
  return null;
}

/** `conflito_planejamento`: o evento foi aplicado, mas o planejamento já tinha mudado, ou a OS já estava cancelada. */
export async function avisarConflitoDePlanejamento(ctx: Contexto, o: typeof os.$inferSelect, motivo: string) {
  ctx.saida.alertas.push(
    ...(await criarAlertas(ctx.tx, { tipo: "conflito_planejamento", osId: o.id, equipeId: o.equipeId, detalhe: `OS ${o.numeroOrdem ?? o.titulo}: ${motivo}` })),
  );
}
