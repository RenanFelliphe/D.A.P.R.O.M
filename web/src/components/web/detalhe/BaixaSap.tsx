import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import type { OsDetalhe } from "@/data/detalhe";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

/** Situação da exportação da OS para a baixa no SAP. `podeExportar`: o admin, que tem a tela de exportação. */
export function BaixaSap({ os, podeExportar }: { os: OsDetalhe; podeExportar: boolean }) {
  return (
    <Panel style={{ gap: 8 }}>
      <h2>Baixa no SAP</h2>
      {os.exportada_sap_em ? (
        <>
          <Badge tone="enc" style={{ alignSelf: "flex-start", fontWeight: 600 }}>
            Exportada em {dataHora(os.exportada_sap_em)}
          </Badge>
          <p className="muted">A baixa no SAP continua manual, com o link do PDF desta OS.</p>
        </>
      ) : os.status === "encerrada" ? (
        <>
          <Badge tone="neu" style={{ alignSelf: "flex-start", fontWeight: 600 }}>
            Ainda não exportada
          </Badge>
          <p className="muted">Entra na próxima planilha de OS concluídas, com o link do PDF.</p>
          {podeExportar && (
            <Link href={rotas.app.exportacaoSap} style={{ fontSize: 13.5, fontWeight: 600 }}>
              Ir para exportação
            </Link>
          )}
        </>
      ) : (
        <>
          <Badge tone="neu" style={{ alignSelf: "flex-start", fontWeight: 600 }}>
            Não se aplica ainda
          </Badge>
          <p className="muted">Só as OS concluídas (encerradas, depois da assinatura final do supervisor) entram na planilha de baixa do SAP.</p>
        </>
      )}
    </Panel>
  );
}
