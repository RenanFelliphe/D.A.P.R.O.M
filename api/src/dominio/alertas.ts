import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { alerta, equipe, importacao, usuario, type AlertaTipo } from "../db/schema";
import { enfileirarTarefa } from "../servicos/fila";

/**
 * Quem recebe os alertas de uma equipe: o supervisor ativo dela e, enquanto o representante está no comando (o supervisor
 * ausente ou parado), também o representante; sem ninguém disso, todos os administradores ativos (Impedimento, item 1).
 */
export async function destinatariosDaEquipe(db: Db, equipeId: string): Promise<{ id: string; email: string | null }[]> {
  const [e] = await db
    .select({ supervisorId: equipe.supervisorId, representanteId: equipe.representanteId, representacaoDesde: equipe.representacaoDesde })
    .from(equipe)
    .where(eq(equipe.id, equipeId));
  const ids = [e?.supervisorId, e?.representacaoDesde ? e.representanteId : null].filter((id): id is string => !!id);
  if (ids.length > 0) {
    const responsaveis = await db.select({ id: usuario.id, email: usuario.email }).from(usuario).where(and(inArray(usuario.id, ids), eq(usuario.ativo, true)));
    if (responsaveis.length > 0) return responsaveis;
  }
  return db.select({ id: usuario.id, email: usuario.email }).from(usuario).where(and(eq(usuario.perfil, "admin"), eq(usuario.ativo, true)));
}

/**
 * Cria um `alerta` para cada destinatário da equipe. Só `bloqueio` vai também por e-mail (tarefa `email_alerta`), e só
 * para quem tem e-mail (Impedimento, item 2). Os do ciclo das preventivas levam também o plano (`planoPreventivaId`). Quem
 * chama passa a própria transação. Devolve os ids criados.
 */
export async function criarAlertas(
  db: Db,
  dados: { tipo: AlertaTipo; osId: string; equipeId: string; detalhe: string; planoPreventivaId?: string },
): Promise<string[]> {
  const ids: string[] = [];
  for (const d of await destinatariosDaEquipe(db, dados.equipeId)) {
    const [criado] = await db
      .insert(alerta)
      .values({ tipo: dados.tipo, osId: dados.osId, planoPreventivaId: dados.planoPreventivaId ?? null, destinatarioId: d.id, detalhe: dados.detalhe })
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
  dados: { importacaoId: string; origem: "api" | "planilha" | "pdf"; usuarioId: string | null; detalhe: string; agora: Date },
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
export function detalheDaFalha(o: { origem: "api" | "planilha" | "pdf"; arquivo?: string; motivo: string }): string {
  const arquivo = o.arquivo ? `"${o.arquivo}" ` : "";
  const metodo =
    o.origem === "api"
      ? "A sincronização com a API do SAP falhou"
      : o.origem === "pdf"
        ? `A importação do PDF da OS ${arquivo}falhou`
        : `A importação da planilha ${arquivo}falhou`;
  return `${metodo}: ${o.motivo.replace(/\.$/, "")}. Nenhuma OS foi criada, alterada ou removida.`;
}
