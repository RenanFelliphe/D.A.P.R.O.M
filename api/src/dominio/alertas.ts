import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { alerta, equipe, importacao, usuario, type AlertaTipo } from "../db/schema";
import { enfileirarTarefa } from "../servicos/fila";

/**
 * Quem recebe os alertas de uma equipe: o supervisor ativo dela; sem supervisor (ou desativado), todos os administradores
 * ativos (Impedimento, item 1).
 */
export async function destinatariosDaEquipe(db: Db, equipeId: string): Promise<{ id: string; email: string | null }[]> {
  const [e] = await db.select({ supervisorId: equipe.supervisorId }).from(equipe).where(eq(equipe.id, equipeId));
  if (e?.supervisorId) {
    const [sup] = await db
      .select({ id: usuario.id, email: usuario.email })
      .from(usuario)
      .where(and(eq(usuario.id, e.supervisorId), eq(usuario.ativo, true)));
    if (sup) return [sup];
  }
  return db.select({ id: usuario.id, email: usuario.email }).from(usuario).where(and(eq(usuario.perfil, "admin"), eq(usuario.ativo, true)));
}

/**
 * Cria um `alerta` para cada destinatário da equipe. Só `bloqueio` vai também por e-mail (tarefa `email_alerta`), e só
 * para quem tem e-mail (Impedimento, item 2). Quem chama passa a própria transação. Devolve os ids criados.
 */
export async function criarAlertas(db: Db, dados: { tipo: AlertaTipo; osId: string; equipeId: string; detalhe: string }): Promise<string[]> {
  const ids: string[] = [];
  for (const d of await destinatariosDaEquipe(db, dados.equipeId)) {
    const [criado] = await db
      .insert(alerta)
      .values({ tipo: dados.tipo, osId: dados.osId, destinatarioId: d.id, detalhe: dados.detalhe })
      .returning({ id: alerta.id });
    ids.push(criado!.id);
    if (dados.tipo === "bloqueio" && d.email) await enfileirarTarefa(db, "email_alerta", criado!.id);
  }
  return ids;
}

/**
 * Quem fica sabendo de uma importação que falhou: quem a iniciou ("Sincronizar agora" ou a planilha), se ainda está
 * ativo; na leitura agendada, que não tem autor, os administradores ativos.
 */
async function destinatariosDaFalha(db: Db, usuarioId: string | null): Promise<string[]> {
  if (usuarioId) {
    const [quem] = await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.id, usuarioId), eq(usuario.ativo, true)));
    if (quem) return [quem.id];
  }
  const ids = await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.perfil, "admin"), eq(usuario.ativo, true)));
  return ids.map((u) => u.id);
}

/**
 * Alerta `falha_importacao`, ligado ao registro da importação que falhou (qualquer método). Enquanto o alerta anterior da
 * mesma origem não foi lido, ele é reaproveitado — passa a apontar para a falha mais recente e sobe para o topo — em vez de
 * empilhar um por tentativa (a leitura agendada se repete a cada poucos minutos com a API fora do ar). Não vai por e-mail.
 * Quem chama passa a própria transação.
 */
export async function alertarFalhaDeImportacao(
  db: Db,
  dados: { importacaoId: string; origem: "api" | "planilha"; usuarioId: string | null; detalhe: string; agora: Date },
): Promise<void> {
  for (const destinatarioId of await destinatariosDaFalha(db, dados.usuarioId)) {
    const [aberto] = await db
      .select({ id: alerta.id })
      .from(alerta)
      .innerJoin(importacao, eq(importacao.id, alerta.importacaoId))
      .where(and(eq(alerta.tipo, "falha_importacao"), eq(alerta.destinatarioId, destinatarioId), isNull(alerta.lidoEm), eq(importacao.origem, dados.origem)))
      .limit(1);
    const valores = { importacaoId: dados.importacaoId, detalhe: dados.detalhe, criadoEm: dados.agora };
    if (aberto) await db.update(alerta).set(valores).where(eq(alerta.id, aberto.id));
    else await db.insert(alerta).values({ tipo: "falha_importacao", destinatarioId, ...valores });
  }
}

/** Texto do alerta de falha: o método, o motivo e a garantia de que nenhuma OS mudou. */
export function detalheDaFalha(o: { origem: "api" | "planilha"; arquivo?: string; motivo: string }): string {
  const metodo = o.origem === "api" ? "A sincronização com a API do SAP falhou" : `A importação da planilha ${o.arquivo ? `"${o.arquivo}" ` : ""}falhou`;
  return `${metodo}: ${o.motivo.replace(/\.$/, "")}. Nenhuma OS foi criada, alterada ou removida.`;
}
