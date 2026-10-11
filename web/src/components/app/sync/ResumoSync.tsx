import { registrosFila, totalArquivos } from "@/data/sincronizacao";
import type { EstadoSync } from "@/state/sincronizacao";

/** Percentual geral enviado (arquivos + registros). */
export function percentualSync({ situacao, arquivos, registros }: EstadoSync): number {
  if (situacao === "concluida") return 100;
  return Math.min(100, Math.round(((arquivos + registros) / (totalArquivos + registrosFila.length)) * 100));
}

/** Totais de arquivos e registros com a barra de progresso. */
export function ResumoSync({ estado }: { estado: EstadoSync }) {
  const concluida = estado.situacao === "concluida";
  const arquivos = concluida ? totalArquivos : estado.arquivos;
  const registros = concluida ? registrosFila.length : estado.registros;

  return (
    <div className="card stack g12" style={{ borderRadius: 12, padding: 16 }}>
      <div className="stat-grid">
        <div className="stat stack" style={{ gap: 2 }}>
          <span className="lbl">Arquivos</span>
          <span className="big">
            {arquivos} de {totalArquivos}
          </span>
          <span className="small" style={{ color: "var(--enc)", fontWeight: 500 }}>
            Fotos e assinaturas · 2,1 MB
          </span>
        </div>
        <div className="stat stack" style={{ gap: 2 }}>
          <span className="lbl">Registros</span>
          <span className="big">
            {registros} de {registrosFila.length}
          </span>
          <span className="small">confirmados pelo servidor</span>
        </div>
      </div>
      <div className="progress">
        <i style={{ width: `${percentualSync(estado)}%` }} />
      </div>
      <div className="small">Ordem: arquivos → registros → novidades da equipe.</div>
    </div>
  );
}
