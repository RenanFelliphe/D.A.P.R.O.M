import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { AreaUpload } from "@/components/web/importacao/AreaUpload";
import { ArquivoProcessado } from "@/components/web/importacao/ArquivoProcessado";
import { ColunasLidas } from "@/components/web/importacao/ColunasLidas";
import { FonteOs } from "@/components/web/importacao/FonteOs";
import { ImportacoesAnteriores } from "@/components/web/importacao/ImportacoesAnteriores";
import { LinhasIgnoradas } from "@/components/web/importacao/LinhasIgnoradas";
import { OsManual } from "@/components/web/importacao/OsManual";

export const metadata: Metadata = { title: "Importação SAP" };

export default function ImportacaoPage() {
  return (
    <Screen>
      <div className="stack g4">
        <h1>Importação SAP</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          As OS chegam pela API do SAP (simulada, com dados fictícios). Se preferir, envie a planilha exportada. OS novas
          entram como liberadas; as que já existem só têm o planejamento atualizado.
        </span>
      </div>
      <div className="two">
        <div className="stack g16">
          <FonteOs />
          <AreaUpload />
          <ArquivoProcessado />
          <LinhasIgnoradas />
          <ImportacoesAnteriores />
        </div>
        <aside className="stack g16">
          <ColunasLidas />
          <OsManual />
        </aside>
      </div>
    </Screen>
  );
}
