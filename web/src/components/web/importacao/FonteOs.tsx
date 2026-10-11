import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";

/** Painel com a fonte das OS (API do SAP simulada). */
export function FonteOs() {
  return (
    <Panel>
      <div className="row between wrap">
        <h2>Fonte das OS</h2>
        <Badge tone="enc">
          <Icon name="check" size={13} />
          Conectada
        </Badge>
      </div>
      <div className="row g12" style={{ padding: 12, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line2)" }}>
        <Icon name="refresh" size={22} style={{ color: "var(--brand)" }} />
        <span className="stack" style={{ lineHeight: 1.35, flex: 1 }}>
          <strong style={{ fontSize: 14 }}>API do SAP · ambiente simulado</strong>
          <span className="small">Dados fictícios, no mesmo contrato da API real · última leitura hoje às 07:41 · 412 OS</span>
        </span>
        <Button variant="line" sm aviso="Leria a API agora e atualizaria as OS.">
          Ler agora
        </Button>
      </div>
      <p className="muted">A planilha abaixo continua como alternativa, para trabalhar sem a API.</p>
    </Panel>
  );
}
