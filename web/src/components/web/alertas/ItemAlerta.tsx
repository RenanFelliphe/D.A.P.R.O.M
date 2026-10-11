import { Icon } from "@/components/ui/Icon";
import type { Alerta } from "@/data/alertas";

/** Item da lista de alertas (botão de uma listbox). */
export function ItemAlerta({
  alerta,
  selecionado,
  aoSelecionar,
}: {
  alerta: Alerta;
  selecionado: boolean;
  aoSelecionar: () => void;
}) {
  const bloqueio = alerta.natureza === "bloq";
  return (
    <button
      className={alerta.naoLido ? "aitem unread" : "aitem"}
      type="button"
      role="option"
      aria-selected={selecionado}
      onClick={aoSelecionar}
    >
      <span className={bloqueio ? "ic red" : "ic blue"}>
        <Icon name={bloqueio ? "octagon" : "refresh"} size={16} />
      </span>
      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <span className="tp">
          <b style={{ color: bloqueio ? "var(--blq)" : "var(--brand)" }}>{alerta.tipo}</b>
          <span>{alerta.quando}</span>
        </span>
        <span className="os">
          <span className="mono">{alerta.os}</span> · {alerta.local}
        </span>
        <span className="rs">{alerta.resumo}</span>
      </span>
    </button>
  );
}
