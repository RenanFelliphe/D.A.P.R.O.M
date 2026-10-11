import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { ColunaQuadro } from "@/components/web/quadro/ColunaQuadro";
import { FaixaAlertas } from "@/components/web/quadro/FaixaAlertas";
import { FiltrosQuadro } from "@/components/web/quadro/FiltrosQuadro";
import { KpisQuadro } from "@/components/web/quadro/KpisQuadro";
import { QuadroCabecalho } from "@/components/web/quadro/QuadroCabecalho";
import { colunasQuadro } from "@/data/quadro";

export const metadata: Metadata = { title: "Quadro de OS" };

export default function QuadroPage() {
  return (
    <Screen>
      <QuadroCabecalho />
      <KpisQuadro />
      <FaixaAlertas />
      <FiltrosQuadro />
      <div className="board">
        {colunasQuadro.map((coluna) => (
          <ColunaQuadro key={coluna.id} coluna={coluna} />
        ))}
      </div>
    </Screen>
  );
}
