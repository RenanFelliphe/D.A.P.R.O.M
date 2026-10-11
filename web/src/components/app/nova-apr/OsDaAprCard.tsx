/** Seção com a OS à qual esta APR pertence (uma APR vale para uma única OS). */
export function OsDaAprCard() {
  return (
    <div className="stack g8">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>OS desta APR</h2>
      <div className="card stack" style={{ gap: 2 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          OS 4031187 · ERP Serra
        </span>
        <span style={{ fontSize: 14, lineHeight: 1.3 }}>Inspeção de corrosão em válvulas da ERP</span>
        <span className="muted">Uma APR vale para uma única OS. Para outra OS, faça outra APR.</span>
      </div>
    </div>
  );
}
