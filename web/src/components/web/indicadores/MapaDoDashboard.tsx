import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { MapaDeCalorDoPeriodo } from "@/data/dashboards";
import { MapaDeCalor } from "@/components/web/os/MapaDeCalor";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus, type OsStatus } from "@/lib/tipos";

const STATUS = Object.keys(rotuloDoStatus) as OsStatus[];

/** `todas` tira o filtro e é o que o mapa mostra quando a URL não pede uma situação. */
export const TODAS_AS_SITUACOES = "todas";

export type SituacaoDoMapa = OsStatus | typeof TODAS_AS_SITUACOES;

/** A situação do mapa a partir de `?status=`: uma situação conhecida ou, sem pedido válido, `todas`. */
export function lerSituacaoDoMapa(valor: string | string[] | undefined): SituacaoDoMapa {
  const pedida = (Array.isArray(valor) ? valor[0] : valor)?.trim();
  return STATUS.find((s) => s === pedida) ?? TODAS_AS_SITUACOES;
}

interface MapaDoDashboardProps {
  mapa: MapaDeCalorDoPeriodo;
  situacao: SituacaoDoMapa;
  /** `periodo` e `equipe_id` do filtro do painel, que o formulário da situação leva junto. */
  filtro: { periodo: string; equipeId?: string };
}

/**
 * O destaque do dashboard de OS: onde as OS do período foram executadas, pelo GPS da execução, com a lista das áreas mais
 * movimentadas ao lado (no lugar do antigo ranking de locais). O período e a equipe são os do filtro do painel; só a
 * situação da OS é escolhida aqui, num formulário (GET) que mantém os outros dois.
 */
export function MapaDoDashboard({ mapa, situacao, filtro }: MapaDoDashboardProps) {
  const cobertura = mapa.os_no_periodo > 0 ? Math.round((mapa.com_localizacao / mapa.os_no_periodo) * 100) : 0;
  return (
    <section id="mapa-calor" className="stack g12" aria-labelledby="mapa-calor-t">
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="mapa-calor-t" className="secao-t">
            Mapa de calor
          </h2>
          <span className="muted">
            Onde as OS foram executadas, pelo GPS da execução.{" "}
            {mapa.os_no_periodo === 0
              ? "Nenhuma OS neste filtro."
              : `${mapa.com_localizacao} de ${mapa.os_no_periodo} no mapa (${cobertura}%); ${mapa.sem_localizacao === 0 ? "todas têm localização." : `${mapa.sem_localizacao} sem localização.`}`}
          </span>
        </div>
        <form className="filters" action={rotas.app.dashboardOs} method="get" aria-label="Situação das OS no mapa">
          <input type="hidden" name="periodo" value={filtro.periodo} />
          {filtro.equipeId && <input type="hidden" name="equipe_id" value={filtro.equipeId} />}
          <Field label="Situação da OS" htmlFor="mapa-situacao" labelStyle={{ fontSize: 12 }}>
            <select className="select" id="mapa-situacao" name="status" defaultValue={situacao}>
              <option value={TODAS_AS_SITUACOES}>Todas as situações</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {rotuloDoStatus[s]}
                </option>
              ))}
            </select>
          </Field>
          <button className="btn btn-p btn-sm" type="submit">
            <Icon name="filter" size={16} />
            Aplicar
          </button>
        </form>
      </div>
      <MapaDeCalor celulas={mapa.celulas} />
    </section>
  );
}
