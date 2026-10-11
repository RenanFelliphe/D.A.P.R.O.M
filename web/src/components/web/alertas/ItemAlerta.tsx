import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { diaMes, hora } from "@/lib/formatar";
import { rotuloDoAlerta, type Alerta } from "./tipos";

/** Item da lista de alertas: um link que abre o alerta no painel da direita (`?alerta=<id>`). */
export function ItemAlerta({ alerta, selecionado, href }: { alerta: Alerta; selecionado: boolean; href: string }) {
  const bloqueio = alerta.tipo === "bloqueio";
  const naoLido = alerta.lido_em === null;
  return (
    <Link
      href={href}
      scroll={false}
      className={naoLido ? "aitem unread" : "aitem"}
      role="option"
      aria-selected={selecionado}
      style={{ textDecoration: "none" }}
    >
      <span className={bloqueio ? "ic red" : "ic blue"}>
        <Icon name={bloqueio ? "octagon" : "refresh"} size={16} />
      </span>
      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <span className="tp">
          <b style={{ color: bloqueio ? "var(--blq)" : "var(--brand)" }}>{rotuloDoAlerta(alerta)}</b>
          <span>
            {diaMes(alerta.criado_em)} {hora(alerta.criado_em)}
          </span>
        </span>
        <span className="os">
          <span className="mono">{alerta.numero_ordem ?? "OS manual"}</span> · {alerta.titulo}
        </span>
        <span className="rs" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {alerta.detalhe}
        </span>
      </span>
    </Link>
  );
}
