import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { AtividadeModelo } from "@/components/web/modelos/AtividadeModelo";
import { EditorModelo } from "@/components/web/modelos/EditorModelo";
import { ListaModelos } from "@/components/web/modelos/ListaModelos";
import { VersoesModelo } from "@/components/web/modelos/VersoesModelo";

export const metadata: Metadata = { title: "Modelos de APR" };

export default function ModelosPage() {
  return (
    <Screen>
      <div className="stack g4">
        <h1>Modelos de APR</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
          Cada publicação gera uma versão nova. As APRs já preenchidas continuam ligadas à versão que usaram, inclusive as
          feitas sem sinal.
        </span>
      </div>
      <div className="two" style={{ gridTemplateColumns: "270px 1fr" }}>
        <div className="stack g16">
          <ListaModelos />
          <VersoesModelo />
          <AtividadeModelo />
        </div>
        <EditorModelo />
      </div>
    </Screen>
  );
}
