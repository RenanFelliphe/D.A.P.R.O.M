import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { OsDoQuadro } from "@/data/quadro";
import { rotuloDoStatus, type OsStatus } from "@/lib/tipos";
import { CartaoOs } from "./CartaoOs";

export const aparenciaDoStatus: Record<OsStatus, { icone: IconName; cheio?: boolean; cor: string; tom: BadgeTone }> = {
  liberada: { icone: "lock", cor: "var(--lib)", tom: "lib" },
  em_execucao: { icone: "play", cheio: true, cor: "var(--exe)", tom: "exe" },
  pendente: { icone: "octagon", cor: "var(--blq)", tom: "blq" },
  encerrada: { icone: "check", cor: "var(--enc)", tom: "enc" },
  cancelada: { icone: "x", cor: "var(--ink3)", tom: "neu" },
};

interface ColunaQuadroProps {
  status: OsStatus;
  total: number;
  os: OsDoQuadro[];
  /** Endereço do quadro só com este status (o "Ver todas"). */
  hrefTodas?: string;
}

/** Coluna do kanban: cabeçalho com o total real, cartões e "Ver todas". */
export function ColunaQuadro({ status, total, os, hrefTodas }: ColunaQuadroProps) {
  const a = aparenciaDoStatus[status];
  const restantes = total - os.length;
  return (
    <div className="bcol">
      <div className="bcol-h">
        <Icon name={a.icone} size={16} fill={a.cheio} style={{ color: a.cor }} />
        <h2>{rotuloDoStatus[status]}</h2>
        <Badge tone={a.tom}>{total}</Badge>
      </div>
      {os.length === 0 && (
        <span className="muted" style={{ padding: 6, fontSize: 13 }}>
          Nenhuma OS.
        </span>
      )}
      {os.map((o) => (
        <CartaoOs key={o.id} os={o} />
      ))}
      {restantes > 0 && hrefTodas && (
        <Link className="more" href={hrefTodas} style={{ color: "var(--brand)" }}>
          Ver todas · mais {restantes} OS
        </Link>
      )}
    </div>
  );
}
