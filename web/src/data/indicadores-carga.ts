import "server-only";

import { api } from "@/lib/api";
import type { IndicadoresDeTempo, IndicadoresDoMes, PreviaDaExportacao } from "./indicadores";

/** `GET /indicadores` e `GET /indicadores/tempo` do mês (e da equipe, se escolhida). */
export function carregarIndicadores(mes: string, equipeId: string | undefined) {
  return Promise.all([
    api<IndicadoresDoMes>("/indicadores", { consulta: { mes, equipe_id: equipeId } }),
    api<IndicadoresDeTempo>("/indicadores/tempo", { consulta: { mes, equipe_id: equipeId } }),
  ]);
}

/** Quantas OS aparecem na pré-visualização da exportação (o total real vem do `total` da `api`). */
const LINHAS_DA_PREVIA = 10;

/** Encerradas que ainda não entraram em nenhuma planilha (`GET /os?status=encerrada&exportada=false`), na ordem do quadro. */
export function carregarPreviaDaExportacao() {
  return api<PreviaDaExportacao>("/os", { consulta: { status: "encerrada", exportada: false, tamanho: LINHAS_DA_PREVIA } });
}
