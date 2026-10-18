import { Kpi } from "@/components/web/Panel";
import type { ContagemPorStatus } from "@/data/quadro";

/** Totais por status (já com os filtros aplicados, menos o próprio status). */
export function KpisQuadro({ contagem, periodo }: { contagem: ContagemPorStatus; periodo: string }) {
  return (
    <div className="kpis">
      <Kpi label="Liberadas" marker={<i style={{ background: "#1C5CAB" }}></i>} value={contagem.liberada} sub="aguardam APR e execução" />
      <Kpi label="Em execução" marker={<i style={{ background: "#C98500" }}></i>} value={contagem.em_execucao} sub="em campo agora" />
      <Kpi
        label="Pendentes"
        marker={<i style={{ background: "#D03B3B" }}></i>}
        value={contagem.pendente}
        sub="aguardam nova APR"
        subStyle={contagem.pendente > 0 ? { color: "var(--blq)", fontWeight: 500 } : undefined}
      />
      <Kpi
        label="Aguardando assinaturas"
        marker={<i style={{ background: "#C98500" }}></i>}
        value={contagem.encerrando + contagem.aguardando_supervisor}
        sub={`${contagem.aguardando_supervisor} esperam o supervisor`}
        subStyle={contagem.aguardando_supervisor > 0 ? { color: "var(--al)", fontWeight: 500 } : undefined}
      />
      <Kpi
        label="Encerradas"
        marker={<i style={{ background: "#0CA30C" }}></i>}
        value={contagem.encerrada}
        sub={periodo}
        subStyle={{ color: "var(--enc)", fontWeight: 500 }}
      />
    </div>
  );
}
