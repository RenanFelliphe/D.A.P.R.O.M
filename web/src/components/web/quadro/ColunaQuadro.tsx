import Link from "next/link";
import type { BadgeTone } from "@/components/ui/Badge";
import type { IconName } from "@/components/ui/Icon";
import type { OsDoQuadro } from "@/data/quadro";
import { rotuloDoStatus, type OsStatus } from "@/lib/tipos";
import { CartaoOs } from "./CartaoOs";
import { ColunaRecolhivel } from "./ColunaRecolhivel";

export const aparenciaDoStatus: Record<OsStatus, { icone: IconName; cheio?: boolean; cor: string; tom: BadgeTone }> = {
  liberada: { icone: "lock", cor: "var(--lib)", tom: "lib" },
  em_execucao: { icone: "play", cheio: true, cor: "var(--exe)", tom: "exe" },
  encerrando: { icone: "clock", cor: "var(--exe)", tom: "exe" },
  aguardando_supervisor: { icone: "file", cor: "var(--al)", tom: "al" },
  pendente: { icone: "octagon", cor: "var(--blq)", tom: "blq" },
  encerrada: { icone: "check", cor: "var(--enc)", tom: "enc" },
  cancelada: { icone: "x", cor: "var(--ink3)", tom: "neu" },
  devolvida: { icone: "left", cor: "var(--ink3)", tom: "neu" },
};

interface ColunaQuadroProps {
  status: OsStatus;
  total: number;
  os: OsDoQuadro[];
  /** Endereço do quadro só com este status (o "Ver todas"). */
  hrefTodas?: string;
  /** Admin e supervisor: os cartões mostram a assinatura final e o PDF das concluídas. */
  gestao: boolean;
  /** Quem está vendo o quadro: o cartão da OS reservada diz "para você" ou o nome do responsável. */
  usuarioId: string;
}

/** Coluna do kanban: cabeçalho com o total real, cartões e "Ver todas"; a pessoa pode fechá-la (ver `ColunaRecolhivel`). */
export function ColunaQuadro({ status, total, os, hrefTodas, gestao, usuarioId }: ColunaQuadroProps) {
  const a = aparenciaDoStatus[status];
  const restantes = total - os.length;
  return (
    <ColunaRecolhivel status={status} titulo={rotuloDoStatus[status]} icone={a.icone} cheio={a.cheio} cor={a.cor} tom={a.tom} total={total}>
      {os.length === 0 && (
        <span className="muted" style={{ padding: 6, fontSize: 13 }}>
          Nenhuma OS.
        </span>
      )}
      {os.map((o) => (
        <CartaoOs key={o.id} os={o} gestao={gestao} usuarioId={usuarioId} />
      ))}
      {restantes > 0 && hrefTodas && (
        <Link className="more" href={hrefTodas} style={{ color: "var(--brand)" }}>
          Ver todas · mais {restantes} OS
        </Link>
      )}
    </ColunaRecolhivel>
  );
}
