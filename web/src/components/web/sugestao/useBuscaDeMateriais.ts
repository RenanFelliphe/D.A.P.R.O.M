"use client";

import { useEffect, useState } from "react";
import type { ListaDeMateriais, Material } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";

const RESULTADOS_DA_BUSCA = 8;

/** Busca no cadastro de materiais enquanto a pessoa digita (com uma pequena espera), só entre os ativos; `null` enquanto não há texto. */
export function useBuscaDeMateriais(busca: string): Material[] | null {
  const [resultados, setResultados] = useState<Material[] | null>(null);
  useEffect(() => {
    const termo = busca.trim();
    let ativo = true;
    const espera = setTimeout(
      () => {
        if (!termo) return setResultados(null);
        const consulta = new URLSearchParams({ busca: termo, ativo: "true", tamanho: String(RESULTADOS_DA_BUSCA) });
        chamar<ListaDeMateriais>("GET", `/catalogo/materiais?${consulta}`)
          .then((r) => ativo && setResultados(r.materiais))
          .catch(() => ativo && setResultados([]));
      },
      termo ? 250 : 0,
    );
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [busca]);
  return resultados;
}
