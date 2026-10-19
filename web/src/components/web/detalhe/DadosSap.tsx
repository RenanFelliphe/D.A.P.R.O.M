import { Panel } from "@/components/web/Panel";
import type { OsDetalhe } from "@/data/detalhe";
import { dataDoDia } from "@/lib/formatar";

interface Dado {
  rotulo: string;
  valor: string | null | undefined;
  mono?: boolean;
}

const ROTULO_ORIGEM: Record<OsDetalhe["origem"], string> = {
  sap: "Lida do SAP",
  planilha: "Importada da planilha",
  pdf: "Importada do PDF da OS",
  apoio: "Aberta como apoio",
  digitalizacao: "Digitalizada (executada no papel)",
};

/** Dados da OS que vêm do SAP (a OS de apoio ainda não tem número). Campos que não vieram ficam de fora. */
export function DadosSap({ os }: { os: OsDetalhe }) {
  const dados: Dado[] = [
    { rotulo: "Ordem", valor: os.numero_ordem, mono: true },
    { rotulo: "Nota", valor: os.numero_nota, mono: true },
    { rotulo: "Tipo de atividade", valor: os.tipo_atividade },
    { rotulo: "Código da atividade", valor: os.codigo_atividade, mono: true },
    { rotulo: "Centro de trabalho", valor: os.equipe.centro_trabalho, mono: true },
    { rotulo: "Equipamento", valor: os.equipamento, mono: true },
    { rotulo: "Prioridade", valor: os.prioridade },
    { rotulo: "Início programado", valor: dataDoDia(os.data_inicio_prog) },
    { rotulo: "Fim programado", valor: os.data_fim_prog ? dataDoDia(os.data_fim_prog) : null },
    { rotulo: "Plano de manutenção", valor: os.plano_manutencao },
    { rotulo: "Item de manutenção", valor: os.item_manutencao },
    { rotulo: "Solicitante", valor: os.solicitante },
    { rotulo: "Cliente", valor: os.local_instalacao.cliente },
    { rotulo: "Plus code do local", valor: os.local_instalacao.plus_code },
    { rotulo: "Status no SAP", valor: os.status_sap },
    { rotulo: "Origem", valor: ROTULO_ORIGEM[os.origem] },
  ];
  return (
    <Panel>
      <h2>Dados</h2>
      <dl className="dl">
        {dados
          .filter((d) => d.valor)
          .map((d) => (
            <div key={d.rotulo}>
              <dt>{d.rotulo}</dt>
              <dd className={d.mono ? "mono" : undefined}>{d.valor}</dd>
            </div>
          ))}
      </dl>
      {os.descricao && (
        <div>
          <div className="small" style={{ color: "var(--ink4)" }}>
            Descrição
          </div>
          <p style={{ fontSize: 14.5 }}>{os.descricao}</p>
        </div>
      )}
    </Panel>
  );
}
