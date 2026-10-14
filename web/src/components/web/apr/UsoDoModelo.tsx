import { Panel } from "@/components/web/Panel";
import type { UsoDoModelo as Uso } from "@/data/modelos";
import { data } from "@/lib/formatar";

/**
 * Onde o modelo é usado: as APRs já respondidas em qualquer versão. Nenhuma OS fica presa ao modelo: o técnico o escolhe a
 * cada APR, com a recomendação da orientação.
 */
export function UsoDoModelo({ uso }: { uso: Uso }) {
  const { aprs } = uso;
  const aprovadas = aprs.total - aprs.bloqueadas;
  return (
    <Panel style={{ padding: 16, gap: 14 }}>
      <h2 style={{ fontSize: 15 }}>Onde é usado</h2>
      <div className="uso-num">
        <span>
          <b>{aprs.total}</b> {aprs.total === 1 ? "APR" : "APRs"}
        </span>
        <span>
          <b>{aprovadas}</b> {aprovadas === 1 ? "aprovada" : "aprovadas"}
        </span>
        <span>
          <b>{aprs.bloqueadas}</b> {aprs.bloqueadas === 1 ? "bloqueada" : "bloqueadas"}
        </span>
      </div>
      <span className="small">
        {aprs.total === 0
          ? "Nenhuma APR respondida ainda. O técnico escolhe o modelo a cada APR."
          : `Respondidas em qualquer versão · a última em ${data(aprs.ultima_em)}.`}
      </span>
    </Panel>
  );
}
