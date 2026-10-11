import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";

/** Última planilha processada, com o resumo de criadas, atualizadas e ignoradas. */
export function ArquivoProcessado() {
  return (
    <Panel>
      <div className="row g12 wrap">
        <span
          style={{
            width: 38,
            height: 46,
            flex: "none",
            borderRadius: 6,
            background: "var(--enc)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 6,
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          XLSX
        </span>
        <span className="stack" style={{ flex: 1, lineHeight: 1.3 }}>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
            export_ordens_2026-10-13.xlsx
          </span>
          <span className="small">412 linhas · processada hoje às 07:41 por Ana Ribeiro</span>
        </span>
        <Badge tone="enc">
          <Icon name="check" size={13} />
          Concluída
        </Badge>
      </div>
      <div className="result3">
        <div>
          <span className="muted row g6">
            <Icon name="plus" size={13} style={{ color: "var(--enc)" }} />
            Criadas
          </span>
          <span className="v">37</span>
          <span className="small">entraram como liberadas</span>
        </div>
        <div>
          <span className="muted row g6">
            <Icon name="refresh" size={13} style={{ color: "var(--lib)" }} />
            Atualizadas
          </span>
          <span className="v">368</span>
          <span className="small">só datas, equipe e prioridade</span>
        </div>
        <div className="warn">
          <span className="row g6" style={{ color: "var(--al)", fontSize: 13 }}>
            <Icon name="alert" size={13} />
            Ignoradas
          </span>
          <span className="v">7</span>
          <span className="small" style={{ color: "var(--al)" }}>
            motivo de cada uma abaixo
          </span>
        </div>
      </div>
    </Panel>
  );
}
