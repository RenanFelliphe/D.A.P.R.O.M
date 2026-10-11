import { and, eq } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { alerta, equipe, usuario, type AlertaTipo } from "../db/schema";
import { enfileirarTarefa } from "../servicos/fila";

/**
 * Quem recebe os alertas de uma equipe: o supervisor ativo dela; sem supervisor (ou desativado), todos os analistas
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
  return db.select({ id: usuario.id, email: usuario.email }).from(usuario).where(and(eq(usuario.perfil, "analista"), eq(usuario.ativo, true)));
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
