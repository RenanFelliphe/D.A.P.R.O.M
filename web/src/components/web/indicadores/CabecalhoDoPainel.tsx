import { Field } from "@/components/ui/Field";
import { dataDoDia, hoje, hora } from "@/lib/formatar";
import type { Equipe } from "@/lib/tipos";
import { mesesDoFiltro, PERIODOS_MOVEIS, rotuloDoPeriodo, type FiltroDoPainel } from "./filtro";

interface CabecalhoDoPainelProps {
  /** A página do dashboard (o formulário volta para ela). */
  acao: string;
  filtro: FiltroDoPainel;
  /** Intervalo que a `api` resolveu para o período. */
  de: string;
  ate: string;
  /** Só o admin escolhe a equipe; os demais veem a própria: sem seletor (`null`), com o nome dela no resumo. */
  equipes: Equipe[] | null;
  nomeDaEquipe?: string;
}

/**
 * Linha do topo de cada dashboard: o período resolvido, a equipe e a hora, e o formulário (GET) do filtro comum. A
 * escolha fica na URL e acompanha a troca de aba.
 */
export function CabecalhoDoPainel({ acao, filtro, de, ate, equipes, nomeDaEquipe }: CabecalhoDoPainelProps) {
  const equipe = nomeDaEquipe ?? equipes?.find((e) => e.id === filtro.equipeId)?.nome ?? "todas as equipes";
  const meses = mesesDoFiltro(hoje().slice(0, 7));
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack" style={{ gap: 2 }}>
        <h2 className="secao-t">{rotuloDoPeriodo(filtro.periodo)}</h2>
        <span className="muted" style={{ fontSize: 14 }}>
          {`De ${dataDoDia(de)} a ${dataDoDia(ate)} · ${equipe} · atualizado às ${hora(new Date())}`}
        </span>
      </div>
      <form className="filters" action={acao} method="get">
        <Field label="Período" htmlFor="p-periodo" labelStyle={{ fontSize: 12 }}>
          <select className="select" id="p-periodo" name="periodo" defaultValue={filtro.periodo}>
            <optgroup label="Até hoje">
              {PERIODOS_MOVEIS.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.rotulo}
                </option>
              ))}
            </optgroup>
            <optgroup label="Mês fechado">
              {meses.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        {equipes && (
          <Field label="Equipe" htmlFor="p-equipe" labelStyle={{ fontSize: 12 }}>
            <select className="select" id="p-equipe" name="equipe_id" defaultValue={filtro.equipeId ?? ""}>
              <option value="">Todas as equipes</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </Field>
        )}
        <button className="btn btn-p btn-sm" type="submit">
          Atualizar
        </button>
      </form>
    </div>
  );
}
