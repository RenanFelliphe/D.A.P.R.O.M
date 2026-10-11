import { LinkAviso } from "@/components/ui/Aviso";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { verificacoesModelo } from "@/data/modelos";
import { TabelaPerguntas } from "./TabelaPerguntas";

const botaoVersao = { height: 36, fontSize: 13 } as const;

/** Editor do rascunho da v5 da APR 03: seletor de versão, perguntas e ações de publicação. */
export function EditorModelo() {
  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g4">
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
            APR 03
          </span>
          <h2 style={{ fontSize: 22, lineHeight: 1.2 }}>Operação e manutenção</h2>
        </div>
        <div className="row g6">
          <Button variant="line" sm aviso="Mostraria a v4, em uso." style={botaoVersao}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0CA30C", display: "inline-block" }}></span>
            v4 · em uso
          </Button>
          <Button sm style={{ ...botaoVersao, background: "var(--ink)", color: "#fff" }}>
            v5 · rascunho
          </Button>
        </div>
      </div>
      <Notice tone="info" icon="info">
        Você está editando o rascunho da v5. A v4 continua valendo para as APRs novas até a publicação; os celulares
        recebem a v5 na próxima sincronização.
      </Notice>
      <TabelaPerguntas />
      <div className="row between wrap">
        <Button
          sm
          aviso="Adicionaria uma pergunta nova ao rascunho."
          style={{ border: "1px dashed var(--dash)", background: "#fff", color: "var(--brand)" }}
        >
          <Icon name="plus" size={16} />
          Adicionar pergunta
        </Button>
        <LinkAviso aviso="Mostraria as 19 perguntas." style={{ fontSize: 13.5, fontWeight: 600 }}>
          Mostrar as 19 perguntas
        </LinkAviso>
      </div>
      <div className="checks">
        {verificacoesModelo.map((texto) => (
          <span key={texto}>
            <Icon name="check" size={16} />
            {texto}
          </span>
        ))}
      </div>
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="ghost" sm aviso="Descartaria o rascunho da v5." style={{ color: "var(--blq)" }}>
          Descartar rascunho
        </Button>
        <Button variant="line" sm aviso="Mostraria as diferenças entre v4 e v5.">
          Comparar com a v4
        </Button>
        <Button
          variant="p"
          sm
          aviso="v5 publicada. Os celulares recebem a nova versão na próxima sincronização."
        >
          Publicar v5
        </Button>
      </div>
    </Panel>
  );
}
