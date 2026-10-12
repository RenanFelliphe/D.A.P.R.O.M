"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export interface SubitemMenu {
  href: string;
  rotulo: string;
  icone: IconName;
}

export interface ItemMenu {
  href: string;
  icone: IconName;
  rotulo: string;
  /** Contador exibido à direita do item (alertas não lidos). */
  contador?: number;
  /** Outros prefixos de rota que deixam este item ativo (por exemplo `/web/os` para o quadro). */
  prefixos?: string[];
  /** Subpáginas: o item vira um grupo que abre e fecha (dropdown) com um link para cada uma. */
  subitens?: SubitemMenu[];
}

interface MenuLateralProps {
  titulo: string;
  itens: ItemMenu[];
  /** Atalho para a outra área do sistema, quando o perfil tem acesso a ela. */
  outraArea?: Omit<ItemMenu, "contador" | "prefixos" | "subitens">;
  rodape: string;
}

const combina = (pathname: string, prefixo: string) => pathname === prefixo || pathname.startsWith(`${prefixo}/`);

/** Mesma largura em que o CSS (`base.css`) transforma o menu lateral na barra inferior. */
const BARRA_INFERIOR = "(max-width: 900px)";
const assinarLargura = (avisar: () => void) => {
  const consulta = window.matchMedia(BARRA_INFERIOR);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
};

/**
 * Item com subpáginas. No menu lateral é um grupo que abre e fecha: começa aberto quando a tela atual é dele e, depois
 * que a pessoa abre ou fecha, fica como ela deixou. Na barra inferior (celular) as subpáginas abrem num menu acima da
 * barra, só ao tocar, e fecham ao escolher, ao tocar fora ou com Esc.
 */
function GrupoMenu({ item, pathname, ativo }: { item: ItemMenu & { subitens: SubitemMenu[] }; pathname: string; ativo: boolean }) {
  const barraInferior = useSyncExternalStore(assinarLargura, () => window.matchMedia(BARRA_INFERIOR).matches, () => false);
  const [escolha, setEscolha] = useState<boolean | null>(null);
  const grupo = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idSub = useId();
  const aberto = barraInferior ? escolha === true : (escolha ?? ativo);
  // O detalhe da OS e o PDF (prefixos do grupo, fora das subpáginas) vêm do quadro: a primeira subpágina fica marcada.
  const subAtivo = item.subitens.find((s) => combina(pathname, s.href))?.href ?? (ativo ? item.subitens[0]?.href : undefined);

  useEffect(() => {
    if (!barraInferior || escolha !== true) return;
    const fora = (e: PointerEvent) => {
      if (!grupo.current?.contains(e.target as Node)) setEscolha(null);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [barraInferior, escolha]);

  function teclar(e: KeyboardEvent) {
    if (e.key !== "Escape" || !aberto) return;
    setEscolha(false);
    botao.current?.focus();
  }

  return (
    // `data-escolha`: no celular o CSS só mostra o menu quando a pessoa tocou, mesmo antes de o JS saber a largura da tela.
    <div ref={grupo} className="side-grupo" data-escolha={escolha === true ? "aberto" : undefined} onKeyDown={teclar}>
      <button
        ref={botao}
        type="button"
        className="side-grupo-btn"
        aria-expanded={aberto}
        aria-controls={idSub}
        data-ativo={ativo || undefined}
        title={item.rotulo}
        onClick={() => setEscolha(!aberto)}
      >
        <Icon name={item.icone} size={18} />
        <span className="rot">{item.rotulo}</span>
        <Icon name="down" size={16} className="side-seta" />
      </button>
      <div id={idSub} className="side-sub" role="group" aria-label={item.rotulo} hidden={!aberto}>
        {item.subitens.map((s) => (
          <Link key={s.href} href={s.href} aria-current={s.href === subAtivo ? "page" : undefined} onClick={() => setEscolha(null)}>
            <Icon name={s.icone} size={16} />
            <span className="rot">{s.rotulo}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

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
      {itens.map((item) =>
        item.subitens?.length ? (
          <GrupoMenu key={item.href} item={{ ...item, subitens: item.subitens }} pathname={pathname} ativo={item.href === ativo} />
        ) : (
          <Link key={item.href} href={item.href} title={item.rotulo} aria-label={item.rotulo} aria-current={item.href === ativo ? "page" : undefined}>
            <Icon name={item.icone} size={18} />
            <span className="rot">{item.rotulo}</span>
            {item.contador !== undefined && item.contador > 0 && <span className="cnt">{item.contador}</span>}
          </Link>
        ),
      )}
      {outraArea && (
        <>
          <div className="side-sep">Outra área</div>
          <Link href={outraArea.href} title={outraArea.rotulo} aria-label={outraArea.rotulo}>
            <Icon name={outraArea.icone} size={18} />
            <span className="rot">{outraArea.rotulo}</span>
          </Link>
        </>
      )}
      <div className="foot-note">{rodape}</div>
    </nav>
  );
}
