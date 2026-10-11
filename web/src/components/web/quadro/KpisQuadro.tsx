import { Icon } from "@/components/ui/Icon";
import { Kpi } from "@/components/web/Panel";
import { kpisQuadro, type KpiQuadro } from "@/data/quadro";

const estiloSub = {
  blq: { color: "var(--blq)", fontWeight: 500 },
  enc: { color: "var(--enc)", fontWeight: 500 },
} as const;

function marcador({ cor, icone }: KpiQuadro) {
  if (icone) return <Icon name={icone} size={13} style={{ color: "var(--blq)" }} />;
  return <i style={{ background: cor }}></i>;
}

/** Faixa de cinco indicadores do quadro. */
export function KpisQuadro() {
  return (
    <div className="kpis">
      {kpisQuadro.map((kpi) => (
        <Kpi
          key={kpi.rotulo}
          label={kpi.rotulo}
          marker={marcador(kpi)}
          value={kpi.valor}
          sub={kpi.sub}
          subStyle={kpi.subTom ? estiloSub[kpi.subTom] : undefined}
        />
      ))}
    </div>
  );
}
