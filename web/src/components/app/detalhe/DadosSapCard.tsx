import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import { camposSap } from "@/data/detalhe-app";

const lista: CSSProperties = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "10px 14px",
  fontSize: 14,
};

/** Card com os dados da OS vindos do SAP, em lista de definição de 2 colunas. */
export function DadosSapCard() {
  return (
    <div className="card stack g8">
      <h2 style={{ fontSize: 15, fontWeight: 600 }}>Dados do SAP</h2>
      <dl style={lista}>
        {camposSap.map((campo) => (
          <div key={campo.rotulo}>
            <dt className="small" style={{ color: "var(--ink4)" }}>
              {campo.rotulo}
            </dt>
            <dd className={cx(campo.mono && "mono")} style={{ margin: 0 }}>
              {campo.valor}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
