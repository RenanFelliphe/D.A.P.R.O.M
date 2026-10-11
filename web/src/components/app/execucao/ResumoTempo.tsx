import { Notice } from "@/components/ui/Notice";

/** Cartão com início, tempo líquido e totais da execução; mostra o aviso quando a execução está em pausa. */
export function ResumoTempo({ emPausa }: { emPausa: boolean }) {
  return (
    <div className="card stack g12">
      <div className="row between">
        <div className="stack" style={{ gap: 2 }}>
          <span className="lbl">Início</span>
          <strong style={{ fontSize: 16 }}>Hoje, 09:31</strong>
          <span className="small">Horário do aparelho</span>
        </div>
        <div className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
          <span className="lbl">Tempo líquido</span>
          <span className="mono" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
            1h35
          </span>
        </div>
      </div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="stack">
          <span className="small">Tempo total</span>
          <strong className="mono">1h47</strong>
        </div>
        <div className="stack">
          <span className="small">Pausas</span>
          <strong className="mono">0h12 · 1</strong>
        </div>
        <div className="stack">
          <span className="small">Pessoas</span>
          <strong className="mono">2</strong>
        </div>
      </div>
      {emPausa && (
        <Notice tone="al" icon="pause">
          <strong>Em pausa desde 10:15.</strong> O tempo de pausa não entra no tempo líquido.
        </Notice>
      )}
    </div>
  );
}
