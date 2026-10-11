import { Field } from "@/components/ui/Field";

/** Título da tela e filtros de mês e equipe. */
export function CabecalhoIndicadores() {
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack" style={{ gap: 2 }}>
        <h1>Indicadores de preventivas</h1>
        <span className="muted" style={{ fontSize: 14 }}>
          Outubro de 2026 · todas as equipes · atualizado às 12:41
        </span>
      </div>
      <div className="row g8" style={{ alignItems: "flex-end" }}>
        <Field label="Mês" htmlFor="i-mes" labelStyle={{ fontSize: 12 }}>
          <select className="select" id="i-mes" style={{ minWidth: 170 }}>
            <option>Outubro de 2026</option>
            <option>Setembro de 2026</option>
          </select>
        </Field>
        <Field label="Equipe" htmlFor="i-eq" labelStyle={{ fontSize: 12 }}>
          <select className="select" id="i-eq" style={{ minWidth: 190 }}>
            <option>Todas as equipes</option>
            <option>Serviços Especiais</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
