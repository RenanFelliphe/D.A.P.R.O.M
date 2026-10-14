"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";

export interface OpcaoDoBotao {
  rotulo: string;
  /** Frase curta sob o rótulo. */
  descricao?: string;
  aoClicar: () => void;
}

const LARGURA = 260;

/**
 * Botão com rótulo que abre um menu suspenso (como o "Novo funcionário" e o "Nova ordem" dos simuladores). O menu é `position: fixed`
 * e fecha ao escolher, clicar fora, apertar Esc, rolar ou redimensionar, como o `MenuAcoes`.
 */
export function BotaoComMenu({ rotulo, icone = "plus", opcoes, children }: { rotulo: string; icone?: IconName; opcoes: OpcaoDoBotao[]; children?: ReactNode }) {
  const [posicao, setPosicao] = useState<{ topo: number; esquerda: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const aberto = posicao !== null;

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setPosicao(null);
    function aoClicarFora(evento: MouseEvent) {
      const alvo = evento.target as Node;
      if (!menu.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar();
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        fechar();
        botao.current?.focus();
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    menu.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  function alternar() {
    if (aberto) return setPosicao(null);
    const caixa = botao.current!.getBoundingClientRect();
    setPosicao({ topo: caixa.bottom + 4, esquerda: Math.max(8, Math.min(caixa.right - LARGURA, window.innerWidth - LARGURA - 8)) });
  }

  return (
    <>
      <button ref={botao} type="button" className="btn btn-p btn-sm" aria-haspopup="menu" aria-expanded={aberto} aria-controls={aberto ? id : undefined} onClick={alternar}>
        <Icon name={icone} size={16} />
        {rotulo}
        <Icon name="down" size={13} />
      </button>
      {aberto && (
        <div ref={menu} id={id} role="menu" className="menu-acoes" style={{ top: posicao.topo, left: posicao.esquerda, width: LARGURA }}>
          {opcoes.map((o) => (
            <button
              key={o.rotulo}
              type="button"
              role="menuitem"
              className={cx("menu-acoes-item", "sim-menu-item")}
              onClick={() => {
                setPosicao(null);
                o.aoClicar();
              }}
            >
              <b>{o.rotulo}</b>
              {o.descricao && <span className="small">{o.descricao}</span>}
            </button>
          ))}
          {children}
        </div>
      )}
    </>
  );
}
