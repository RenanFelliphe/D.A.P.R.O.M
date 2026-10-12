import { ENDERECO_REINICIAR_TREINO } from "./ids";

/**
 * Botão "Recomeçar treino" (componente de cliente): descarta tudo o que o técnico fez no Campo de treino e volta a massa
 * inicial (`POST /api/treino/reiniciar`, atendido pelo handler `app/api/[...caminho]`). Depois, o chamador recarrega a tela
 * (`router.refresh()` ou navega para a lista de OS). Lança `Error` com a mensagem do servidor se falhar.
 */
export async function recomecarTreino(): Promise<void> {
  const resposta = await fetch(ENDERECO_REINICIAR_TREINO, { method: "POST", cache: "no-store" });
  if (resposta.ok) return;
  const dados = (await resposta.json().catch(() => null)) as { erro?: { mensagem?: string } } | null;
  throw new Error(dados?.erro?.mensagem ?? "Não foi possível recomeçar o treino.");
}
