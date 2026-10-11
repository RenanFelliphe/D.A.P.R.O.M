import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/cx";
import type { Colega } from "@/lib/apr";
import { iniciaisDe } from "@/lib/tipos";

interface ParticipanteRowProps {
  colega: Colega;
  voce: boolean;
  marcado: boolean;
  responsavel: boolean;
  /** Variação de cor do avatar. */
  avatar?: "av2" | "av3";
  aoAlternar: () => void;
  aoTornarResponsavel: () => void;
}

/** Linha de participante: checkbox, avatar, nome/matrícula e papel (responsável ou executor). */
export function ParticipanteRow({ colega, voce, marcado, responsavel, avatar, aoAlternar, aoTornarResponsavel }: ParticipanteRowProps) {
  return (
    <div className="list-row" style={{ minHeight: 60 }}>
      <input type="checkbox" checked={marcado} disabled={voce} onChange={aoAlternar} aria-label={`${colega.nome} participa da atividade`} />
      <span className={cx("avatar", avatar)}>{iniciaisDe(colega.nome)}</span>
      <span className="stack grow" style={{ flex: 1 }}>
        <strong style={{ fontSize: 14.5, color: marcado ? undefined : "var(--ink3)" }}>
          {colega.nome}
          {voce ? " (você)" : ""}
        </strong>
        <span className="mono small">
          mat. {colega.matricula}
          {colega.cargo ? ` · ${colega.cargo}` : ""}
          {colega.assinatura_path ? "" : " · sem assinatura cadastrada"}
        </span>
      </span>
      {marcado &&
        (responsavel ? (
          <Badge tone="dark">Responsável</Badge>
        ) : (
          <>
            <Badge tone="neu" style={{ color: "var(--ink)", fontWeight: 600 }}>
              Executor
            </Badge>
            <Button variant="ghost" sm onClick={aoTornarResponsavel}>
              Tornar responsável
            </Button>
          </>
        ))}
    </div>
  );
}
