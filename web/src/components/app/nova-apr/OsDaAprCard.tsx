/** Seção com a OS à qual esta APR pertence (uma APR vale para uma única OS). */
export function OsDaAprCard({ os }: { os: { rotulo: string; titulo: string; local: string } }) {
  return (
    <div className="stack g8">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>OS desta APR</h2>
      <div className="card stack" style={{ gap: 2 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {os.rotulo} · {os.local}
        </span>
        <span style={{ fontSize: 14, lineHeight: 1.3 }}>{os.titulo}</span>
        <span className="muted">Uma APR vale para uma única OS. Para outra OS, faça outra APR.</span>
      </div>
    </div>
  );
}
