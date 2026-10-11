import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";

interface ArquivoProcessadoProps {
  nome: string;
  /** Subtítulo, ex.: "processada agora". */
  detalhe: string;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
}

/** Planilha processada, com o resumo de criadas, atualizadas e ignoradas. */
export function ArquivoProcessado({ nome, detalhe, criadas, atualizadas, ignoradas }: ArquivoProcessadoProps) {
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
        <span className="stack" style={{ flex: 1, lineHeight: 1.3, minWidth: 0 }}>
          <span className="mono" style={{ fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>
            {nome}
          </span>
          <span className="small">{detalhe}</span>
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
          <span className="v">{criadas}</span>
          <span className="small">entraram como liberadas</span>
        </div>
        <div>
          <span className="muted row g6">
            <Icon name="refresh" size={13} style={{ color: "var(--lib)" }} />
            Atualizadas
          </span>
          <span className="v">{atualizadas}</span>
          <span className="small">só datas, equipe e prioridade</span>
        </div>
        <div className={ignoradas > 0 ? "warn" : undefined}>
          <span className="row g6" style={ignoradas > 0 ? { color: "var(--al)", fontSize: 13 } : { fontSize: 13 }}>
            <Icon name="alert" size={13} />
            Ignoradas
          </span>
          <span className="v">{ignoradas}</span>
          <span className="small" style={ignoradas > 0 ? { color: "var(--al)" } : undefined}>
            {ignoradas > 0 ? "motivo de cada uma abaixo" : "nenhuma linha ficou de fora"}
          </span>
        </div>
      </div>
    </Panel>
  );
}
