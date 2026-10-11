import { Panel } from "@/components/web/Panel";
import type { OsDetalhe } from "@/data/detalhe";
import { BotaoCritico } from "./BotaoCritico";
import { CancelarOs } from "./CancelarOs";

interface AcoesDaOsProps {
  os: OsDetalhe;
  /** Analista e admin: criticidade do local e cancelamento da OS manual. */
  podeEditar: boolean;
}

/** Ações de gestão sobre a OS e o local. Some quando o perfil não tem nenhuma delas. */
export function AcoesDaOs({ os, podeEditar }: AcoesDaOsProps) {
  const podeCancelar = podeEditar && os.origem === "manual" && (os.status === "liberada" || os.status === "pendente");
  if (!podeEditar) return null;
  return (
    <Panel style={{ gap: 12 }}>
      <h2>Ações</h2>
      <div className="stack g6">
        <span className="small" style={{ color: "var(--ink4)" }}>
          Local {os.local_instalacao.critico ? "crítico" : "não crítico"} · vale para todas as OS de {os.local_instalacao.codigo}
        </span>
        <BotaoCritico localId={os.local_instalacao.id} critico={os.local_instalacao.critico} />
      </div>
      {podeCancelar && <CancelarOs osId={os.id} />}
      {os.status === "cancelada" && (
        <p className="muted">
          OS cancelada{os.justificativa_cancelamento ? `: ${os.justificativa_cancelamento}` : "."}
        </p>
      )}
    </Panel>
  );
}
