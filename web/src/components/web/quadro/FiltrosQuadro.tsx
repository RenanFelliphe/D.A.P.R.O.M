import Link from "next/link";
import { Field } from "@/components/ui/Field";
import type { Equipe } from "@/lib/tipos";

interface FiltrosQuadroProps {
  /** Endereço do quadro (da gestão ou do campo): para onde o formulário envia e para onde o "Limpar" volta. */
  acao: string;
  /** Só o admin escolhe a equipe; os demais enxergam a própria e não há o que escolher (`null`). */
  equipes: Equipe[] | null;
  meses: { valor: string; rotulo: string }[];
  valores: { equipe_id?: string; tipo?: string; critica?: boolean; periodo?: string; busca?: string };
  /** Há algum filtro em uso (liga o "Limpar"). */
  filtrado: boolean;
}

/** Filtros do quadro: formulário GET, então ficam na URL (equipe, tipo, criticidade, período e a busca da barra superior). */
export function FiltrosQuadro({ acao, equipes, meses, valores, filtrado }: FiltrosQuadroProps) {
  return (
    <form className="filters" action={acao} method="get">
      {equipes && (
        <Field label="Equipe" htmlFor="f-eq">
          <select className="select" id="f-eq" name="equipe_id" defaultValue={valores.equipe_id ?? ""}>
            <option value="">Todas as equipes</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Tipo" htmlFor="f-tp">
        <select className="select" id="f-tp" name="tipo" defaultValue={valores.tipo ?? ""}>
          <option value="">Todos</option>
          <option value="preventiva">Preventiva</option>
          <option value="corretiva">Corretiva</option>
        </select>
      </Field>
      <Field label="Criticidade" htmlFor="f-cr">
        <select className="select" id="f-cr" name="critica" defaultValue={valores.critica ? "true" : ""}>
          <option value="">Todas</option>
          <option value="true">Só locais críticos</option>
        </select>
      </Field>
      <Field label="Período (início programado)" htmlFor="f-pe">
        <select className="select" id="f-pe" name="periodo" defaultValue={valores.periodo ?? ""}>
          <option value="">Todos os períodos</option>
          {meses.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.rotulo}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Busca" htmlFor="f-bu">
        <input
          className="input busca-larga"
          id="f-bu"
          name="busca"
          type="search"
          placeholder="Ordem, título, local, nota ou cliente"
          defaultValue={valores.busca ?? ""}
        />
      </Field>
      <button className="btn btn-p btn-sm" type="submit">
        Filtrar
      </button>
      {filtrado && (
        <Link className="btn btn-line btn-sm" href={acao}>
          Limpar
        </Link>
      )}
    </form>
  );
}
