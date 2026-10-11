import { Icon } from "@/components/ui/Icon";
import { Kpi } from "@/components/web/Panel";
import { situacoes } from "@/data/indicadores";

const [encerradas, , comJustificativa, semJustificativa] = situacoes;

/** Quatro indicadores do mês, com as mesmas cores das barras do gráfico. */
export function KpisIndicadores() {
  return (
    <div className="kpis k4">
      <Kpi label="Preventivas no mês" value="212" sub="programadas para outubro" />
      <Kpi
        label="Encerradas"
        marker={<Icon name="check" size={13} style={{ color: encerradas.cor }} />}
        value="164"
        sub="77% das preventivas do mês"
      />
      <Kpi
        label="Atrasadas com justificativa"
        marker={<Icon name="alert" size={13} style={{ color: comJustificativa.cor }} />}
        value="21"
        sub="bloqueio ou reprogramação registrada"
      />
      <Kpi
        label="Atrasadas sem justificativa"
        marker={<Icon name="octagon" size={13} style={{ color: semJustificativa.cor }} />}
        value="9"
        sub="−4 vs. setembro"
        subStyle={{ color: "var(--enc)", fontWeight: 500 }}
      />
    </div>
  );
}
