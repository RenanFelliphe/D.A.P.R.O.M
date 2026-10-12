import type { CSSProperties } from "react";
import { dataDoDia } from "@/lib/formatar";
import type { OsDetalhada } from "@/lib/os-app";
import { cx } from "@/lib/cx";

const lista: CSSProperties = {
  margin: 0,
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "10px 14px",
  fontSize: 14,
};

interface Campo {
  rotulo: string;
  valor: string | null;
  /** Valor em fonte monoespaçada (códigos). */
  mono?: boolean;
}

/** Card com os dados da OS, sempre aberto; campo que o SAP não trouxe não aparece. */
export function DadosSapCard({ os }: { os: OsDetalhada }) {
  const campos: Campo[] = [
    { rotulo: "Ordem", valor: os.numero_ordem, mono: true },
    { rotulo: "Nota", valor: os.numero_nota, mono: true },
    { rotulo: "Centro de trabalho", valor: os.equipe.centro_trabalho, mono: true },
    { rotulo: "Equipamento", valor: os.equipamento, mono: true },
    { rotulo: "Tipo de atividade", valor: os.tipo_atividade },
    { rotulo: "Plano de manutenção", valor: os.plano_manutencao, mono: true },
    { rotulo: "Início programado", valor: os.data_inicio_prog ? dataDoDia(os.data_inicio_prog) : null },
    { rotulo: "Fim programado", valor: os.data_fim_prog ? dataDoDia(os.data_fim_prog) : null },
    { rotulo: "Status no SAP", valor: os.status_sap, mono: true },
  ];
  return (
    <div className="card stack g8">
      <h2 style={{ fontSize: 15, fontWeight: 600 }}>Dados</h2>
      <dl style={lista}>
        {campos
          .filter((campo) => campo.valor)
          .map((campo) => (
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
