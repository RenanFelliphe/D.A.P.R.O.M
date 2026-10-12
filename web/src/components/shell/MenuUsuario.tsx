"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { sair } from "@/lib/acoes-sessao";
import { rotas } from "@/lib/rotas";
import type { UsuarioDaBarra } from "./Barras";

/** Usuário da barra superior: abre um menu com Perfil e Sair. */
export function MenuUsuario({ iniciais, nome, cargo }: UsuarioDaBarra) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <div className="usuario-menu" ref={raiz}>
      <button
        type="button"
        className="who-u usuario-gatilho"
        data-treino="menu-usuario"
        aria-label={`Menu de ${nome}`}
        aria-haspopup="true"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        <span className="av">{iniciais}</span>
        <span>
          <strong>{nome}</strong>
          <small>{cargo}</small>
        </span>
        <Icon name="down" size={16} />
      </button>
      {aberto && (
        <div id={id} className="sino-menu usuario-lista">
          <Link href={rotas.app.perfil} className="usuario-item" onClick={fechar}>
            <Icon name="user" size={16} />
            Perfil
          </Link>
          <form action={sair}>
            <button type="submit" className="usuario-item perigo">
              <Icon name="x" size={16} />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
