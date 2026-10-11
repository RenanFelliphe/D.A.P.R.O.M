"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { modelosApr } from "@/data/modelos";
import { rotas } from "@/lib/telas";
import { useToast } from "@/state/toast";

/** Lista lateral de modelos de APR; só a APR 03 é detalhada nesta demonstração. */
export function ListaModelos() {
  const exibirAviso = useToast();

  function aoEscolher(evento: MouseEvent<HTMLAnchorElement>, atual?: boolean) {
    evento.preventDefault();
    if (!atual) exibirAviso("Esta demonstração detalha apenas a APR 03.");
  }

  return (
    <div className="alist mlist" id="ml-list">
      {modelosApr.map((m) => (
        <Link
          key={m.numero}
          href={rotas.web.modelos}
          aria-current={m.atual ? "true" : undefined}
          onClick={(evento) => aoEscolher(evento, m.atual)}
        >
          <span className="tp">
            <b>{`APR ${m.numero}`}</b>
            <span>{m.versao}</span>
          </span>
          <span className="tt">{m.titulo}</span>
          <span className="small">{`${m.perguntas} perguntas`}</span>
        </Link>
      ))}
    </div>
  );
}
