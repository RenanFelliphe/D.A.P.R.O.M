import { Icon } from "@/components/ui/Icon";
import type { AlertaBloqueio } from "@/data/alertas";
import { BotaoMarcarComoLido } from "./BotaoMarcarComoLido";
import { CartaoApoio } from "./CartaoApoio";
import { CartaoReprogramar } from "./CartaoReprogramar";

const rotuloBloqueio = { color: "#6B2A23" } as const;

/** Corpo do detalhe de um impedimento: contexto, evidência e decisão do supervisor. */
export function DetalheBloqueio({ alerta }: { alerta: AlertaBloqueio }) {
  return (
    <>
      <dl className="dl" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
        <div>
          <dt>Local</dt>
          <dd>{alerta.endereco}</dd>
        </div>
        <div>
          <dt>Equipe em campo</dt>
          <dd>{alerta.equipe}</dd>
        </div>
        <div>
          <dt>Quando</dt>
          <dd>{alerta.quandoDetalhe}</dd>
        </div>
        <div>
          <dt>Aviso</dt>
          <dd>Painel e e-mail ao supervisor</dd>
        </div>
      </dl>
      <div className="blockbox">
        <div className="stack g8" style={{ flex: 1, minWidth: 0 }}>
          <div>
            <div className="small" style={rotuloBloqueio}>
              {alerta.itemRotulo}
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>
              {alerta.item.texto}
              {alerta.item.destaque && (
                <>
                  {" "}
                  <span style={{ color: "var(--blq)" }}>{alerta.item.destaque}</span>
                </>
              )}
            </div>
          </div>
          <div>
            <div className="small" style={rotuloBloqueio}>
              Observação do técnico
            </div>
            <div style={{ fontSize: 14.5 }}>“{alerta.observacao}”</div>
          </div>
        </div>
        <figure className="stack g4" style={{ margin: 0, flex: "0 0 170px" }}>
          <div
            className="photo"
            role="img"
            aria-label="Foto do impedimento"
            style={{ height: 120, alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="image" size={24} />
          </div>
          <figcaption className="small">
            <span className="mono">{alerta.foto}</span> · com GPS
          </figcaption>
        </figure>
      </div>
      <div className="stack g4">
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>O que fazer com a OS</h3>
        <p className="muted">
          A OS fica pendente. A equipe pode fazer uma nova APR a qualquer momento; você acompanha e pode reprogramar ou
          abrir uma OS de apoio. Nada feito em campo é apagado.
        </p>
      </div>
      <div className="decide">
        <CartaoApoio apoio={alerta.apoio} />
        <CartaoReprogramar />
      </div>
      <div className="row between wrap" style={{ paddingTop: 4, borderTop: "1px solid var(--line2)" }}>
        <span className="muted">{alerta.nota}</span>
        <BotaoMarcarComoLido />
      </div>
    </>
  );
}
