import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoIndicadores } from "@/components/web/indicadores/CabecalhoIndicadores";
import { ExportacaoSap } from "@/components/web/indicadores/ExportacaoSap";
import { KpisIndicadores } from "@/components/web/indicadores/KpisIndicadores";
import { SituacaoPorEquipe } from "@/components/web/indicadores/SituacaoPorEquipe";
import { TempoExecucao } from "@/components/web/indicadores/TempoExecucao";

export const metadata: Metadata = { title: "Indicadores e exportação" };

export default function IndicadoresPage() {
  return (
    <Screen>
      <CabecalhoIndicadores />
      <KpisIndicadores />
      <SituacaoPorEquipe />
      <TempoExecucao />
      <ExportacaoSap />
    </Screen>
  );
}
