import { Panel } from "@/components/web/Panel";
import type { EventoDaLinhaDoTempo } from "@/data/detalhe";
import { dataHora } from "@/lib/formatar";

const VERDE = "#0CA30C";
const VERMELHO = "#D03B3B";
const AMBAR = "#C98500";
const AZUL = "#1C5CAB";
const CINZA = "#9AA29A";

const titulos: Record<string, string> = {
  apr_concluida: "APR concluída",
  execucao_iniciada: "Execução iniciada",
  pausa_iniciada: "Pausa iniciada",
  pausa_encerrada: "Pausa encerrada",
  execucao_encerrada: "Execução encerrada",
  execucao_interrompida: "Execução interrompida",
  execucao_suspensa: "Execução suspensa",
  execucao_cancelada: "Execução cancelada",
  alerta: "Alerta ao supervisor",
  reprogramacao: "Reprogramada",
  ciencia: "Ciência do supervisor",
  reserva: "OS reservada",
  reserva_desfeita: "Reserva desfeita",
  devolucao: "Devolvida ao SAP",
};

function corDoEvento(e: EventoDaLinhaDoTempo) {
  switch (e.tipo) {
    case "apr_concluida":
      return e.descricao.startsWith("APR bloqueada") ? VERMELHO : VERDE;
    case "execucao_iniciada":
    case "pausa_iniciada":
    case "pausa_encerrada":
    case "execucao_suspensa":
      return AMBAR;
    case "execucao_encerrada":
    case "ciencia":
      return VERDE;
    case "execucao_interrompida":
    case "alerta":
      return VERMELHO;
    case "reprogramacao":
    case "reserva":
    case "reserva_desfeita":
      return AZUL;
    case "devolucao":
      return VERMELHO;
    default:
      return CINZA;
  }
}

/** Histórico de eventos da OS em ordem cronológica (APRs, execução, pausas, alertas, reprogramações e ciência). */
export function LinhaDoTempo({ eventos }: { eventos: EventoDaLinhaDoTempo[] }) {
  return (
    <Panel>
      <h2>Linha do tempo</h2>
      {eventos.length === 0 ? (
        <p className="muted">Nada registrado ainda.</p>
      ) : (
        <ol className="timeline">
          {eventos.map((evento, i) => {
            const ultimo = i === eventos.length - 1;
            return (
              <li key={`${evento.em}-${i}`}>
                <div className="dot">
                  <i style={{ background: corDoEvento(evento) }}></i>
                  <b style={ultimo ? { background: "transparent" } : undefined}></b>
                </div>
                <div className="tx" style={ultimo ? { paddingBottom: 0 } : undefined}>
                  <span className="w">{dataHora(evento.em)}</span>
                  <strong>{titulos[evento.tipo] ?? evento.tipo}</strong>
                  <span className="d">{evento.descricao}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
