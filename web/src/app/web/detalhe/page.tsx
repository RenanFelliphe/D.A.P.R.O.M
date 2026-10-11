import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { AlertasDaOs } from "@/components/web/detalhe/AlertasDaOs";
import { AprAprovada } from "@/components/web/detalhe/AprAprovada";
import { AprsDaOs } from "@/components/web/detalhe/AprsDaOs";
import { BaixaSap } from "@/components/web/detalhe/BaixaSap";
import { DadosSap } from "@/components/web/detalhe/DadosSap";
import { DetalheCabecalho } from "@/components/web/detalhe/DetalheCabecalho";
import { DocumentoOs } from "@/components/web/detalhe/DocumentoOs";
import { ExecucaoOs } from "@/components/web/detalhe/ExecucaoOs";
import { LinhaDoTempo } from "@/components/web/detalhe/LinhaDoTempo";

export const metadata: Metadata = { title: "Detalhe da OS" };

export default function DetalhePage() {
  return (
    <Screen>
      <DetalheCabecalho />
      <div className="two">
        <div className="stack g16">
          <DadosSap />
          <AprsDaOs />
          <AprAprovada />
          <ExecucaoOs />
        </div>
        <aside className="stack g16">
          <DocumentoOs />
          <BaixaSap />
          <LinhaDoTempo />
          <AlertasDaOs />
        </aside>
      </div>
    </Screen>
  );
}
