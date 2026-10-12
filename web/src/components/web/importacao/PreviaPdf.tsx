import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";
import { ComoVaiFuncionar, type Passo } from "./ComoVaiFuncionar";

const passos: Passo[] = [
  { titulo: "Arquivo recebido", detalhe: "O PDF fica só neste navegador; nada foi enviado ao servidor.", estado: "feito" },
  { titulo: "Leitura dos campos", detalhe: "O sistema localiza no PDF o nº da ordem, o tipo, o local, o centro de trabalho e as datas.", estado: "proximo" },
  { titulo: "Conferência campo a campo", detalhe: "Você confere e corrige cada campo lido antes de gravar.", estado: "proximo" },
  { titulo: "OS registrada", detalhe: "A OS entra como liberada, como as que chegam do SAP; se já existir, só o planejamento é atualizado.", estado: "proximo" },
];

/** `1,2 MB` / `350 KB`. */
function tamanho(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** PDF escolhido na Importação: a leitura ainda não existe, então mostra o arquivo e como o fluxo vai funcionar. */
export function PreviaPdf({ arquivo, url, aoDescartar }: { arquivo: File; url: string; aoDescartar: () => void }) {
  return (
    <Panel>
      <div className="row g12 wrap">
        <span className="arq-tag pdf" aria-hidden="true">
          PDF
        </span>
        <span className="stack" style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>
            {arquivo.name}
          </span>
          <span className="small">{tamanho(arquivo.size)} · recebido agora</span>
        </span>
      </div>
      <div className="previa-pdf">
        <object data={url} type="application/pdf" aria-label={`Prévia de ${arquivo.name}`}>
          <div className="previa-vazia">
            <Icon name="file" size={24} />
            <span className="small">Este navegador não mostra a prévia do PDF.</span>
          </div>
        </object>
        <ComoVaiFuncionar passos={passos} />
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoDescartar}>
          Descartar
        </Button>
      </div>
    </Panel>
  );
}
