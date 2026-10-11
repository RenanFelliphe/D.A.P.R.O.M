import { Icon } from "@/components/ui/Icon";
import { Kpi } from "@/components/web/Panel";
import { situacoes, type IndicadoresDeTempo, type IndicadoresDoMes } from "@/data/indicadores";
import { duracao } from "@/lib/formatar";

const [encerradas, comJustificativa, semJustificativa] = situacoes;

/** Quatro indicadores do mês, com as mesmas cores das barras do gráfico, mais o tempo líquido médio. */
export function KpisIndicadores({ mes, tempo }: { mes: IndicadoresDoMes; tempo: IndicadoresDeTempo }) {
  const total = mes.encerradas + mes.atrasadas_justificadas + mes.atrasadas_sem_justificativa;
  const pct = total > 0 ? Math.round((mes.encerradas / total) * 100) : null;
  return (
    <div className="kpis k4">
      <Kpi
        label="Encerradas"
        marker={<Icon name="check" size={13} style={{ color: encerradas.cor }} />}
        value={mes.encerradas}
        sub={pct === null ? "nenhuma preventiva encerrada ou atrasada no mês" : `${pct}% entre as encerradas e as atrasadas`}
      />
      <Kpi
        label="Atrasadas com justificativa"
        marker={<Icon name="alert" size={13} style={{ color: comJustificativa.cor }} />}
        value={mes.atrasadas_justificadas}
        sub="bloqueio ou reprogramação registrada"
      />
      <Kpi
        label="Atrasadas sem justificativa"
        marker={<Icon name="octagon" size={13} style={{ color: semJustificativa.cor }} />}
        value={mes.atrasadas_sem_justificativa}
        sub="ainda liberadas, sem reprogramação"
        subStyle={mes.atrasadas_sem_justificativa > 0 ? { color: "var(--blq)", fontWeight: 500 } : undefined}
      />
      <Kpi
        label="Tempo líquido médio"
        marker={<Icon name="clock" size={13} style={{ color: "var(--ink3)" }} />}
        value={tempo.tempo_liquido_medio_min === null ? "—" : duracao(tempo.tempo_liquido_medio_min)}
        sub={tempo.execucoes === 0 ? "sem execução encerrada no mês" : `${tempo.execucoes} ${tempo.execucoes === 1 ? "execução encerrada" : "execuções encerradas"}`}
      />
    </div>
  );
}
