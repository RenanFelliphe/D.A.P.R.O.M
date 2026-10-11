import { Panel } from "@/components/web/Panel";
import { linhaDoTempo } from "@/data/detalhe";

/** Histórico de eventos da OS, do import ao PDF. */
export function LinhaDoTempo() {
  return (
    <Panel>
      <h2>Linha do tempo</h2>
      <ol className="timeline">
        {linhaDoTempo.map((evento, i) => {
          const ultimo = i === linhaDoTempo.length - 1;
          return (
            <li key={`${evento.quando}-${evento.titulo}`}>
              <div className="dot">
                <i style={{ background: evento.cor }}></i>
                <b style={ultimo ? { background: "transparent" } : undefined}></b>
              </div>
              <div className="tx" style={ultimo ? { paddingBottom: 0 } : undefined}>
                <span className="w">{evento.quando}</span>
                <strong>{evento.titulo}</strong>
                <span className="d">{evento.detalhe}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
