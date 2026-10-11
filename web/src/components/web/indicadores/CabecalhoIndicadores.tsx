import { Field } from "@/components/ui/Field";
import { rotas } from "@/lib/rotas";
import type { Equipe } from "@/lib/tipos";

interface CabecalhoIndicadoresProps {
  subtitulo: string;
  mes: string;
  meses: { valor: string; rotulo: string }[];
  equipeId?: string;
  /** Supervisor só vê a própria equipe: sem seletor (`null`). */
  equipes: Equipe[] | null;
}

/** Título da tela e o formulário (GET) de mês e equipe: a escolha fica na URL. */
export function CabecalhoIndicadores({ subtitulo, mes, meses, equipeId, equipes }: CabecalhoIndicadoresProps) {
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack" style={{ gap: 2 }}>
        <h1>Indicadores de preventivas</h1>
        <span className="muted" style={{ fontSize: 14 }}>
          {subtitulo}
        </span>
      </div>
      <form className="row g8" action={rotas.web.indicadores} method="get" style={{ alignItems: "flex-end" }}>
        <Field label="Mês" htmlFor="i-mes" labelStyle={{ fontSize: 12 }}>
          <select className="select" id="i-mes" name="mes" defaultValue={mes} style={{ minWidth: 170 }}>
            {meses.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </Field>
        {equipes && (
          <Field label="Equipe" htmlFor="i-eq" labelStyle={{ fontSize: 12 }}>
            <select className="select" id="i-eq" name="equipe_id" defaultValue={equipeId ?? ""} style={{ minWidth: 190 }}>
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
