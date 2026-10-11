import { Badge } from "@/components/ui/Badge";
import { cx } from "@/lib/cx";
import type { ParticipanteApr } from "@/data/nova-apr-app";

/** Linha de participante: checkbox, avatar, nome/matrícula e papel. */
export function ParticipanteRow({ participante: p }: { participante: ParticipanteApr }) {
  return (
    <label className="list-row" style={{ minHeight: 60 }}>
      <input type="checkbox" defaultChecked={p.marcado} />
      <span className={cx("avatar", p.avatar)}>{p.iniciais}</span>
      <span className={cx(p.voce && "grow", "stack")} style={{ flex: 1 }}>
        <strong style={{ fontSize: 14.5, color: p.esmaecido ? "var(--ink3)" : undefined }}>{p.nome}</strong>
        <span className="mono small">mat. {p.detalhe}</span>
      </span>
      {p.papel && (
        <Badge tone={p.papel.tone} style={p.papel.tone === "neu" ? { color: "var(--ink)", fontWeight: 600 } : undefined}>
          {p.papel.rotulo}
        </Badge>
      )}
    </label>
  );
}
