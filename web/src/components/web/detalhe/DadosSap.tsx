import { Panel } from "@/components/web/Panel";
import { dadosSap } from "@/data/detalhe";

/** Lista de dados da OS vindos da planilha do SAP. */
export function DadosSap() {
  return (
    <Panel>
      <h2>Dados do SAP</h2>
      <dl className="dl">
        {dadosSap.map((dado) => (
          <div key={dado.rotulo}>
            <dt>{dado.rotulo}</dt>
            <dd className={dado.mono ? "mono" : undefined}>{dado.valor}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
