/** Card com o modelo de APR definido pelo tipo de atividade da OS. */
export function ModeloAprCard() {
  return (
    <div className="card stack" style={{ gap: 2 }}>
      <span className="lbl">Modelo</span>
      <strong style={{ fontSize: 16 }}>APR 03 — Operação e manutenção</strong>
      <span className="muted">
        Versão 4 · publicada em 02/09/2026 pela Segurança do Trabalho · definido pelo tipo de atividade da OS
      </span>
    </div>
  );
}
