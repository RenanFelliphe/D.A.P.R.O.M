import { Panel } from "@/components/web/Panel";
import type { OsDetalhe } from "@/data/detalhe";
import { dataHora } from "@/lib/formatar";
import { BotaoCiencia } from "./BotaoCiencia";

/** Ciência do supervisor da equipe na OS encerrada: "Ciente e assinada em…" ou, para o supervisor, o botão que abre a assinatura. */
export function CienciaSupervisor({ os, podeDarCiencia }: { os: OsDetalhe; podeDarCiencia: boolean }) {
  return (
    <Panel style={{ gap: 8 }}>
      <h2>Ciência do supervisor</h2>
      {os.ciencia_em ? (
        <p>
          <strong style={{ color: "var(--enc)" }}>Ciente e assinada em {dataHora(os.ciencia_em)}</strong>
          {os.ciencia_por_nome && <span className="muted"> · {os.ciencia_por_nome}</span>}
        </p>
      ) : podeDarCiencia ? (
        <>
          <p className="muted">Assine para registrar que você viu a execução desta OS. O PDF é gerado de novo com a sua assinatura.</p>
          <BotaoCiencia osId={os.id} />
        </>
      ) : (
        <p className="muted">Pendente: o supervisor da equipe {os.equipe.nome} ainda não deu ciência.</p>
      )}
    </Panel>
  );
}
