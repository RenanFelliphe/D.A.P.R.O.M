import { Notice } from "@/components/ui/Notice";
import { hora } from "@/lib/formatar";
import { calcularTempo, cronometro, diaDe, horasMinutos, type PausaDaApi } from "./tempo";

interface ResumoTempoProps {
  inicio: string;
  pausas: PausaDaApi[];
  numeroPessoas: number;
  /** Instante atual em ms (relógio do aparelho); nulo antes de a tela montar no navegador. */
  agora: number | null;
}

/** Cartão com o cronômetro (tempo líquido), início e totais da execução, calculados do início e das pausas da `api`. */
export function ResumoTempo({ inicio, pausas, numeroPessoas, agora }: ResumoTempoProps) {
  const tempo = agora === null ? null : calcularTempo(inicio, pausas, agora);
  const aberta = pausas.find((p) => !p.fim);
  const hoje = agora !== null && diaDe(inicio) === diaDe(new Date(agora));
  return (
    <div className="card stack g12">
      <div className="row between">
        <div className="stack" style={{ gap: 2 }}>
          <span className="lbl">Início</span>
          <strong style={{ fontSize: 16 }}>{hoje ? "Hoje" : ""} {hora(inicio)}</strong>
          <span className="small">Horário do aparelho</span>
        </div>
        <div className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
          <span className="lbl">Tempo líquido</span>
          <span className="mono" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }} aria-label="Cronômetro" role="timer">
            {tempo ? cronometro(tempo.liquidoMs) : "–:––:––"}
          </span>
        </div>
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="stack">
          <span className="small">Tempo total</span>
          <strong className="mono">{tempo ? horasMinutos(tempo.totalMs) : "—"}</strong>
        </div>
        <div className="stack">
          <span className="small">Pausas</span>
          <strong className="mono">{tempo ? `${horasMinutos(tempo.pausaMs)} · ${pausas.length}` : "—"}</strong>
        </div>
        <div className="stack">
          <span className="small">Pessoas</span>
          <strong className="mono">{numeroPessoas}</strong>
        </div>
      </div>
      {aberta && (
        <Notice tone="al" icon="pause">
          <strong>Em pausa desde {hora(aberta.inicio)}.</strong> O tempo de pausa não entra no tempo líquido.
        </Notice>
      )}
    </div>
  );
}
