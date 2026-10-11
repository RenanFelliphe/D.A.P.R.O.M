import { Field } from "@/components/ui/Field";
import { filtrosQuadro } from "@/data/quadro";

/** Filtros do quadro (equipe, tipo, criticidade e período). */
export function FiltrosQuadro() {
  return (
    <div className="filters">
      {filtrosQuadro.map((filtro) => (
        <Field key={filtro.id} label={filtro.rotulo} htmlFor={filtro.id}>
          <select className="select" id={filtro.id} defaultValue={filtro.opcoes[0]}>
            {filtro.opcoes.map((opcao) => (
              <option key={opcao}>{opcao}</option>
            ))}
          </select>
        </Field>
      ))}
      <span className="muted" style={{ marginLeft: "auto" }}>
        Locais críticos aparecem primeiro em cada coluna
      </span>
    </div>
  );
}
