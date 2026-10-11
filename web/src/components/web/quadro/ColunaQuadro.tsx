import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { ColunaQuadroDados } from "@/data/quadro";
import { CartaoOs } from "./CartaoOs";

/** Coluna do kanban: cabeçalho com contagem, cartões e "Mais N OS". */
export function ColunaQuadro({ coluna }: { coluna: ColunaQuadroDados }) {
  return (
    <div className="bcol">
      <div className="bcol-h">
        <Icon name={coluna.icone} size={16} fill={coluna.iconeCheio} style={{ color: coluna.iconeCor }} />
        <h2>{coluna.titulo}</h2>
        <Badge tone={coluna.tomBadge}>{coluna.total}</Badge>
      </div>
      {coluna.cartoes.map((os) => (
        <CartaoOs key={os.os} os={os} />
      ))}
      {coluna.mais && (
        <span className="more" style={{ color: "var(--brand)" }}>
          {coluna.mais}
        </span>
      )}
    </div>
  );
}
