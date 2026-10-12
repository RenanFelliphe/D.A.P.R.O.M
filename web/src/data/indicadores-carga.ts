import "server-only";

import { api } from "@/lib/api";
import type { PreviaDaExportacao } from "./indicadores";

/** Quantas OS aparecem na pré-visualização da exportação (o total real vem do `total` da `api`). */
const LINHAS_DA_PREVIA = 10;

/** Encerradas que ainda não entraram em nenhuma planilha (`GET /os?status=encerrada&exportada=false`), na ordem do quadro. */
export function carregarPreviaDaExportacao() {
  return api<PreviaDaExportacao>("/os", { consulta: { status: "encerrada", exportada: false, tamanho: LINHAS_DA_PREVIA } });
}
