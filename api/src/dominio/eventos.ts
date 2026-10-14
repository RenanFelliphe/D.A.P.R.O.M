import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { EVENTO_TIPOS, apr, eventoCampo, os } from "../db/schema";
import type { Deps } from "../deps";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { instanteIso, uuid } from "../http/validacao";
import { aplicarAprConcluida } from "./eventos-apr";
import { ganhosDe, type ganhoParaApi } from "./lancamentos";
import { ATRASO_OFFLINE_MS, RejeicaoEvento, rejeitar, type Contexto } from "./eventos-base";
import {
  aplicarExecucaoCancelada,
  aplicarExecucaoEncerrada,
  aplicarExecucaoIniciada,
  aplicarExecucaoInterrompida,
  aplicarExecucaoSuspensa,
  aplicarPausaEncerrada,
  aplicarPausaIniciada,
} from "./eventos-execucao";
import { recalcularStatusOs } from "./status-os";

export const MAX_EVENTOS_POR_ENVIO = 500;

export const esquemaEnvio = z.object({
  eventos: z
    .array(
      z.object({
        /** Gerado no aparelho; a chave primária garante a idempotência (Decisão-chave 3). */
        id: uuid,
        tipo: z.enum(EVENTO_TIPOS),
        os_id: uuid.nullable().optional(),
        payload: z.record(z.string(), z.unknown()),
        ocorrido_em: instanteIso,
      }),
    )
    .min(1)
    .max(MAX_EVENTOS_POR_ENVIO),
});
export type EventoRecebido = z.infer<typeof esquemaEnvio>["eventos"][number];

export interface ResultadoDoEnvio {
  confirmados: string[];
  alertas: string[];
  aprs: { id: string; resultado: string }[];
  os: { id: string; status: string }[];
  /** Recusados para sempre: o cliente corrige ou descarta. */
  rejeitados: { id: string; codigo: string; mensagem: string }[];
  /** Ainda não dá para aplicar (arquivo ou evento anterior não chegou): ficam na fila do cliente. */
  pendentes: { id: string; codigo: string; mensagem: string }[];
  /** Os pontos que o autor ganhou com os eventos confirmados desta chamada ("+N pontos"); reenviar um evento não pontua de novo. */
  pontosGanhos: number;
  ganhos: ReturnType<typeof ganhoParaApi>[];
}

async function despachar(ctx: Contexto, e: EventoRecebido) {
  const osId = e.os_id ?? null;
  switch (e.tipo) {
    case "apr_concluida":
      return aplicarAprConcluida(ctx, osId, e.payload);
    case "execucao_iniciada":
      return aplicarExecucaoIniciada(ctx, osId, e.payload);
    case "pausa_iniciada":
      return aplicarPausaIniciada(ctx, e.payload);
    case "pausa_encerrada":
      return aplicarPausaEncerrada(ctx, e.payload);
    case "execucao_encerrada":
      return aplicarExecucaoEncerrada(ctx, e.payload);
    case "execucao_interrompida":
      return aplicarExecucaoInterrompida(ctx, e.payload);
    case "execucao_suspensa":
      return aplicarExecucaoSuspensa(ctx, e.payload);
    case "execucao_cancelada":
      return aplicarExecucaoCancelada(ctx, e.payload);
  }
}

/**
 * O canal único de escrita de campo (Decisão-chave 3), igual para web, app online e fila offline. Cada evento roda na
 * própria transação, em ordem de `ocorrido_em`: insere em `evento_campo` com o id do aparelho (se o id já existe, o
 * evento já foi aplicado e só é confirmado de novo), grava o que o payload descreve, recalcula `apr.resultado` e
 * `os.status` no servidor e cria alertas e tarefas. Um evento recusado desfaz a própria transação e não impede os
 * demais; o que for recusado ou pendente volta em `rejeitados` e `pendentes`.
 */
export async function processarEventos(
  deps: Deps,
  usuario: UsuarioAutenticado,
  recebidos: EventoRecebido[],
  opcoes: Pick<Contexto, "evidenciaDepois"> = {},
): Promise<ResultadoDoEnvio> {
  const saida: ResultadoDoEnvio = { confirmados: [], alertas: [], aprs: [], os: [], rejeitados: [], pendentes: [], pontosGanhos: 0, ganhos: [] };
  const osAfetadas = new Set<string>();
  const ordenados = [...recebidos].sort((a, b) => a.ocorrido_em.getTime() - b.ocorrido_em.getTime());

  for (const e of ordenados) {
    const recebidoEm = deps.agora();
    const parcial: Contexto["saida"] = { alertas: [], aprs: [], osAfetadas: new Set(), ganhos: [] };
    try {
      await deps.db.transaction(async (tx) => {
        const osDoEnvelope = e.os_id ?? (typeof e.payload.os_id === "string" ? e.payload.os_id : null);
        if (osDoEnvelope) {
          const [existe] = await tx.select({ id: os.id }).from(os).where(eq(os.id, osDoEnvelope));
          if (!existe) throw rejeitar("os_inexistente", "OS não encontrada");
        }
        const inserido = await tx
          .insert(eventoCampo)
          .values({ id: e.id, usuarioId: usuario.id, tipo: e.tipo, osId: osDoEnvelope, payload: e.payload, ocorridoEm: e.ocorrido_em, recebidoEm })
          .onConflictDoNothing()
          .returning({ id: eventoCampo.id });
        if (inserido.length === 0) {
          // Já aplicado: confirma sem efeito. A resposta ainda informa o resultado da APR, para o cliente online.
          if (e.tipo === "apr_concluida" && typeof e.payload.id === "string") {
            const [a] = await tx.select({ id: apr.id, resultado: apr.resultado, osId: apr.osId }).from(apr).where(eq(apr.id, e.payload.id));
            if (a) {
              parcial.aprs.push({ id: a.id, resultado: a.resultado });
              parcial.osAfetadas.add(a.osId);
            }
          }
          return;
        }

        const ctx: Contexto = {
          tx,
          deps,
          usuario,
          evento: { id: e.id, tipo: e.tipo, osId: osDoEnvelope, ocorridoEm: e.ocorrido_em },
          recebidoEm,
          offline: recebidoEm.getTime() - e.ocorrido_em.getTime() > ATRASO_OFFLINE_MS,
          ...opcoes,
          saida: parcial,
        };
        await despachar(ctx, e);
        for (const id of parcial.osAfetadas) await recalcularStatusOs(tx, id);
        if (!osDoEnvelope && parcial.osAfetadas.size === 1) {
          await tx.update(eventoCampo).set({ osId: [...parcial.osAfetadas][0]! }).where(eq(eventoCampo.id, e.id));
        }
      });
      saida.confirmados.push(e.id);
      saida.alertas.push(...parcial.alertas);
      saida.aprs.push(...parcial.aprs);
      parcial.osAfetadas.forEach((id) => osAfetadas.add(id));
      const meus = ganhosDe(parcial.ganhos, usuario.id);
      saida.pontosGanhos += meus.pontosGanhos;
      saida.ganhos.push(...meus.ganhos);
    } catch (erro) {
      if (!(erro instanceof RejeicaoEvento)) throw erro;
      (erro.situacao === "pendente" ? saida.pendentes : saida.rejeitados).push({ id: e.id, codigo: erro.codigo, mensagem: erro.message });
    }
  }

  if (osAfetadas.size > 0) {
    const linhas = await deps.db.select({ id: os.id, status: os.status }).from(os).where(inArray(os.id, [...osAfetadas]));
    saida.os = linhas;
  }
  return saida;
}
