import { colunasLidas } from "@/data/importacao";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";

/** Lista das colunas da planilha que o sistema reconhece. */
export function ColunasLidas() {
  return (
    <Panel>
      <h2>Colunas lidas da planilha</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5 }}>
        {colunasLidas.map((coluna) => (
          <li key={coluna} className="row g8">
            <Icon name="check" size={13} style={{ color: "var(--enc)" }} />
            {coluna}
          </li>
        ))}
      </ul>
      <p className="small">O mapeamento é configurável e será ajustado ao export oficial do SAP.</p>
    </Panel>
  );
}
