"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { registrosFila } from "@/data/sincronizacao";
import { telaPorPathname } from "@/lib/telas";
import { useAlertas } from "@/state/alertas";
import { useSincronizacao } from "@/state/sincronizacao";

export interface ItemMenu {
  href: string;
  icone: IconName;
  rotulo: string;
  /** Contador exibido à direita do item. */
  contador?: "alertas" | "fila";
}

interface MenuLateralProps {
  titulo: string;
  itens: ItemMenu[];
  /** Atalho para a outra área do sistema. */
  outraArea: Omit<ItemMenu, "contador">;
  rodape: string;
}

function Contador({ tipo }: { tipo: NonNullable<ItemMenu["contador"]> }) {
  const { naoLidos } = useAlertas();
  const { estado } = useSincronizacao();
  const pendentes = estado.situacao === "concluida" ? 0 : registrosFila.length;
  const total = tipo === "alertas" ? naoLidos : pendentes;
  if (total <= 0) return null;
  return <span className={tipo === "fila" ? "cnt neu" : "cnt"}>{total}</span>;
}

/** Menu lateral: destaca o item da tela atual e leva à outra área do sistema. */
export function MenuLateral({ titulo, itens, outraArea, rodape }: MenuLateralProps) {
  const atual = telaPorPathname(usePathname());
  return (
    <nav className="side" aria-label={titulo}>
      {itens.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.href === atual?.menu ? "page" : undefined}>
          <Icon name={item.icone} size={18} />
          {item.rotulo}
          {item.contador && <Contador tipo={item.contador} />}
        </Link>
      ))}
      <div className="side-sep">Outra área</div>
      <Link href={outraArea.href}>
        <Icon name={outraArea.icone} size={18} />
        {outraArea.rotulo}
      </Link>
      <div className="foot-note">{rodape}</div>
    </nav>
  );
}
