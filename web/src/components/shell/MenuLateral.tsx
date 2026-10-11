"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface ItemMenu {
  href: string;
  icone: IconName;
  rotulo: string;
  /** Contador exibido à direita do item (alertas não lidos). */
  contador?: number;
  /** Outros prefixos de rota que deixam este item ativo (por exemplo `/web/os` para o quadro). */
  prefixos?: string[];
}

interface MenuLateralProps {
  titulo: string;
  itens: ItemMenu[];
  /** Atalho para a outra área do sistema, quando o perfil tem acesso a ela. */
  outraArea?: Omit<ItemMenu, "contador" | "prefixos">;
  rodape: string;
}

const combina = (pathname: string, prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`);

/** Menu lateral: destaca o item da tela atual (o de prefixo mais longo que combina). */
export function MenuLateral({ titulo, itens, outraArea, rodape }: MenuLateralProps) {
  const pathname = usePathname();
  let ativo: string | undefined;
  let melhor = -1;
  for (const item of itens) {
    for (const prefixo of [item.href, ...(item.prefixos ?? [])]) {
      if (combina(pathname, prefixo) && prefixo.length > melhor) {
        ativo = item.href;
        melhor = prefixo.length;
      }
    }
  }
  return (
    <nav className="side" aria-label={titulo}>
      {itens.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.href === ativo ? "page" : undefined}>
          <Icon name={item.icone} size={18} />
          {item.rotulo}
          {item.contador !== undefined && item.contador > 0 && <span className="cnt">{item.contador}</span>}
        </Link>
      ))}
      {outraArea && (
        <>
          <div className="side-sep">Outra área</div>
          <Link href={outraArea.href}>
            <Icon name={outraArea.icone} size={18} />
            {outraArea.rotulo}
          </Link>
        </>
      )}
      <div className="foot-note">{rodape}</div>
    </nav>
  );
}
