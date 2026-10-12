"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./Icon";

export interface ItemDoMenu {
  rotulo: string;
  aoClicar: () => void;
  /** Ação destrutiva (vermelha), como remover. */
  perigo?: boolean;
  desabilitado?: boolean;
}

interface MenuAcoesProps {
  /** Texto de acessibilidade do botão de três pontos (ex.: "Ações de Maria Souza"). */
  rotulo: string;
  itens: ItemDoMenu[];
  desabilitado?: boolean;
}

const LARGURA = 200;

/**
 * Botão de três pontos que abre um menu suspenso. O menu é `position: fixed` (posicionado pelo botão), para não ser
 * cortado pelo `overflow` da tabela. Fecha ao escolher um item, clicar fora, apertar Esc, rolar ou redimensionar.
 */
export function MenuAcoes({ rotulo, itens, desabilitado }: MenuAcoesProps) {
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
    const altura = itens.length * 38 + 12;
    const abreParaCima = caixa.bottom + altura > window.innerHeight && caixa.top > altura;
    setPosicao({
      topo: abreParaCima ? caixa.top - altura - 4 : caixa.bottom + 4,
      esquerda: Math.max(8, Math.min(caixa.right - LARGURA, window.innerWidth - LARGURA - 8)),
    });
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="ibtn"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        disabled={desabilitado}
        onClick={alternar}
      >
        <Icon name="dots" size={18} />
      </button>
      {aberto && (
        <div ref={menu} id={id} role="menu" className="menu-acoes" style={{ top: posicao.topo, left: posicao.esquerda, width: LARGURA }}>
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              className={cx("menu-acoes-item", item.perigo && "perigo")}
              disabled={item.desabilitado}
              onClick={() => {
                setPosicao(null);
                item.aoClicar();
              }}
            >
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
