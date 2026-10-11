import { LinkAviso } from "@/components/ui/Aviso";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";
import { participantesApr } from "@/data/detalhe";
import { ItensAprResumo } from "./ItensAprResumo";

const cartaoPessoa = {
  flex: 1,
  minWidth: 240,
  padding: "10px 12px",
  borderRadius: 10,
  background: "var(--surface2)",
  border: "1px solid var(--line2)",
} as const;

/** APR aprovada da OS: participantes, resumo das respostas e itens. */
export function AprAprovada() {
  return (
    <Panel>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2>
            APR <span className="mono">#A-2210</span> · APR 03 — Operação e manutenção, versão 4
          </h2>
          <span className="muted">Concluída em 13/10 às 09:24 · 2ª APR desta OS</span>
        </div>
        <Badge tone="enc">
          <Icon name="check" size={13} />
          Aprovada
        </Badge>
      </div>
      <div className="row g8 wrap">
        {participantesApr.map((pessoa) => (
          <div key={pessoa.iniciais} className="row g12" style={cartaoPessoa}>
            <span
              className={pessoa.alternativo ? "avatar av2" : "avatar"}
              style={{ width: 34, height: 34, fontSize: 12 }}
            >
              {pessoa.iniciais}
            </span>
            <span className="stack" style={{ lineHeight: 1.3 }}>
              <strong style={{ fontSize: 14 }}>{pessoa.nome}</strong>
              <span className="small">{pessoa.detalhe}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="row wrap g8" style={{ fontSize: 13 }}>
        <span className="tag" style={{ background: "var(--chip)" }}>
          18 itens respondidos
        </span>
        <span className="tag" style={{ background: "var(--enc-bg)", color: "var(--enc)", fontWeight: 600 }}>
          17 conformes
        </span>
        <span className="tag" style={{ background: "var(--al-bg)", color: "var(--al)", fontWeight: 600 }}>
          <Icon name="alert" size={13} /> 1 alerta
        </span>
        <span className="tag" style={{ background: "var(--chip)" }}>
          0 bloqueios
        </span>
      </div>
      <ItensAprResumo />
      <LinkAviso aviso="Mostraria os 18 itens respondidos." style={{ fontSize: 13.5, fontWeight: 600 }}>
        Ver os 18 itens
      </LinkAviso>
    </Panel>
  );
}
