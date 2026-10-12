import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";

/** Colunas da planilha que o sistema reconhece (as obrigatórias primeiro); os cabeçalhos aceitos vêm de `api/src/dominio/importacao-planilha.ts`. */
const obrigatorias = ["Ordem", "Tipo de ordem (YBA1 / YBA2 ou corretiva / preventiva)", "Título (texto breve)", "Centro de trabalho → equipe", "Local de instalação", "Início programado"];
const opcionais = [
  "Nota e tipo de atividade",
  "Código da atividade (define o modelo de APR)",
  "Descrição, materiais e ferramentas",
  "Endereço, plus code e cliente do local",
  "Equipamento e prioridade",
  "Fim programado",
  "Status do sistema (precisa conter LIB)",
  "Solicitante, plano e item de manutenção",
];

function Lista({ itens, icone }: { itens: string[]; icone: "check" | "plus" }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5 }}>
      {itens.map((coluna) => (
        <li key={coluna} className="row g8">
          <Icon name={icone} size={13} style={{ color: "var(--enc)", flex: "none" }} />
          {coluna}
        </li>
      ))}
    </ul>
  );
}

/** As colunas da planilha que o sistema reconhece, obrigatórias ao lado das opcionais (o título fica na página). */
export function ColunasLidas() {
  return (
    <Panel>
      <div className="two eq">
        <div className="stack g8">
          <span className="lbl">Obrigatórias</span>
          <span className="small">Sem qualquer uma delas, a planilha inteira é recusada.</span>
          <Lista itens={obrigatorias} icone="check" />
        </div>
        <div className="stack g8">
          <span className="lbl">Opcionais</span>
          <span className="small">Preenchem o restante da OS quando vêm na planilha.</span>
          <Lista itens={opcionais} icone="plus" />
        </div>
      </div>
      <p className="small">O mapeamento será ajustado ao export oficial do SAP quando ele chegar.</p>
    </Panel>
  );
}
