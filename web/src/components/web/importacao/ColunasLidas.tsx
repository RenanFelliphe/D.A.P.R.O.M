import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";

/** Colunas da planilha que o sistema reconhece (as obrigatórias primeiro); os cabeçalhos aceitos vêm de `api/src/dominio/importacao-planilha.ts`. */
const obrigatorias = ["Ordem", "Tipo de ordem (YBA1 / YBA2 ou corretiva / preventiva)", "Título (texto breve)", "Centro de trabalho → equipe", "Local de instalação", "Início programado"];
const opcionais = [
  "Nota e tipo de atividade",
  "Código da atividade (o serviço do catálogo, com a lista de materiais)",
  "Descrição, materiais e ferramentas",
  "Endereço, plus code e cliente do local",
  "Equipamento e prioridade",
  "Fim programado",
  "Status do sistema (precisa conter LIB)",
  "Solicitante, plano e item de manutenção",
  "Intervalo entre ciclos da preventiva (Intervalo ou Periodicidade: 3 meses, 30 dias, trimestral)",
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

/** Os rótulos impressos na OS do SAP de onde sai cada campo (`api/src/dominio/importacao-pdf.ts`). */
const rotulosDoPdf = [
  "Ordem de Manutenção (o número no cabeçalho de cada folha)",
  "Tipo Ativ Manut (Z01 corretiva, Z02 preventiva)",
  "Centro de trabalho principal da ordem",
  "O título, logo acima de Objetos técnicos",
  "Local de Instalação e Endereço",
  "Data de inicio programada e Data fim programada",
  "Equipamento, Prioridade, Nota, Plano e Item de manutenção",
  "Periodicidade (o intervalo entre ciclos da preventiva, conferido na tela)",
  "Status do sistema, Criado por e Data da Ordem",
  "O texto longo, depois da tabela de operações",
];

/** As colunas da planilha que o sistema reconhece, obrigatórias ao lado das opcionais, e o que sai do PDF da OS (o título fica na página). */
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
      <div className="stack g8" style={{ paddingTop: 12, borderTop: "1px solid var(--line2)" }}>
        <span className="lbl">PDF da OS</span>
        <span className="small">
          Do PDF gerado pelo SAP, o sistema lê os mesmos campos pelos rótulos impressos. Antes de registrar, você confere cada OS ao lado do PDF e preenche o
          que faltou; o número da ordem vem sempre do documento. Uma folha digitalizada (só imagem) não tem texto para ler.
        </span>
        <Lista itens={rotulosDoPdf} icone="check" />
      </div>
    </Panel>
  );
}
