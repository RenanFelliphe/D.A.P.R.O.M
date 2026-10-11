import type { Db } from "../db/conexao";
import { tarefa, type TAREFA_TIPOS } from "../db/schema";

type TarefaTipo = (typeof TAREFA_TIPOS)[number];

/**
 * Enfileira uma tarefa em segundo plano (`pdf_os`, `email_alerta`, `leitura_sap`). Quem chama passa a própria
 * transação: a tarefa só existe se o resto da operação for confirmado. O executor está em `tarefas.ts`.
 */
export async function enfileirarTarefa(db: Db, tipo: TarefaTipo, referenciaId: string | null, quando: Date = new Date()) {
  const [criada] = await db.insert(tarefa).values({ tipo, referenciaId, proximaEm: quando }).returning({ id: tarefa.id });
  return criada!.id;
}
