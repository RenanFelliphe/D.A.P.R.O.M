import { Icon } from "@/components/ui/Icon";

/** Card que explica a APR exigida antes de executar a OS. */
export function AprExigidaCard() {
  return (
    <div className="card stack g6">
      <div className="row g8">
        <Icon name="clip" size={18} style={{ color: "var(--brand)" }} />
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>APR exigida antes de executar</h2>
      </div>
      <div style={{ fontSize: 14 }}>APR 03 — Operação e manutenção · versão 4</div>
      <div className="muted">
        Esta OS tem uma APR própria: ela não vale para outras OS do mesmo local. O modelo vem do tipo de atividade. Há 1
        APR anterior negativa (12/10): qualquer pessoa da equipe pode fazer a nova.
      </div>
    </div>
  );
}
