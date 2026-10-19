import { useQuery } from "@tanstack/react-query";
import type { PerguntaDoChecklist } from "@shared/api/checklist-inspecao";
import type { AprDaApi, ExecucaoDaApi } from "@shared/api/execucao-tempo";
import type { OsStatus } from "@shared/api/tipos";
import { cliente } from "@/api/api";
import { leitura, lerDeOndeDer } from "@/offline/app";

/** O que a tela de execução lê de `GET /os/{id}`: a OS, as execuções (com as pausas) e as APRs com as assinaturas. */
export interface DetalheParaExecutar {
  os: {
    id: string;
    numero_ordem: string | null;
    titulo: string;
    status: OsStatus;
    local_instalacao: { codigo: string };
    responsavel?: { id: string; nome: string } | null;
  };
  execucoes: ExecucaoDaApi[];
  aprs: AprDaApi[];
  /** O checklist de inspeção do plano da OS preventiva, pedido no encerramento. */
  checklist_inspecao?: PerguntaDoChecklist[];
}

export function useDetalheParaExecutar(id: string) {
  return useQuery({
    queryKey: ["os", id, "execucao"],
    queryFn: () =>
      lerDeOndeDer<DetalheParaExecutar>(
        () => cliente.chamar<DetalheParaExecutar>(`/os/${id}`),
        () => leitura.detalhe(id),
      ),
  });
}
